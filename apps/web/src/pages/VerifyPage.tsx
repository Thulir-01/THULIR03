import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  BadgeCheck,
  Clock,
  Flag,
  RotateCcw,
  AlertTriangle,
  Phone,
  X,
  Plus,
  Minus,
  Maximize2,
  Microscope,
  History,
  ShieldCheck,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  FlaskConical,
  RefreshCw,
} from "lucide-react";
import {
  getOrders,
  getOrder,
  verifyOrder,
  type OrderListItem,
  type OrderDetail,
  type TestChild,
} from "../lib/api-client";
import { useContextActions } from "../lib/context-actions";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";
import { useAuth } from "../lib/useAuth";

/* ── Clinical helpers ─────────────────────────────────────────── */

function getFlag(
  result: string | null,
  refLow: number | null,
  refHigh: number | null,
): { icon: React.ReactNode; title: string } | null {
  if (!result || (refLow === null && refHigh === null)) return null;
  const val = parseFloat(result);
  if (isNaN(val)) return null;
  if (refHigh !== null && val > refHigh)
    return { icon: <ArrowUp className="size-3" />, title: "High" };
  if (refLow !== null && val < refLow)
    return { icon: <ArrowDown className="size-3" />, title: "Low" };
  return null;
}

function isCritical(t: TestChild): boolean {
  if (!t.result) return false;
  const val = parseFloat(t.result);
  if (isNaN(val)) return false;
  if (t.refLow != null && val < t.refLow) return true;
  if (t.refHigh != null && val > t.refHigh) return true;
  return false;
}

