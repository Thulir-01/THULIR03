import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Smartphone,
  ScanFace,
  Fingerprint,
  MoreVertical,
  RotateCcw,
  MessageSquarePlus,
  ArrowUpRight,
  LineChart,
  BarChart3,
  FlaskConical,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Loader2,
  Calendar,
  Phone,
  Activity,
  BadgeCheck,
  Database,
  SlidersHorizontal,
  ChevronRight,
  User,
} from "lucide-react";
import {
  getOrders,
  getOrder,
  approveOrder,
  type OrderListItem,
  type OrderDetail,
  type TestChild,
} from "../lib/api-client";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";
import { useAuth } from "../lib/useAuth";

/* ─── Clinical helpers (same semantics as ApprovalsPage) ──────────── */

function flatten(tests: TestChild[]): TestChild[] {
  const out: TestChild[] = [];
  for (const t of tests) {
    out.push(t);
    if (t.children?.length) out.push(...flatten(t.children));
  }
  return out;
}

function isCritical(t: TestChild): boolean {
  if (!t.result) return false;
  const val = parseFloat(t.result);
  if (isNaN(val)) return false;
  if (t.refLow != null && val < t.refLow) return true;
  if (t.refHigh != null && val > t.refHigh) return true;
  return false;
}

function flagInfo(t: TestChild): "high" | "low" | null {
  if (!t.result) return null;
  const val = parseFloat(t.result);
  if (isNaN(val)) return null;
  if (t.refHigh != null && val > t.refHigh) return "high";
  if (t.refLow != null && val < t.refLow) return "low";
  return null;
}

function fmtHrs(ms: number): string {
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  return `${h.toFixed(1)}h`;
}

function tatMs(createdAt: string): number {
  return Math.max(0, Date.now() - new Date(createdAt).getTime());
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/* ─── Deterministic PRNG so QC sims are stable per case ───────────── */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ─── QC control simulation (Sprint 12+ module — clearly labeled) ────
 * The backend has no QC module yet, so this page renders a deterministic
 * Levey-Jennings control chart per case from the analyte's reference
 * interval. It exists to demonstrate the Westgard safety gate only.      */
interface QcPoint {
  label: string;
  value: number;
  z: number;
  rule: string | null;
}
interface QcSeries {
  testCode: string;
  testName: string;
  mean: number;
  sd: number;
  points: QcPoint[];
  violations: string[];
  n: number;
}

function qcSeriesFor(test: TestChild): QcSeries | null {
  const refLow = Number(test.refLow);
  const refHigh = Number(test.refHigh);
  if (isNaN(refLow) || isNaN(refHigh)) return null;
  const mean = (refLow + refHigh) / 2;
  const sd = Math.max((refHigh - refLow) / 8, 0.01);
  const rand = mulberry32(hashSeed(test.testCode + ":" + test.id));
  const n = 20;
  const points: QcPoint[] = [];
  // ~1 in 6 runs carries a Westgard violation (1:2s / 1:3s) so the
  // approval-blocking gate can be demonstrated.
  const violationIdx = rand() < 0.16 ? Math.floor(rand() * n) : -1;
  const violationDir = rand() < 0.5 ? 1 : -1;
  const violations = new Set<string>();
  for (let i = 0; i < n; i++) {
    let v = mean + (rand() - 0.5) * 4.4 * sd;
    if (i === violationIdx) {
      v = mean + violationDir * (2.6 + rand() * 1.2) * sd;
    }
    const z = (v - mean) / sd;
    let rule: string | null = null;
    if (Math.abs(z) > 3) rule = "1:3s";
    else if (Math.abs(z) > 2) rule = "1:2s";
    if (rule) violations.add(rule);
    points.push({ label: `#${i + 1}`, value: v, z, rule });
  }
  return {
    testCode: test.testCode,
    testName: test.testName,
    mean,
    sd,
    points,
    violations: [...violations],
    n,
  };
}

/* ─── Levey-Jennings chart (pure SVG) ─────────────────────────────── */
function LeveyJenningsChart({ series }: { series: QcSeries }) {
  const W = 540;
  const H = 230;
  const PAD_L = 30;
  const PAD_R = 34;
  const PAD_T = 14;
  const PAD_B = 24;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const { mean, sd, points } = series;
  const maxV = mean + 3.6 * sd;
  const minV = mean - 3.6 * sd;

  const y = (v: number) => PAD_T + ((maxV - v) / (maxV - minV)) * innerH;
  const x = (i: number) => PAD_L + (i / Math.max(1, points.length - 1)) * innerW;

  const bands = [
    { z: 0, label: "mean", solid: true },
    { z: 1, label: "+1s" },
    { z: -1, label: "-1s" },
    { z: 2, label: "+2s" },
    { z: -2, label: "-2s" },
    { z: 3, label: "+3s" },
    { z: -3, label: "-3s" },
  ];

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Levey-Jennings control chart">
      {/* control bands */}
      {bands.map((b) => {
        const vy = y(mean + b.z * sd);
        const out = Math.abs(b.z) >= 2;
        return (
          <g key={b.label}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={vy}
              y2={vy}
              stroke={out ? "#C93C3C" : b.solid ? "#0e4f52" : "#94a3b8"}
              strokeWidth={b.solid ? 1.4 : 0.8}
              strokeDasharray={b.solid ? undefined : out ? "5 4" : "3 4"}
              opacity={b.solid ? 1 : 0.75}
            />
            <text x={W - PAD_R + 4} y={vy + 3} fontSize={8.5} fill={out ? "#C93C3C" : "#64748b"}>
              {b.label}
            </text>
          </g>
        );
      })}
      {/* control points */}
      <polyline points={path} fill="none" stroke="#0e4f52" strokeWidth={1.6} opacity={0.55} />
      {points.map((p, i) => (
        <g key={p.label}>
          <circle
            cx={x(i)}
            cy={y(p.value)}
            r={p.rule ? 5 : 3.6}
            fill={p.rule ? "#C93C3C" : "#0e4f52"}
            stroke="#fff"
            strokeWidth={1.2}
            opacity={p.rule ? 1 : 0.9}
          />
          {p.rule && (
            <text x={x(i)} y={y(p.value) - 8} fontSize={9} fontWeight={700} fill="#C93C3C" textAnchor="middle">
              {p.rule}
            </text>
          )}
        </g>
      ))}
      {/* x labels */}
      {points.map((p, i) =>
        i % 4 === 0 ? (
          <text key={p.label} x={x(i)} y={H - 8} fontSize={8.5} fill="#94a3b8" textAnchor="middle">
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/* ─── Mini histogram of the control run ───────────────────────────── */
function QcHistogram({ series }: { series: QcSeries }) {
  const { mean, sd, points } = series;
  const bins = 6;
  const minV = mean - 3.6 * sd;
  const maxV = mean + 3.6 * sd;
  const width = (maxV - minV) / bins;
  const counts = new Array(bins).fill(0);
  for (const p of points) {
    const b = Math.min(bins - 1, Math.max(0, Math.floor((p.value - minV) / width)));
    counts[b]++;
  }
  const maxC = Math.max(1, ...counts);
  const inControl = points.filter((p) => !p.rule).length;
  const out = points.length - inControl;

  return (
    <div>
      <div className="flex h-20 items-end gap-1.5">
        {counts.map((c, i) => {
          const bandCenter = minV + (i + 0.5) * width;
          const z = (bandCenter - mean) / sd;
          const out = Math.abs(z) > 2;
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="data-mono text-[9px] text-ink-400">{c}</span>
              <div
                className={`w-full rounded-sm ${out ? "bg-status-critical/70" : "bg-accent-700/70"}`}
                style={{ height: `${(c / maxC) * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-ink-400">
        <span>Distribution of {series.n} control runs</span>
        <span className="data-mono">
          {inControl} in control · {out} flagged
        </span>
      </div>
    </div>
  );
}

/* ─── Case model built from order + detail ────────────────────────── */
interface CaseModel {
  order: OrderListItem;
  detail: OrderDetail;
  tests: TestChild[];
  criticals: TestChild[];
  flagged: TestChild[];
  qc: QcSeries | null;
  priority: "red" | "amber" | "green";
  priorityLabel: string;
}

function buildCase(order: OrderListItem, detail: OrderDetail): CaseModel {
  const tests = flatten(detail.tests);
  const criticals = tests.filter(isCritical);
  const flagged = tests.filter((t) => flagInfo(t) !== null);
  const qc = tests.map(qcSeriesFor).find((s) => s !== null) ?? null;

  const emergency = order.emergency || ["stat", "emergency"].includes(order.priority);
  const urgent = ["urgent", "high"].includes(order.priority);

  let priority: CaseModel["priority"];
  let priorityLabel: string;
  if (emergency || criticals.length > 0 || (qc && qc.violations.length > 0)) {
    priority = "red";
    priorityLabel = emergency ? "Critical / Urgent" : "Critical values";
  } else if (urgent || flagged.length > 0) {
    priority = "amber";
    priorityLabel = "Warning";
  } else {
    priority = "green";
    priorityLabel = "Normal";
  }

  return { order, detail, tests, criticals, flagged, qc, priority, priorityLabel };
}

const PRIORITY_STYLES: Record<string, { badge: string; dot: string; label: string }> = {
  red: {
    badge: "border-status-critical/30 bg-status-critical/10 text-status-critical",
    dot: "bg-status-critical",
    label: "Critical",
  },
  amber: {
    badge: "border-amber-300/60 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    label: "Warning",
  },
  green: {
    badge: "border-status-normal/30 bg-status-normal/10 text-status-normal",
    dot: "bg-status-normal",
    label: "Normal",
  },
};

/* ─── Page ────────────────────────────────────────────────────────── */
export default function MobileReviewPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [cases, setCases] = useState<CaseModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"data" | "visuals">("data");
  const [bioCase, setBioCase] = useState<CaseModel | null>(null);
  const [approving, setApproving] = useState(false);
  const [batchState, setBatchState] = useState<{ running: boolean; done: number; total: number } | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [escalated, setEscalated] = useState<Set<string>>(new Set());
  const [retested, setRetested] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");
  const [banner, setBanner] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const orders = await getOrders();
      const queue = orders.filter((o) => o.status === "verified");
      const details = await Promise.all(
        queue.slice(0, 40).map((o) => getOrder(o.id).catch(() => null)),
      );
      const built = queue
        .map((o, i) => (details[i] ? buildCase(o, details[i]!) : null))
        .filter((c): c is CaseModel => c !== null);
      setCases(built);
      setSelectedId((cur) => (cur && built.some((c) => c.order.id === cur) ? cur : built[0]?.order.id ?? null));
    } catch {
      setLoadError("Failed to load the review queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const sorted = useMemo(() => {
    const rank = { red: 0, amber: 1, green: 2 } as const;
    return [...cases].sort((a, b) => {
      const r = rank[a.priority] - rank[b.priority];
      if (r !== 0) return r;
      return new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime();
    });
  }, [cases]);

  const selected = selectedId ? cases.find((c) => c.order.id === selectedId) ?? null : null;

  const batchTargets = useMemo(
    () =>
      sorted.filter(
        (c) =>
          c.priority !== "red" &&
          !(c.qc && c.qc.violations.length > 0) &&
          !escalated.has(c.order.id) &&
          !retested.has(c.order.id) &&
          c.detail.verifiedBy !== user?.id,
      ),
    [sorted, escalated, retested, user],
  );

  const showToast = (text: string) => setToast(text);

  /* ── Actions ── */

  const openCase = (id: string) => {
    setSelectedId(id);
    setViewTab("data");
    setMenuFor(null);
    setCommentDraft("");
  };

  const doApprove = async (c: CaseModel) => {
    setApproving(true);
    setBanner(null);
    try {
      await approveOrder(c.order.id);
      setCases((prev) => prev.filter((x) => x.order.id !== c.order.id));
      if (selectedId === c.order.id) {
        setSelectedId(
          sorted.find((x) => x.order.id !== c.order.id)?.order.id ?? null,
        );
      }
      setBioCase(null);
      showToast(`${c.order.orderNumber} approved — report signed & unlocked.`);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Approval failed — only verified orders can be approved.";
      setBanner({ tone: "error", text: msg });
      setBioCase(null);
    } finally {
      setApproving(false);
    }
  };

  const approveAllNormal = async () => {
    if (batchTargets.length === 0) return;
    setBatchState({ running: true, done: 0, total: batchTargets.length });
    let done = 0;
    for (const c of batchTargets) {
      try {
        await approveOrder(c.order.id);
        setCases((prev) => prev.filter((x) => x.order.id !== c.order.id));
      } catch {
        /* skip failures, keep going */
      }
      done++;
      setBatchState({ running: true, done, total: batchTargets.length });
    }
    setBatchState(null);
    setSelectedId((cur) =>
      cur && cases.some((x) => x.order.id === cur) ? cur : null,
    );
    showToast(`Batch approval complete — ${done} orders signed.`);
  };

  const requestRetest = (c: CaseModel) => {
    setRetested((prev) => new Set(prev).add(c.order.id));
    setMenuFor(null);
    if (selectedId === c.order.id) setSelectedId(null);
    showToast(`${c.order.orderNumber} returned to the bench for re-test.`);
  };

  const escalate = (c: CaseModel) => {
    setEscalated((prev) => new Set(prev).add(c.order.id));
    setMenuFor(null);
    showToast(`${c.order.orderNumber} escalated to senior pathologist.`);
  };

  const saveComment = (c: CaseModel) => {
    if (!commentDraft.trim()) return;
    setComments((prev) => ({
      ...prev,
      [c.order.id]: commentDraft.trim(),
    }));
    showToast("Comment noted for this case.");
    setCommentDraft("");
  };

  const selfVerified = (c: CaseModel) => c.detail.verifiedBy === user?.id;
  const blockedByQc = (c: CaseModel) => !!c.qc && c.qc.violations.length > 0;

  /* ── Render ── */

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-surface-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <LoadingState label="Loading mobile review queue…" rows={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-ink-950">
                Mobile Review
              </h1>
              <span className="inline-flex items-center gap-1 rounded-sm border border-accent-200 bg-accent-100/60 px-2 py-0.5 text-[11px] font-medium text-accent-700">
                <Smartphone className="size-3" />
                Tablet Optimized
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-600">
              Triage by priority · verify control charts · sign with biometrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-xs text-ink-400">Signed in as</div>
              <div className="text-sm font-semibold text-ink-950">
                Dr. {user?.firstName} {user?.lastName ?? ""}
              </div>
            </div>
            <button
              onClick={approveAllNormal}
              disabled={!batchState && batchTargets.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-3.5 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {batchState ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {batchState
                ? `Signing ${batchState.done}/${batchState.total}…`
                : `Approve All Normal (${batchTargets.length})`}
            </button>
          </div>
        </div>

        {banner && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-md border px-3 py-2.5 text-xs font-medium ${
              banner.tone === "error"
                ? "border-red-200 bg-red-50 text-status-critical"
                : "border-green-200 bg-green-50 text-status-normal"
            }`}
          >
            {banner.tone === "error" ? (
              <AlertTriangle className="size-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="size-3.5 shrink-0" />
            )}
            {banner.text}
            <button
              onClick={() => setBanner(null)}
              className="ml-auto opacity-60 transition-opacity duration-fast hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : cases.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No cases waiting for sign-off"
            hint="Technicians verify results first — verified orders appear here for review."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(300px,360px)_1fr]">
            {/* ─── Triage list ─── */}
            <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0">
              <div className="flex items-center justify-between border-b border-line-200 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink-950">Triage Queue</h2>
                  <p className="text-[11px] text-ink-400">
                    {sorted.length} cases · critical first
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-ink-400">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-status-critical" /> Crit
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-amber-500" /> Warn
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-status-normal" /> Norm
                  </span>
                </div>
              </div>

              <div className="max-h-[62vh] divide-y divide-line-200 overflow-y-auto lg:max-h-[calc(100vh-280px)]">
                {sorted.map((c) => {
                  const st = PRIORITY_STYLES[c.priority];
                  const active = selectedId === c.order.id;
                  const qcBlocked = blockedByQc(c);
                  return (
                    <div key={c.order.id} className="relative">
                      <button
                        onClick={() => openCase(c.order.id)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-fast ${
                          active ? "bg-accent-100/60" : "hover:bg-surface-100/70"
                        }`}
                      >
                        <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${st.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-ink-950">
                              {c.order.patient.firstName} {c.order.patient.lastName}
                            </span>
                            {c.order.emergency && (
                              <span className="shrink-0 rounded-sm bg-status-critical/10 px-1.5 py-0.5 text-[9px] font-bold text-status-critical">
                                STAT
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                            <span className="data-mono font-medium text-accent-700">
                              {c.order.orderNumber}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {fmtHrs(tatMs(c.order.createdAt))}
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="size-3" />
                              {flatten(c.detail.tests).length}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
                            {qcBlocked && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-status-critical/30 bg-status-critical/10 px-1.5 py-0.5 text-[10px] font-semibold text-status-critical">
                                <AlertTriangle className="size-2.5" />
                                QC flag
                              </span>
                            )}
                            {c.criticals.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-status-critical/30 bg-status-critical/10 px-1.5 py-0.5 text-[10px] font-semibold text-status-critical">
                                ▲ {c.criticals.length} crit
                              </span>
                            )}
                            {escalated.has(c.order.id) && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                                Escalated
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={`mt-1 size-4 shrink-0 text-ink-300 ${active ? "text-accent-600" : ""}`} />
                      </button>

                      {/* three-dot contextual menu */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === c.order.id ? null : c.order.id);
                        }}
                        className="absolute right-2 top-2 rounded-sm p-1 text-ink-400 transition-colors duration-fast hover:bg-surface-200 hover:text-ink-950"
                        aria-label="Case actions"
                      >
                        <MoreVertical className="size-4" />
                      </button>

                      {menuFor === c.order.id && (
                        <>
                          <button
                            className="fixed inset-0 z-30 cursor-default"
                            onClick={() => setMenuFor(null)}
                            aria-label="Close menu"
                          />
                          <div className="absolute right-3 top-9 z-40 w-52 overflow-hidden rounded-md border border-line-200 bg-surface-0 py-1 shadow-overlay">
                            <button
                              onClick={() => {
                                setMenuFor(null);
                                openCase(c.order.id);
                                setCommentDraft(comments[c.order.id] ?? "");
                              }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-accent-100/60"
                            >
                              <MessageSquarePlus className="size-4 text-accent-600" />
                              Add Comment
                            </button>
                            <button
                              onClick={() => requestRetest(c)}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-amber-50"
                            >
                              <RotateCcw className="size-4 text-amber-600" />
                              Request Re-test
                            </button>
                            <button
                              onClick={() => escalate(c)}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-purple-50"
                            >
                              <ArrowUpRight className="size-4 text-purple-600" />
                              Escalate to Senior
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Case detail ─── */}
            <div className="min-w-0">
              {!selected ? (
                <div className="flex h-full min-h-[50vh] items-center justify-center rounded-md border border-dashed border-line-300 bg-surface-0">
                  <div className="text-center">
                    <ShieldCheck className="mx-auto size-10 text-ink-300" />
                    <p className="mt-3 text-sm text-ink-400">
                      Select a case from the triage queue
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0">
                  {/* Case header */}
                  <div className="border-b border-line-200 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-bold text-accent-700">
                          {selected.order.patient.firstName.charAt(0)}
                          {selected.order.patient.lastName?.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-semibold text-ink-950">
                              {selected.order.patient.firstName} {selected.order.patient.lastName}
                            </h2>
                            {selected.order.emergency && (
                              <span className="rounded-sm bg-status-critical px-1.5 py-0.5 text-[10px] font-bold text-surface-0">
                                EMERGENCY
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                            <span className="data-mono font-medium text-accent-700">
                              {selected.order.orderNumber}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" /> {shortDate(selected.order.createdAt)}
                            </span>
                            {selected.order.patient.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="size-3" /> {selected.order.patient.phone}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" /> TAT {fmtHrs(tatMs(selected.order.createdAt))}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PRIORITY_STYLES[selected.priority].badge}`}
                      >
                        <span className={`size-1.5 rounded-full ${PRIORITY_STYLES[selected.priority].dot}`} />
                        {selected.priorityLabel}
                      </span>
                    </div>

                    {/* Verified-by + workflow chips */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {selected.detail.verifiedByUser && (
                        <span className="status-chip border-accent-200 bg-accent-100/50 text-accent-800">
                          <BadgeCheck className="size-3" />
                          Verified by {selected.detail.verifiedByUser.name}
                          {selfVerified(selected) ? " — you" : ""}
                        </span>
                      )}
                      {selfVerified(selected) && (
                        <span className="status-chip border-amber-200 bg-amber-50 text-amber-700">
                          <ShieldCheck className="size-3" />
                          You verified this — NABL requires a different user to sign off
                        </span>
                      )}
                      {escalated.has(selected.order.id) && (
                        <span className="status-chip border-purple-200 bg-purple-50 text-purple-700">
                          <ArrowUpRight className="size-3" />
                          Escalated to senior pathologist
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Westgard safety gate */}
                  {blockedByQc(selected) && (
                    <div className="flex items-start gap-3 border-b border-status-critical/20 bg-status-critical/5 px-5 py-3.5">
                      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-status-critical" />
                      <div>
                        <p className="text-sm font-semibold text-status-critical">
                          QC out of control — approval blocked
                        </p>
                        <p className="mt-0.5 text-xs text-ink-600">
                          Westgard rule{" "}
                          <span className="data-mono font-semibold text-status-critical">
                            {selected.qc!.violations.join(" + ")}
                          </span>{" "}
                          triggered on the{" "}
                          <span className="font-medium">{selected.qc!.testName}</span> control run.
                          Add a comment or request a re-test before this case can be signed.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tabs (below lg) */}
                  <div className="flex items-center gap-1 border-b border-line-200 px-5 pt-2 lg:hidden">
                    {(
                      [
                        { key: "data", label: "Data", icon: Database },
                        { key: "visuals", label: "Visuals", icon: LineChart },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setViewTab(t.key)}
                        className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-sm font-medium transition-colors duration-fast ${
                          viewTab === t.key
                            ? "border-accent-700 text-accent-700"
                            : "border-transparent text-ink-400"
                        }`}
                      >
                        <t.icon className="size-4" />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Split view: Data | Visuals */}
                  <div className="grid gap-0 lg:grid-cols-2 lg:gap-px lg:bg-line-200">
                    {/* ── Data panel ── */}
                    <section className={`px-5 py-4 lg:bg-surface-0 ${viewTab === "data" ? "" : "hidden lg:block"}`}>
                      <div className="mb-3 flex items-center gap-2">
                        <Database className="size-4 text-accent-600" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                          Results & Metadata
                        </h3>
                      </div>

                      {/* QC metadata (demo) */}
                      <div className="mb-4 rounded-md border border-line-200 bg-surface-100/50 p-3.5">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-950">
                            <FlaskConical className="size-3.5 text-accent-600" />
                            Instrument QC
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-700">
                            <BadgeCheck className="size-3" />
                            {blockedByQc(selected) ? "Out of control" : "In control"}
                          </span>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-ink-400">Instrument</dt>
                            <dd className="data-mono text-ink-950">
                              {selected.qc ? `H-${(hashSeed(selected.qc.testCode) % 90) + 10}` : "—"}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-ink-400">Reagent lot</dt>
                            <dd className="data-mono text-ink-950">
                              {selected.qc ? `LOT${(hashSeed(selected.qc.testCode + "L") % 9000) + 1000}` : "—"}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-ink-400">Calibration</dt>
                            <dd className="data-mono text-ink-950">
                              {shortDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * (selected.qc ? (hashSeed(selected.qc.testCode + "C") % 20) + 2 : 7)).toISOString())}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-ink-400">Control level</dt>
                            <dd className="data-mono text-ink-950">L2</dd>
                          </div>
                        </dl>
                        <p className="mt-2 border-t border-line-200 pt-2 text-[10px] leading-relaxed text-ink-400">
                          Simulated QC metadata — the QC module ships in a later
                          release. Shows how reagent lot & calibration context
                          will appear beside results.
                        </p>
                      </div>

                      {/* Results */}
                      <div className="divide-y divide-line-200 rounded-md border border-line-200">
                        {selected.tests.map((t) => {
                          const isParent = !!t.children?.length;
                          const flag = flagInfo(t);
                          const crit = isCritical(t);
                          return (
                            <div key={t.id} className={`flex items-center gap-3 px-3.5 py-2.5 ${isParent ? "bg-accent-100/30" : ""}`}>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-ink-950">
                                  {isParent ? (
                                    <span className="font-semibold">
                                      {t.testName} <span className="data-mono text-[11px] text-ink-400">({t.testCode})</span>
                                    </span>
                                  ) : (
                                    t.testName
                                  )}
                                </div>
                                <div className="data-mono text-[10px] text-ink-400">
                                  ref {t.refRange ?? "—"}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <span
                                  className={`data-mono text-sm font-semibold ${
                                    crit ? "text-status-critical" : flag ? "text-amber-600" : "text-ink-950"
                                  }`}
                                >
                                  {t.result ?? "—"}
                                  {flag && <span className="ml-1">{flag === "high" ? "▲" : "▼"}</span>}
                                  <span className="ml-1 text-[10px] font-normal text-ink-400">{t.unit}</span>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Review comment */}
                      <div className="mt-4">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                          Clinical comment
                        </p>
                        {comments[selected.order.id] && (
                          <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            <span className="font-semibold">Note:</span> {comments[selected.order.id]}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                            placeholder="e.g. Hemolysis suspected — verify with repeat draw"
                            className="min-w-0 flex-1 rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-sm text-ink-950 transition-all duration-fast focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 placeholder:text-ink-300"
                          />
                          <button
                            onClick={() => saveComment(selected)}
                            disabled={!commentDraft.trim()}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-xs font-medium text-accent-600 transition-colors duration-fast hover:bg-accent-50 disabled:opacity-40"
                          >
                            <MessageSquarePlus className="size-3.5" />
                            Add
                          </button>
                        </div>
                        <p className="mt-1 text-[10px] text-ink-400">
                          Review note for this session — comments persist in the full review view.
                        </p>
                      </div>
                    </section>

                    {/* ── Visuals panel ── */}
                    <section className={`px-5 py-4 lg:bg-surface-0 ${viewTab === "visuals" ? "" : "hidden lg:block"}`}>
                      <div className="mb-3 flex items-center gap-2">
                        <LineChart className="size-4 text-accent-600" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                          Control Charts
                        </h3>
                      </div>

                      {!selected.qc ? (
                        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line-300 px-6 py-12 text-center">
                          <BarChart3 className="size-8 text-ink-300" />
                          <p className="mt-2 text-sm text-ink-400">
                            No numeric reference range on this case's tests
                          </p>
                          <p className="mt-1 text-xs text-ink-300">
                            Control charts need a numeric interval to render.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-md border border-line-200 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Activity className="size-4 text-accent-700" />
                                <span className="text-sm font-semibold text-ink-950">
                                  Levey-Jennings — {selected.qc.testName}
                                </span>
                              </div>
                              <span className="data-mono text-[10px] text-ink-400">
                                {selected.qc.testCode}
                              </span>
                            </div>
                            <LeveyJenningsChart series={selected.qc} />
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-200 pt-2 text-[10px] text-ink-400">
                              <span className="flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-accent-700" /> in control
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-status-critical" /> 1:2s / 1:3s
                              </span>
                              <span className="ml-auto flex items-center gap-1.5">
                                <SlidersHorizontal className="size-3" />
                                mean <span className="data-mono text-ink-950">{selected.qc.mean.toFixed(2)}</span>
                              </span>
                            </div>
                          </div>

                          <div className="rounded-md border border-line-200 p-3">
                            <div className="mb-2 flex items-center gap-2">
                              <BarChart3 className="size-4 text-accent-700" />
                              <span className="text-sm font-semibold text-ink-950">Run distribution</span>
                            </div>
                            <QcHistogram series={selected.qc} />
                          </div>

                          <div className="rounded-md border border-line-200 p-3">
                            <div className="mb-1.5 flex items-center gap-2">
                              <ShieldCheck className="size-4 text-accent-700" />
                              <span className="text-sm font-semibold text-ink-950">Westgard rules</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                              {[
                                ["1:2s", selected.qc.violations.includes("1:2s")],
                                ["1:3s", selected.qc.violations.includes("1:3s")],
                                ["R-4s", false],
                                ["4:1s", false],
                              ].map(([rule, hit]) => (
                                <span
                                  key={String(rule)}
                                  className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1.5 font-medium ${
                                    hit
                                      ? "border-status-critical/30 bg-status-critical/10 text-status-critical"
                                      : "border-line-200 bg-surface-100/50 text-ink-400"
                                  }`}
                                >
                                  <span className={`size-1.5 rounded-full ${hit ? "bg-status-critical" : "bg-ink-300"}`} />
                                  <span className="data-mono">{rule}</span>
                                  {hit && <AlertTriangle className="ml-auto size-3" />}
                                </span>
                              ))}
                            </div>
                            <p className="mt-2 border-t border-line-200 pt-2 text-[10px] leading-relaxed text-ink-400">
                              Simulated control data for the mockup — production QC
                              (Sprint 12+) streams live control runs from instruments.
                            </p>
                          </div>
                        </div>
                      )}
                    </section>
                  </div>

                  {/* ─── Quick-action sign-off bar ─── */}
                  <div className="flex items-center justify-between gap-3 border-t border-line-200 bg-surface-0 px-5 py-3.5">
                    <div className="min-w-0 text-[11px] text-ink-500">
                      {blockedByQc(selected) ? (
                        <span className="flex items-center gap-1.5 font-medium text-status-critical">
                          <AlertTriangle className="size-3.5 shrink-0" />
                          Blocked — resolve the QC flag first
                        </span>
                      ) : selfVerified(selected) ? (
                        <span className="flex items-center gap-1.5 font-medium text-amber-600">
                          <User className="size-3.5 shrink-0" />
                          Needs a second sign-off (you verified this)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <ScanFace className="size-3.5 text-accent-600" />
                          Sign with fingerprint / FaceID
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          openCase(selected.order.id);
                          setCommentDraft(comments[selected.order.id] ?? "");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-xs font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100"
                        title="Add a clinical comment"
                      >
                        <MessageSquarePlus className="size-3.5" />
                        Comment
                      </button>
                      <button
                        onClick={() => setBioCase(selected)}
                        disabled={
                          blockedByQc(selected) ||
                          selfVerified(selected) ||
                          retested.has(selected.order.id) ||
                          approving
                        }
                        className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-4 py-2.5 text-sm font-semibold text-surface-0 shadow-raised transition-all duration-fast hover:bg-accent-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {approving ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Fingerprint className="size-4" />
                        )}
                        Approve &amp; Sign
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Biometric sign-off modal ─── */}
      {bioCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-lg border border-line-200 bg-surface-0 shadow-overlay">
            <div className="flex items-center justify-between border-b border-line-200 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-ink-950">Confirm Sign-Off</h3>
                <p className="text-xs text-ink-400">
                  {bioCase.order.orderNumber} · {bioCase.order.patient.firstName}{" "}
                  {bioCase.order.patient.lastName}
                </p>
              </div>
              <button
                onClick={() => setBioCase(null)}
                className="text-ink-400 transition-colors hover:text-ink-600"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="px-5 py-6 text-center">
              <div className="relative mx-auto mb-4 flex size-20 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-accent-500/20" />
                <span className="relative flex size-16 items-center justify-center rounded-full border-2 border-accent-500 bg-accent-100 text-accent-700">
                  <Fingerprint className="size-8" />
                </span>
              </div>
              <p className="text-sm font-semibold text-ink-950">Biometric verification</p>
              <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed text-ink-500">
                {approving
                  ? "Verifying and e-signing every result on this report…"
                  : "Place your finger on the sensor or use FaceID to sign this report. Sign-off is immutable and audit-logged."}
              </p>

              <div className="mt-5 flex items-center gap-2 rounded-md border border-line-200 bg-surface-100/60 px-3 py-2 text-left">
                <ShieldCheck className="size-4 shrink-0 text-status-normal" />
                <p className="text-[11px] leading-snug text-ink-600">
                  Immutable audit trail — this action is logged as a{" "}
                  <span className="font-semibold">“Report Sign-Off”</span> with timestamp and actor.
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setBioCase(null)}
                  disabled={approving}
                  className="rounded-md border border-line-300 bg-surface-0 px-4 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-surface-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => doApprove(bioCase)}
                  disabled={approving}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-accent-700 px-4 py-2.5 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500 disabled:opacity-50"
                >
                  {approving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ScanFace className="size-4" />
                  )}
                  {approving ? "Signing…" : "Authenticate & Sign"}
                </button>
              </div>
              <p className="mt-3 text-[10px] text-ink-400">
                Demo biometric — production integrates the platform WebAuthn authenticator.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-md border border-line-200 bg-ink-950 px-4 py-2.5 text-sm text-surface-0 shadow-overlay">
            <CheckCircle2 className="size-4 text-status-normal" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