function flatten(tests: TestChild[]): TestChild[] {
  const out: TestChild[] = [];
  for (const t of tests) {
    out.push(t);
    if (t.children?.length) out.push(...flatten(t.children));
  }
  return out;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Deterministic SPL-XXXXXX slide number derived from the order id. */
function slideNo(orderId: string): string {
  let h = 0;
  for (let i = 0; i < orderId.length; i++) h = (h * 31 + orderId.charCodeAt(i)) >>> 0;
  return `SPL-${(h % 900000 + 100000).toString()}`;
}

interface LocalAction {
  kind: "flagged" | "rerouted";
  reason: string;
  comment: string;
  at: string;
}

type LocalActions = Record<string, LocalAction>;

const FLAG_REASONS = [
  "Insufficient Staining",
  "Tissue Fold",
  "Air Bubble / Artifact",
  "Sample Mismatch",
  "Poor Fixation",
  "Other",
];

const REROUTE_REASONS = [
  "Insufficient Quantity",
  "Hemolysed Sample",
  "Clotted Sample",
  "Contaminated Sample",
  "Label Mismatch",
  "Re-run Required",
];

const PROCESSED = new Set(["verified", "approved"]);

/* ── Page ─────────────────────────────────────────────────────── */

export default function VerifyPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [banner, setBanner] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [localActions, setLocalActions] = useState<LocalActions>({});
  const [zoom, setZoom] = useState(1);
  const [flagModal, setFlagModal] = useState(false);
  const [rerouteModal, setRerouteModal] = useState(false);
  const [issueReason, setIssueReason] = useState<string | null>(null);
  const [issueComment, setIssueComment] = useState("");
  const [rerouteReason, setRerouteReason] = useState<string | null>(null);
  const [rerouteComment, setRerouteComment] = useState("");

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await getOrders(q || undefined);
      setOrders(data);
    } catch {
      setOrders([]);
      setLoadError("Failed to load the verify queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [load, search]);

  const queue = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "completed" &&
          !localActions[o.id] &&
          !PROCESSED.has(o.status),
      ),
    [orders, localActions],
  );

  const flaggedCount = Object.values(localActions).filter((a) => a.kind === "flagged").length;
  const verifiedToday = orders.filter(
    (o) =>
      PROCESSED.has(o.status) &&
      o.createdAt &&
      new Date(o.createdAt).toDateString() === new Date().toDateString(),
  ).length;

  const filteredQueue = queue.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      `${o.patient.firstName} ${o.patient.lastName}`.toLowerCase().includes(q)
    );
  });

  const selectOrder = async (order: OrderListItem) => {
    setSelectedId(order.id);
    setBanner(null);
    setDetailLoading(true);
    setDetail(null);
    try {
      setDetail(await getOrder(order.id));
    } catch {
      setBanner({ tone: "error", text: "Failed to load order details." });
    } finally {
      setDetailLoading(false);
    }
  };

  // Select the first pending item on load — batch processing focus.
  useEffect(() => {
    if (!selectedId && filteredQueue.length > 0 && !detailLoading && !loading) {
      selectOrder(filteredQueue[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredQueue.length, loading]);

  const doApprove = async () => {
    if (!detail) return;
    setVerifying(true);
    setBanner(null);
    try {
      await verifyOrder(detail.id);
      setBanner({
        tone: "success",
        text: `Order ${detail.orderNumber} verified — moved to the pathologist review queue.`,
      });
      await load(search);
      setSelectedId(null);
      setDetail(null);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Verification failed. Only completed orders can be verified.";
      setBanner({ tone: "error", text: msg });
    } finally {
      setVerifying(false);
    }
  };

  const confirmFlag = () => {
    if (!detail || !issueReason || !issueComment.trim()) return;
    const at = new Date().toISOString();
    setLocalActions((m) => ({
      ...m,
      [detail.id]: { kind: "flagged", reason: issueReason, comment: issueComment.trim(), at },
    }));
    setBanner({
      tone: "error",
      text: `Slide flagged (${issueReason}) — pathologist will review. Recorded in the audit trail.`,
    });
    setFlagModal(false);
    setIssueReason(null);
    setIssueComment("");
    setSelectedId(null);
    setDetail(null);
  };

  const confirmReroute = () => {
    if (!detail) return;
    const at = new Date().toISOString();
    setLocalActions((m) => ({
      ...m,
      [detail.id]: {
        kind: "rerouted",
        reason: rerouteReason ?? "Quality Insufficient",
        comment: rerouteComment.trim() || "Returned to bench for re-processing",
        at,
      },
    }));
    setBanner({
      tone: "success",
      text: `Slide rerouted to the bench for re-processing (${rerouteReason ?? "Quality Insufficient"}).`,
    });
    setRerouteModal(false);
    setRerouteReason(null);
    setRerouteComment("");
    setSelectedId(null);
    setDetail(null);
  };

  const allTests = detail ? flatten(detail.tests) : [];
  const pendingCount = allTests.filter(
    (t) => t.status !== "completed" && !t.children?.length,
  ).length;
  const detailFlagged = allTests.filter((t) => getFlag(t.result, t.refLow, t.refHigh));
  const localAction = detail ? localActions[detail.id] : undefined;

  const kpis = [
    {
      label: "Pending Bench",
      value: String(queue.length),
      unit: "slides",
      icon: Clock,
      tone: "petrol",
    },
    {
      label: "Ready to Verify",
      value: String(filteredQueue.length),
      unit: "completed",
      icon: CheckCircle2,
      tone: "petrol",
    },
    {
      label: "Flagged",
      value: String(flaggedCount),
      unit: "this shift",
      icon: Flag,
      tone: "red",
    },
    {
      label: "Verified Today",
      value: String(verifiedToday),
      unit: "orders",
      icon: BadgeCheck,
      tone: "green",
    },
  ];

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Context toolbar — refresh the verify queue.
  useContextActions([
    { id: "refresh", label: "Refresh", icon: RefreshCw, onClick: () => load() },
  ]);

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* ── Header ── */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-ink-950">
                Technician Verify Queue
              </h1>
              <span className="inline-flex items-center gap-1 rounded-sm border border-accent-200 bg-accent-100/60 px-2 py-0.5 text-[11px] font-medium text-accent-700">
                <ShieldCheck className="size-3" />
                CLIA / HIPAA
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-600">
              Process. Verify. Move on — confirm completed results before sign-off — {todayLabel}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-400">On bench</div>
            <div className="mt-0.5 text-sm font-semibold text-ink-950">
              {user?.firstName} {user?.lastName ?? ""}
            </div>
            <div className="text-[11px] capitalize text-accent-700">{user?.role ?? "technician"}</div>
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

        {loading ? (
          <LoadingState label="Loading verify queue…" rows={5} />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={() => load(search)} />
        ) : (
          <>
            {/* ── KPI row ── */}
            <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className={`rounded-md border bg-surface-0 px-4 py-3.5 ${
                    k.tone === "red" ? "border-red-200" : "border-line-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="field-label">{k.label}</span>
                    <span
                      className={`flex size-8 items-center justify-center rounded-sm ${
                        k.tone === "red"
                          ? "bg-red-50 text-status-critical"
                          : k.tone === "green"
                            ? "bg-green-50 text-status-normal"
                            : "bg-accent-100 text-accent-700"
                      }`}
                    >
                      <k.icon className="size-4" />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span
                      className={`data-mono text-2xl font-semibold ${
                        k.tone === "red" ? "text-status-critical" : "text-ink-950"
                      }`}
                    >
                      {k.value}
                    </span>
                    <span className="text-[11px] text-ink-400">{k.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Queue + Review ── */}
            <div className="grid gap-4 lg:grid-cols-5">
              {/* LEFT: pending verification list */}
              <div className="lg:col-span-2">
                <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-200 px-4 py-3">
                    <div>
                      <h2 className="text-sm font-semibold text-ink-950">Pending Verification</h2>
                      <p className="mt-0.5 text-xs text-ink-600">
                        {filteredQueue.length} slide{filteredQueue.length === 1 ? "" : "s"} on bench
                      </p>
                    </div>
                    <div className="relative w-full max-w-52">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                      <input
                        type="text"
                        placeholder="Search order # / patient…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 w-full rounded-md border border-line-300 bg-surface-0 pl-9 pr-3 text-sm transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100"
                      />
                    </div>
                  </div>

                  {filteredQueue.length === 0 ? (
                    <EmptyState
                      icon={BadgeCheck}
                      title={search ? "No slides match your search" : "No slides awaiting verification"}
                      hint={
                        search
                          ? "Try a different order number or patient name"
                          : "Enter results first — completed orders appear here for confirmation."
                      }
                    />
                  ) : (
                    <div className="max-h-[62vh] divide-y divide-line-200 overflow-y-auto">
                      {filteredQueue.map((order) => {
                        const tests = flatten(order.tests as unknown as TestChild[]);
                        const done = tests.filter((t) => t.status === "completed").length;
                        const total = tests.filter((t) => !t.children?.length).length;
                        const ready = done === total && done > 0;
                        const crit = tests.some(isCritical);
                        const isActive = selectedId === order.id;
                        return (
                          <button
                            key={order.id}
                            onClick={() => selectOrder(order)}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-surface-100 ${
                              isActive ? "border-l-2 border-accent-500 bg-accent-100/40" : ""
                            }`}
                          >
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-bold text-accent-700">
                              {order.patient.firstName.charAt(0)}
                              {order.patient.lastName?.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-ink-950">
                                  {order.patient.firstName} {order.patient.lastName}
                                </span>
                                {order.emergency && (
                                  <span className="size-1.5 shrink-0 rounded-full bg-status-critical" />
                                )}
                                {crit && (
                                  <span className="inline-flex items-center gap-0.5 rounded-sm bg-red-50 px-1 py-px text-[9px] font-bold text-status-critical">
                                    CRIT
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-600">
                                <span className="data-mono font-medium text-accent-700">
                                  {order.orderNumber}
                                </span>
                                <span className="data-mono text-ink-400">{slideNo(order.id)}</span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <span
                                className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${
                                  ready
                                    ? "bg-accent-100 text-accent-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {ready ? <BadgeCheck className="size-2.5" /> : <Clock className="size-2.5" />}
                                {ready ? "Ready" : `${done}/${total}`}
                              </span>
                              <div className="data-mono mt-1 text-[10px] text-ink-400">
                                {fmtTime(order.createdAt)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: review panel */}
              <div className="flex min-h-0 flex-col gap-4 lg:col-span-3">
                {!detail && !detailLoading ? (
                  <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line-300 bg-surface-0 p-10 text-center">
                    <Microscope className="size-10 text-line-300" />
                    <p className="text-sm font-medium text-ink-950">Select a slide to review</p>
                    <p className="max-w-sm text-xs text-ink-600">
                      Click a pending item in the queue to inspect its results, review the slide,
                      then approve, flag, or reroute it.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Slide header */}
                    <div className="rounded-md border border-line-200 bg-surface-0 px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-bold text-accent-700">
                            {detail?.patient.firstName.charAt(0)}
                            {detail?.patient.lastName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="font-semibold text-ink-950">
                                {detail?.patient.title ? `${detail?.patient.title} ` : ""}
                                {detail?.patient.firstName} {detail?.patient.lastName}
                              </h2>
                              {detail?.emergency && (
                                <span className="rounded-sm bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-status-critical">
                                  EMERGENCY
                                </span>
                              )}
                              {detail && localAction?.kind === "flagged" && (
                                <span className="inline-flex items-center gap-1 rounded-sm bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-status-critical">
                                  <Flag className="size-2.5" /> FLAGGED
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-600">
                              <span className="data-mono font-medium text-accent-700">
                                {detail?.orderNumber}
                              </span>
                              {detail && (
                                <span className="data-mono text-ink-500">{slideNo(detail.id)}</span>
                              )}
                              {detail?.patient.phone && (
                                <span className="flex items-center gap-0.5">
                                  <Phone className="size-3" />
                                  {detail?.patient.phone}
                                </span>
                              )}
                              {detail?.patient.gender && (
                                <span className="capitalize">{detail?.patient.gender}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-wider text-ink-400">
                              On bench
                            </div>
                            <div className="data-mono mt-0.5 text-xs font-medium text-ink-950">
                              {fmtTime(detail?.createdAt)} · {fmtDate(detail?.createdAt)}
                            </div>
                          </div>
                          <span
                            className={`status-chip ${
                              pendingCount > 0
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-accent-200 bg-accent-100/50 text-accent-800"
                            }`}
                          >
                            {pendingCount > 0 ? (
                              <>
                                <Clock className="size-3" /> In Progress
                              </>
                            ) : (
                              <>
                                <BadgeCheck className="size-3" /> Ready
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      {pendingCount > 0 && (
                        <div className="mt-3 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
                          <Clock className="size-3.5" />
                          {pendingCount} result{pendingCount > 1 ? "s" : ""} still pending — complete
                          all results before verifying
                        </div>
                      )}
                    </div>

                    {detailLoading ? (
                      <LoadingState label="Loading slide details…" rows={3} />
                    ) : (
                      <>
                        {/* WSI viewer */}
                        <div className="rounded-md border border-line-200 bg-surface-0">
                          <div className="flex items-center justify-between border-b border-line-200 px-4 py-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                              <Microscope className="size-4 text-accent-700" />
                              Whole-Slide Image
                            </h3>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
                                disabled={zoom <= 1}
                                className="flex size-8 items-center justify-center rounded-sm border border-line-300 text-ink-600 transition-colors duration-fast hover:border-accent-500 hover:text-accent-700 disabled:opacity-40"
                                aria-label="Zoom out"
                              >
                                <Minus className="size-3.5" />
                              </button>
                              <span className="data-mono w-12 text-center text-xs font-medium text-ink-950">
                                {Math.round(zoom * 100)}%
                              </span>
                              <button
                                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                                disabled={zoom >= 4}
                                className="flex size-8 items-center justify-center rounded-sm border border-line-300 text-ink-600 transition-colors duration-fast hover:border-accent-500 hover:text-accent-700 disabled:opacity-40"
                                aria-label="Zoom in"
                              >
                                <Plus className="size-3.5" />
                              </button>
                              <button
                                onClick={() => setZoom(1)}
                                className="flex size-8 items-center justify-center rounded-sm border border-line-300 text-ink-600 transition-colors duration-fast hover:border-accent-500 hover:text-accent-700"
                                aria-label="Reset zoom"
                                title="Reset zoom"
                              >
                                <Maximize2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="relative flex h-52 items-center justify-center overflow-hidden bg-ink-950/95 px-4 py-3">
                            <div
                              className="relative grid h-full w-full grid-cols-8 grid-rows-6 place-items-center transition-transform duration-fast ease-precise"
                              style={{ transform: `scale(${zoom})` }}
                            >
                              {/* tissue schematic */}
                              <div className="col-span-5 row-span-4 col-start-2 row-start-1 h-full w-full rounded-[45%_55%_50%_50%/40%_50%_50%_60%] bg-gradient-to-br from-accent-500/40 via-accent-700/55 to-accent-900/70" />
                              <div className="col-span-3 row-span-2 col-start-6 row-start-3 h-full w-full rounded-[55%_45%_60%_40%/50%_55%_45%_50%] bg-gradient-to-br from-ink-500/50 to-ink-700/70" />
                              <div className="col-span-2 row-span-2 col-start-2 row-start-5 h-full w-full rounded-[50%_50%_60%_40%] bg-gradient-to-br from-red-900/40 to-amber-900/50" />
                            </div>
                            <div className="pointer-events-none absolute bottom-2 left-3 data-mono text-[10px] text-surface-0/50">
                              {detail ? slideNo(detail.id) : ""} · 40× · H&E
                            </div>
                            <div className="pointer-events-none absolute bottom-2 right-3 rounded-sm bg-ink-950/80 px-1.5 py-0.5 text-[10px] text-amber-200">
                              Schematic preview — connect scanner for live WSI
                            </div>
                          </div>
                        </div>

                        {/* Results table */}
                        <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0">
                          <div className="border-b border-line-200 px-4 py-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                              <FlaskConical className="size-4 text-accent-700" />
                              Results
                            </h3>
                          </div>
                          <div className="max-h-56 overflow-auto">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 z-10">
                                <tr className="border-b border-line-200 bg-surface-100">
                                  <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Test</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Result</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Ref Range</th>
                                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Notes</th>
                                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-ink-600">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-line-200">
                                {allTests.map((t) => {
                                  const flag = getFlag(t.result, t.refLow, t.refHigh);
                                  const crit = isCritical(t);
                                  const isParent = !!t.children?.length;
                                  return (
                                    <tr key={t.id} className={isParent ? "bg-accent-100/30" : ""}>
                                      <td className="px-4 py-2 text-ink-950">
                                        {isParent ? (
                                          <span className="font-semibold">
                                            {t.testName} ({t.testCode})
                                          </span>
                                        ) : (
                                          <span>{t.testName}</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span
                                          className={`data-mono inline-flex items-center gap-1.5 font-medium ${
                                            crit ? "text-status-critical" : "text-ink-950"
                                          }`}
                                        >
                                          {t.result ?? "—"}
                                          {flag && (
                                            <span className="text-status-critical" title={flag.title}>
                                              {flag.icon}
                                            </span>
                                          )}
                                        </span>
                                      </td>
                                      <td className="data-mono px-3 py-2 text-ink-600">
                                        {t.refRange ?? "—"}
                                      </td>
                                      <td className="px-3 py-2 text-xs text-ink-400">{t.notes || "—"}</td>
                                      <td className="px-3 py-2 text-center">
                                        {t.status === "completed" ? (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-normal">
                                            <CheckCircle2 className="size-3" /> Done
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-borderline">
                                            <Clock className="size-3" /> Pending
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Audit trail — immutable history */}
                        <div className="rounded-md border border-line-200 bg-surface-0">
                          <div className="flex items-center justify-between border-b border-line-200 px-4 py-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                              <History className="size-4 text-accent-700" />
                              Audit Trail
                            </h3>
                            <span className="text-[10px] uppercase tracking-wider text-ink-400">
                              Read-only · immutable
                            </span>
                          </div>
                          <div className="px-4 py-3">
                            <ol className="space-y-2.5">
                              <li className="flex items-start gap-3">
                                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-100">
                                  <CheckCircle2 className="size-3 text-accent-700" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-medium text-ink-950">Order registered</div>
                                  <div className="data-mono mt-0.5 text-[10px] text-ink-400">
                                    {fmtDate(detail?.createdAt)} {fmtTime(detail?.createdAt)} ·
                                    {detail?.orderNumber}
                                  </div>
                                </div>
                              </li>
                              <li className="flex items-start gap-3">
                                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green-50">
                                  <FlaskConical className="size-3 text-status-normal" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-medium text-ink-950">All results completed</div>
                                  <div className="mt-0.5 text-[10px] text-ink-400">
                                    {allTests.filter((t) => !t.children?.length).length} result
                                    {allTests.filter((t) => !t.children?.length).length === 1 ? "" : "s"} entered
                                    {pendingCount > 0 ? ` · ${pendingCount} still pending` : ""}
                                  </div>
                                </div>
                              </li>
                              {localAction && (
                                <li className="flex items-start gap-3">
                                  <div
                                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                                      localAction.kind === "flagged"
                                        ? "bg-red-50"
                                        : "bg-amber-50"
                                    }`}
                                  >
                                    {localAction.kind === "flagged" ? (
                                      <Flag className="size-3 text-status-critical" />
                                    ) : (
                                      <RotateCcw className="size-3 text-amber-700" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-ink-950">
                                      {localAction.kind === "flagged"
                                        ? `Flagged — ${localAction.reason}`
                                        : `Rerouted to bench — ${localAction.reason}`}
                                    </div>
                                    <div className="data-mono mt-0.5 text-[10px] text-ink-400">
                                      {fmtTime(localAction.at)} · by {user?.firstName} {user?.lastName}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-ink-600">
                                      “{localAction.comment}”
                                    </div>
                                  </div>
                                </li>
                              )}
                              {detail?.verifiedByUser && (
                                <li className="flex items-start gap-3">
                                  <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-100">
                                    <BadgeCheck className="size-3 text-accent-700" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-ink-950">
                                      Verified by {detail.verifiedByUser.name}
                                    </div>
                                    <div className="data-mono mt-0.5 text-[10px] text-ink-400">
                                      {fmtDate(detail.verifiedAt)} {fmtTime(detail.verifiedAt)}
                                    </div>
                                  </div>
                                </li>
                              )}
                            </ol>
                          </div>
                        </div>

                        {/* Action bar — quick, touch-friendly */}
                        <div className="rounded-md border border-line-200 bg-surface-0 px-4 py-3.5">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <button
                              onClick={doApprove}
                              disabled={verifying || pendingCount > 0}
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-accent-700 px-5 py-3 text-sm font-semibold text-surface-0 shadow-raised transition-colors duration-fast hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:min-w-40"
                            >
                              {verifying ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <BadgeCheck className="size-4" />
                              )}
                              Approve & Send to Pathologist
                            </button>
                            <button
                              onClick={() => setFlagModal(true)}
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-status-critical transition-colors duration-fast hover:bg-red-100 sm:flex-none"
                            >
                              <Flag className="size-4" />
                              Flag Issue
                            </button>
                            <button
                              onClick={() => setRerouteModal(true)}
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-line-300 px-5 py-3 text-sm font-medium text-ink-600 transition-colors duration-fast hover:border-amber-500 hover:text-amber-700 sm:flex-none"
                            >
                              <RotateCcw className="size-4" />
                              Reroute to Bench
                            </button>
                          </div>
                          {detailFlagged.length > 0 && (
                            <div className="mt-2.5 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
                              <AlertTriangle className="size-3.5" />
                              {detailFlagged.length} result{detailFlagged.length > 1 ? "s" : ""} outside
                              reference range — flagged on the report for the pathologist
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Flag Issue modal ── */}
      {flagModal && detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4"
          onClick={() => setFlagModal(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-red-50 text-status-critical">
                  <Flag className="size-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-ink-950">Flag Slide Issue</h2>
                  <p className="mt-0.5 text-xs text-ink-600">
                    <span className="data-mono font-medium text-accent-700">{detail.orderNumber}</span>
                    {` · ${detail.patient.firstName} ${detail.patient.lastName}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFlagModal(false)}
                className="rounded-sm p-1.5 text-ink-400 transition-colors duration-fast hover:bg-surface-100 hover:text-ink-950"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-6 py-4">
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-600">
                Select a reason
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FLAG_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setIssueReason(reason)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-xs font-medium transition-colors duration-fast ${
                      issueReason === reason
                        ? "border-status-critical bg-red-50 text-status-critical"
                        : "border-line-300 text-ink-600 hover:border-line-400 hover:bg-surface-100"
                    }`}
                  >
                    <span
                      className={`flex size-3.5 items-center justify-center rounded-full border ${
                        issueReason === reason
                          ? "border-status-critical bg-status-critical"
                          : "border-line-300"
                      }`}
                    >
                      {issueReason === reason && <span className="size-1.5 rounded-full bg-surface-0" />}
                    </span>
                    {reason}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wider text-ink-600">
                    Comment <span className="text-status-critical">*</span>
                  </label>
                  <span className="text-[10px] text-ink-400">required for CLIA compliance</span>
                </div>
                <textarea
                  value={issueComment}
                  onChange={(e) => setIssueComment(e.target.value)}
                  rows={3}
                  placeholder="Describe the issue — staining quality, artifact location, suspected anomaly…"
                  className="w-full resize-none rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-sm transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line-200 bg-surface-100 px-6 py-3">
              <span className="flex items-center gap-1.5 text-[11px] text-ink-600">
                <ShieldCheck className="size-3.5 text-accent-700" />
                Recorded immutably in the audit trail for the pathologist
              </span>
              <button
                onClick={confirmFlag}
                disabled={!issueReason || !issueComment.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-status-critical px-4 py-2 text-xs font-semibold text-surface-0 shadow-raised transition-colors duration-fast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Flag className="size-3.5" />
                Confirm Flag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reroute modal ── */}
      {rerouteModal && detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4"
          onClick={() => setRerouteModal(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-amber-50 text-amber-700">
                  <RotateCcw className="size-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-ink-950">Reroute to Bench</h2>
                  <p className="mt-0.5 text-xs text-ink-600">
                    Send the slide back for re-processing before verification
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRerouteModal(false)}
                className="rounded-sm p-1.5 text-ink-400 transition-colors duration-fast hover:bg-surface-100 hover:text-ink-950"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-6 py-4">
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-600">
                Reason (optional)
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {REROUTE_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setRerouteReason(reason)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-xs font-medium transition-colors duration-fast ${
                      rerouteReason === reason
                        ? "border-amber-500 bg-amber-50 text-amber-700"
                        : "border-line-300 text-ink-600 hover:border-line-400 hover:bg-surface-100"
                    }`}
                  >
                    <span
                      className={`flex size-3.5 items-center justify-center rounded-full border ${
                        rerouteReason === reason ? "border-amber-500 bg-amber-500" : "border-line-300"
                      }`}
                    >
                      {rerouteReason === reason && <span className="size-1.5 rounded-full bg-surface-0" />}
                    </span>
                    {reason}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-600">
                  Instructions to bench
                </label>
                <textarea
                  value={rerouteComment}
                  onChange={(e) => setRerouteComment(e.target.value)}
                  rows={3}
                  placeholder="e.g. Please re-stain and re-scan the tissue section…"
                  className="w-full resize-none rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-sm transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-line-200 bg-surface-100 px-6 py-3">
              <button
                onClick={() => setRerouteModal(false)}
                className="rounded-md border border-line-300 px-4 py-2 text-xs font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-0"
              >
                Cancel
              </button>
              <button
                onClick={confirmReroute}
                className="inline-flex items-center gap-2 rounded-md border border-amber-500 bg-amber-500 px-4 py-2 text-xs font-semibold text-surface-0 shadow-raised transition-colors duration-fast hover:bg-amber-600"
              >
                <RotateCcw className="size-3.5" />
                Confirm Reroute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
