import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Search,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Phone,
  X,
  CheckCircle2,
  BadgeCheck,
  ArrowUp,
  ArrowDown,
  Eye,
  Plus,
  Minus,
  Maximize2,
  Move,
  Ruler,
  Paintbrush,
  Columns2,
  History,
  FileText,
  Stethoscope,
  Lock,
  PenLine,
  User,
  Calendar,
  PanelLeftClose,
  PanelLeftOpen,
  FlaskConical,
} from "lucide-react";
import {
  getOrders,
  getOrder,
  approveOrder,
  type OrderListItem,
  type OrderDetail,
  type TestChild,
} from "../lib/api-client";
import { LoadingState, ErrorState } from "../components/ui/PageStates";
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
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Deterministic SLD-XXXXXX slide id derived from the order id. */
function slideId(orderId: string): string {
  let h = 0;
  for (let i = 0; i < orderId.length; i++) h = (h * 31 + orderId.charCodeAt(i)) >>> 0;
  return `SLD-${(h % 900000 + 100000).toString()}`;
}

/* CAP-style structured lexicon for auto-suggested diagnosis terms */
const CAP_LEXICON = [
  "Invasive ductal carcinoma (NOS)",
  "Invasive lobular carcinoma",
  "Adenocarcinoma, well differentiated",
  "Adenocarcinoma, moderately differentiated",
  "Adenocarcinoma, poorly differentiated",
  "Squamous cell carcinoma",
  "Papillary carcinoma",
  "Mucinous carcinoma",
  "Lymphoma — diffuse large B-cell",
  "Hodgkin lymphoma, classical",
  "Neuroendocrine tumor (NET), grade 1",
  "Neuroendocrine tumor (NET), grade 2",
  "Sarcomatoid carcinoma",
  "Melanoma, nodular type",
  "Benign — no malignancy identified",
  "Atypical cells, favor reactive",
  "Granulomatous inflammation",
  "Chronic inflammation, non-specific",
  "Fibroadenoma",
  "Lipoma",
  "Hyperplasia, benign",
  "Carcinoma in situ (DCIS)",
  "Metastatic carcinoma, consistent with primary",
];

/* ── Tissue schematic (mock WSI) ──────────────────────────────── */

function TissueSchematic({
  deconvolve,
  zoom,
  pan,
  stain,
}: {
  deconvolve: boolean;
  zoom: number;
  pan: { x: number; y: number };
  stain: "he" | "ihc";
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-ink-950">
      <div
        className="relative h-[70%] w-[85%] transition-transform duration-fast ease-precise"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {/* tissue background */}
        <div
          className={`absolute inset-0 rounded-[45%_55%_52%_48%/42%_50%_50%_58%] bg-gradient-to-br ${
            stain === "ihc"
              ? "from-amber-800/50 via-amber-900/60 to-amber-950/80"
              : "from-accent-500/35 via-accent-700/50 to-accent-900/75"
          }`}
        />
        <div
          className={`absolute left-[8%] top-[10%] h-[38%] w-[30%] rounded-[55%_45%_60%_40%/50%_55%_45%_50%] bg-gradient-to-br ${
            stain === "ihc" ? "from-red-900/50 to-amber-950/70" : "from-ink-500/45 to-ink-800/70"
          }`}
        />
        <div
          className={`absolute right-[10%] top-[16%] h-[30%] w-[34%] rounded-[45%_55%_40%_60%/55%_45%_55%_45%] bg-gradient-to-br ${
            stain === "ihc" ? "from-amber-700/50 to-red-950/60" : "from-red-900/35 to-amber-900/55"
          }`}
        />
        <div
          className={`absolute bottom-[12%] left-[24%] h-[22%] w-[26%] rounded-[50%_50%_55%_45%] bg-gradient-to-br ${
            stain === "ihc" ? "from-red-800/60 to-amber-900/70" : "from-accent-800/50 to-ink-900/70"
          }`}
        />
        {/* nuclei dots */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              stain === "ihc"
                ? "radial-gradient(circle 1.2px at 12% 22%, rgba(120,30,20,0.8), transparent 60%), radial-gradient(circle 1.4px at 34% 58%, rgba(120,30,20,0.8), transparent 60%), radial-gradient(circle 1px at 58% 30%, rgba(120,30,20,0.8), transparent 60%), radial-gradient(circle 1.3px at 72% 62%, rgba(120,30,20,0.8), transparent 60%), radial-gradient(circle 1.1px at 44% 76%, rgba(120,30,20,0.8), transparent 60%), radial-gradient(circle 1.2px at 82% 34%, rgba(120,30,20,0.8), transparent 60%), radial-gradient(circle 1px at 18% 48%, rgba(120,30,20,0.8), transparent 60%) "
                : "radial-gradient(circle 1.2px at 12% 22%, rgba(20,60,80,0.9), transparent 60%), radial-gradient(circle 1.4px at 34% 58%, rgba(20,60,80,0.9), transparent 60%), radial-gradient(circle 1px at 58% 30%, rgba(20,60,80,0.9), transparent 60%), radial-gradient(circle 1.3px at 72% 62%, rgba(20,60,80,0.9), transparent 60%), radial-gradient(circle 1.1px at 44% 76%, rgba(20,60,80,0.9), transparent 60%), radial-gradient(circle 1.2px at 82% 34%, rgba(20,60,80,0.9), transparent 60%), radial-gradient(circle 1px at 18% 48%, rgba(20,60,80,0.9), transparent 60%) ",
          }}
        />
        {/* deconvolution effect */}
        {deconvolve && (
          <div className="absolute inset-0 rounded-[inherit] mix-blend-screen"
            style={{ background: "linear-gradient(120deg, rgba(255,180,120,0.35), rgba(120,40,220,0.4))" }}
          />
        )}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function PathologistReviewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState("");

  /* WSI controls */
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<"cursor" | "measure">("cursor");
  const [measurePoints, setMeasurePoints] = useState<{ x: number; y: number }[]>([]);
  const [deconvolve, setDeconvolve] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  /* Report draft */
  const [diagnosis, setDiagnosis] = useState("");
  const [diagnosisFocus, setDiagnosisFocus] = useState(false);
  const [grade, setGrade] = useState("");
  const [stageT, setStageT] = useState("");
  const [stageN, setStageN] = useState("");
  const [stageM, setStageM] = useState("");
  const [comments, setComments] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  /* Sign-off */
  const [criticalAcknowledged, setCriticalAcknowledged] = useState(false);
  const [signModal, setSignModal] = useState(false);
  const [signConfirm, setSignConfirm] = useState(false);
  const [signing, setSigning] = useState(false);
  const [banner, setBanner] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  /* UI */
  const [sideOpen, setSideOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"report" | "patient" | "audit">("report");

  /* ── Load pending-review queue (verified orders) ── */
  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    setQueueError("");
    try {
      const data = await getOrders();
      setOrders(data.filter((o) => o.status === "verified"));
    } catch {
      setOrders([]);
      setQueueError("Failed to load the pending review queue.");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const filteredQueue = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      `${o.patient.firstName} ${o.patient.lastName}`.toLowerCase().includes(q)
    );
  });

  /* ── Load selected case ── */
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    setCriticalAcknowledged(false);
    setSignConfirm(false);
    setDiagnosis("");
    setGrade("");
    setStageT("");
    setStageN("");
    setStageM("");
    setComments("");
    setDraftSavedAt(null);
    setMeasurePoints([]);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    getOrder(id)
      .then((d) => {
        if (!alive) return;
        setDetail(d as OrderDetail);
      })
      .catch(() => {
        if (alive) setDetailError("Failed to load this case. It may have moved in the queue.");
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const allTests = detail ? flatten(detail.tests) : [];
  const criticals = allTests.filter(isCritical);
  const hasCritical = criticals.length > 0;
  const locked = !!detail?.approvedAt;

  const suggestions = useMemo(() => {
    if (!diagnosis.trim()) return CAP_LEXICON.slice(0, 8);
    const q = diagnosis.toLowerCase();
    return CAP_LEXICON.filter((t) => t.toLowerCase().includes(q)).slice(0, 8);
  }, [diagnosis]);

  /* ── WSI canvas interaction ── */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool === "measure") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMeasurePoints((pts) => {
        if (pts.length >= 2) return [{ x, y }];
        return [...pts, { x, y }];
      });
      return;
    }
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const onPointerUp = () => setDragging(false);

  const measured = useMemo(() => {
    if (measurePoints.length < 2) return null;
    const [a, b] = measurePoints;
    const px = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    return { len: (px * 2.5).toFixed(1), px: Math.round(px) };
  }, [measurePoints]);

  const clearMeasure = () => setMeasurePoints([]);

  /* ── Actions ── */
  const saveDraft = () => {
    setDraftSavedAt(new Date().toISOString());
    setBanner(null);
  };

  const doSign = async () => {
    if (!detail) return;
    setSigning(true);
    setBanner(null);
    try {
      await approveOrder(detail.id);
      const d = await getOrder(detail.id);
      setDetail(d as OrderDetail);
      setSignModal(false);
      setSignConfirm(false);
      setBanner({
        tone: "success",
        text: `Report signed & released — ${detail.orderNumber} is locked and sent to the EHR.`,
      });
      await loadQueue();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
        "Sign-off failed. Only verified orders can be signed.";
      setBanner({ tone: "error", text: msg });
    } finally {
      setSigning(false);
    }
  };

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-100">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line-200 bg-surface-0 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-700 text-surface-0">
            <Stethoscope className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-ink-950">
                Pathologist Review & Sign-Off
              </h1>
              <span className="inline-flex items-center gap-1 rounded-sm border border-accent-200 bg-accent-100/60 px-2 py-0.5 text-[10px] font-medium text-accent-700">
                <ShieldCheck className="size-3" /> NABL · CLIA
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-ink-600">{todayLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-right sm:block">
            <span className="block text-[10px] uppercase tracking-wider text-ink-400">Signing</span>
            <span className="block text-xs font-semibold text-ink-950">
              Dr. {user?.firstName} {user?.lastName ?? ""}
            </span>
          </span>
          {detail && !locked && (
            <button
              onClick={() => setSignModal(true)}
              disabled={hasCritical && !criticalAcknowledged}
              className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 shadow-raised transition-colors duration-fast hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PenLine className="size-3.5" />
              Sign & Release
            </button>
          )}
          {detail && locked && (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-green-200 bg-green-50 px-2.5 py-1.5 text-[11px] font-semibold text-status-normal">
              <Lock className="size-3" /> Released · Locked
            </span>
          )}
        </div>
      </div>

      {/* ── Critical value banner ── */}
      {detail && hasCritical && (
        <div
          className={`flex shrink-0 flex-wrap items-center gap-3 border-b px-5 py-2.5 ${
            criticalAcknowledged
              ? "border-amber-200 bg-amber-50/60"
              : "border-red-200 bg-red-50"
          }`}
        >
          <AlertTriangle
            className={`size-4 shrink-0 ${criticalAcknowledged ? "text-amber-600" : "text-status-critical"}`}
          />
          <div className="min-w-0 flex-1 text-xs">
            <span className="font-semibold text-ink-950">
              {criticals.length} critical value{criticals.length > 1 ? "s" : ""} present
            </span>
            <span className="ml-2 text-ink-600">
              {criticals.map((c) => `${c.testName} ${c.result}`).join(" · ")}
            </span>
          </div>
          {!criticalAcknowledged ? (
            <button
              onClick={() => setCriticalAcknowledged(true)}
              className="inline-flex items-center gap-1.5 rounded-sm border border-status-critical bg-surface-0 px-3 py-1.5 text-[11px] font-semibold text-status-critical transition-colors duration-fast hover:bg-red-100"
            >
              <CheckCircle2 className="size-3" /> Acknowledge & Proceed
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-normal">
              <CheckCircle2 className="size-3" /> Acknowledged — {fmtTime(new Date().toISOString())}
            </span>
          )}
        </div>
      )}

      {banner && (
        <div
          className={`flex shrink-0 items-center gap-2 border-b px-5 py-2 text-xs font-medium ${
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

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* ═══ LEFT: Pending review list ═══ */}
        <aside
          className={`shrink-0 border-r border-line-200 bg-surface-0 transition-[width] duration-180 ease-precise ${
            sideOpen ? "w-64" : "w-10"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-line-200 px-3 py-2.5">
              {sideOpen && (
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search cases…"
                    className="h-8 w-full rounded-md border border-line-300 bg-surface-0 pl-8 pr-2 text-xs transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100"
                  />
                </div>
              )}
              <button
                onClick={() => setSideOpen((o) => !o)}
                className="shrink-0 rounded-sm p-1 text-ink-400 transition-colors duration-fast hover:bg-surface-100 hover:text-ink-950"
                title={sideOpen ? "Collapse" : "Expand"}
              >
                {sideOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
              </button>
            </div>

            {sideOpen && (
              <div className="flex min-h-0 flex-1 flex-col">
                {loadingQueue ? (
                  <LoadingState label="Loading cases…" rows={4} />
                ) : queueError ? (
                  <ErrorState message={queueError} onRetry={loadQueue} />
                ) : filteredQueue.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                    <BadgeCheck className="size-8 text-status-normal/70" />
                    <p className="text-sm font-medium text-ink-950">No cases pending review</p>
                    <p className="text-xs text-ink-600">
                      Verified slides appear here after technician confirmation.
                    </p>
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 divide-y divide-line-200 overflow-y-auto">
                    {filteredQueue.map((order) => {
                      const active = order.id === id;
                      const tests = flatten(order.tests as unknown as TestChild[]);
                      const crit = tests.some(isCritical);
                      return (
                        <button
                          key={order.id}
                          onClick={() => navigate(`/approvals/${order.id}`)}
                          className={`flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors duration-fast hover:bg-surface-100 ${
                            active ? "border-l-2 border-accent-500 bg-accent-100/40" : ""
                          }`}
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-100 text-[11px] font-bold text-accent-700">
                            {order.patient.firstName.charAt(0)}
                            {order.patient.lastName?.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-medium text-ink-950">
                                {order.patient.firstName} {order.patient.lastName}
                              </span>
                              {crit && (
                                <span className="shrink-0 rounded-sm bg-red-50 px-1 py-px text-[8px] font-bold text-status-critical">
                                  CRIT
                                </span>
                              )}
                            </div>
                            <div className="data-mono mt-0.5 text-[10px] text-ink-500">
                              {order.orderNumber}
                            </div>
                          </div>
                          <div className="data-mono shrink-0 text-[9px] text-ink-400">
                            {fmtDate(order.createdAt)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ═══ CENTER: WSI viewer ═══ */}
        <main className="flex min-w-0 flex-1 flex-col bg-ink-950">
          {/* Toolbar */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-800 bg-ink-950 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="flex size-8 items-center justify-center rounded-sm border border-ink-700 text-surface-0/80 transition-colors duration-fast hover:border-accent-500 hover:text-surface-0"
                aria-label="Zoom out"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="data-mono w-14 text-center text-xs font-medium text-surface-0">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                className="flex size-8 items-center justify-center rounded-sm border border-ink-700 text-surface-0/80 transition-colors duration-fast hover:border-accent-500 hover:text-surface-0"
                aria-label="Zoom in"
              >
                <Plus className="size-3.5" />
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="flex size-8 items-center justify-center rounded-sm border border-ink-700 text-surface-0/80 transition-colors duration-fast hover:border-accent-500 hover:text-surface-0"
                aria-label="Fit view"
                title="Fit view"
              >
                <Maximize2 className="size-3.5" />
              </button>
            </div>

            <div className="mx-1 h-5 w-px bg-ink-800" />

            {/* Tools */}
            <button
              onClick={() => setTool("cursor")}
              className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-fast ${
                tool === "cursor"
                  ? "border-accent-500 bg-accent-700 text-surface-0"
                  : "border-ink-700 text-surface-0/70 hover:text-surface-0"
              }`}
            >
              <Move className="size-3" /> Pan
            </button>
            <button
              onClick={() => {
                setTool(tool === "measure" ? "cursor" : "measure");
                setMeasurePoints([]);
              }}
              className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-fast ${
                tool === "measure"
                  ? "border-accent-500 bg-accent-700 text-surface-0"
                  : "border-ink-700 text-surface-0/70 hover:text-surface-0"
              }`}
            >
              <Ruler className="size-3" /> Measure
            </button>
            <button
              onClick={() => setDeconvolve((d) => !d)}
              className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-fast ${
                deconvolve
                  ? "border-accent-500 bg-accent-700 text-surface-0"
                  : "border-ink-700 text-surface-0/70 hover:text-surface-0"
              }`}
            >
              <Paintbrush className="size-3" /> Deconvolve
            </button>
            <button
              onClick={() => setSplitView((s) => !s)}
              className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-fast ${
                splitView
                  ? "border-accent-500 bg-accent-700 text-surface-0"
                  : "border-ink-700 text-surface-0/70 hover:text-surface-0"
              }`}
            >
              <Columns2 className="size-3" /> H&E + IHC
            </button>

            {tool === "measure" && (
              <>
                <div className="mx-1 h-5 w-px bg-ink-800" />
                <span className="text-[10px] text-surface-0/60">
                  Click two points to measure {measured ? `— ${measured.len} µm` : ""}
                </span>
                {measurePoints.length > 0 && (
                  <button
                    onClick={clearMeasure}
                    className="rounded-sm px-1.5 py-1 text-[10px] text-red-300 transition-colors duration-fast hover:text-red-400"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>

          {/* Canvas */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              className={`absolute inset-0 cursor-${tool === "measure" ? "crosshair" : dragging ? "grabbing" : "grab"}`}
            >
              {splitView ? (
                <div className="flex h-full w-full">
                  {/* H&E */}
                  <div className="relative h-full w-1/2 border-r border-ink-700">
                    <TissueSchematic deconvolve={deconvolve} zoom={zoom} pan={pan} stain="he" />
                    <span className="absolute left-2 top-2 rounded-sm bg-ink-950/70 px-1.5 py-0.5 text-[9px] font-medium text-surface-0/80">
                      H&E · 40×
                    </span>
                  </div>
                  {/* IHC */}
                  <div className="relative h-full w-1/2">
                    <TissueSchematic deconvolve={deconvolve} zoom={zoom} pan={pan} stain="ihc" />
                    <span className="absolute left-2 top-2 rounded-sm bg-ink-950/70 px-1.5 py-0.5 text-[9px] font-medium text-surface-0/80">
                      IHC · 40×
                    </span>
                  </div>
                </div>
              ) : (
                <TissueSchematic deconvolve={deconvolve} zoom={zoom} pan={pan} stain="he" />
              )}

              {/* Measurement overlay */}
              {measurePoints.length === 1 && (
                <span
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300"
                  style={{ left: measurePoints[0].x, top: measurePoints[0].y }}
                />
              )}
              {measurePoints.length === 2 && measured && (
                <>
                  <svg className="pointer-events-none absolute inset-0 h-full w-full">
                    <line
                      x1={measurePoints[0].x}
                      y1={measurePoints[0].y}
                      x2={measurePoints[1].x}
                      y2={measurePoints[1].y}
                      stroke="#fcd34d"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                    {measurePoints.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="4" fill="#fcd34d" stroke="#0e4f52" strokeWidth="1" />
                    ))}
                  </svg>
                  <span className="pointer-events-none absolute rounded-sm bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-ink-950"
                    style={{
                      left: (measurePoints[0].x + measurePoints[1].x) / 2,
                      top: Math.min(measurePoints[0].y, measurePoints[1].y) - 22,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {measured.len} µm
                  </span>
                </>
              )}
            </div>

            {/* HUD — bottom-left metadata */}
            <div className="pointer-events-none absolute bottom-2.5 left-3 flex items-center gap-3 data-mono text-[10px] text-surface-0/60">
              <span>{detail ? slideId(detail.id) : "SLD-······"}</span>
              <span>40×</span>
              <span>{zoom.toFixed(2)}×</span>
            </div>
            <div className="pointer-events-none absolute bottom-2.5 right-3 rounded-sm bg-ink-950/80 px-1.5 py-0.5 text-[9px] text-amber-200">
              Schematic WSI — connect scanner for live whole-slide image
            </div>
          </div>
        </main>

        {/* ═══ RIGHT: Report / Patient / Audit ═══ */}
        <aside className="flex w-[340px] shrink-0 flex-col border-l border-line-200 bg-surface-0">
          {/* Tabs */}
          <div className="flex shrink-0 items-center border-b border-line-200">
            {(
              [
                { key: "report", label: "Report", icon: FileText },
                { key: "patient", label: "Patient", icon: User },
                { key: "audit", label: "Audit", icon: History },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setRightTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-[11px] font-semibold transition-colors duration-fast ${
                  rightTab === tab.key
                    ? "border-accent-700 text-accent-700"
                    : "border-transparent text-ink-500 hover:text-ink-950"
                }`}
              >
                <tab.icon className="size-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {detailLoading ? (
              <LoadingState label="Loading case…" rows={5} />
            ) : detailError ? (
              <div className="p-4">
                <ErrorState message={detailError} onRetry={() => navigate(`/approvals/${id}`)} />
              </div>
            ) : detail ? (
              <>
                {/* ── REPORT TAB ── */}
                {rightTab === "report" && (
                  <div className="space-y-4 p-4">
                    {locked && (
                      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-[11px] font-medium text-status-normal">
                        <Lock className="size-3.5 shrink-0" />
                        Report is released and locked — no further edits allowed.
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                        Diagnosis <span className="text-status-critical">*</span>
                      </label>
                      <div className="relative">
                        <textarea
                          value={diagnosis}
                          onChange={(e) => setDiagnosis(e.target.value)}
                          onFocus={() => setDiagnosisFocus(true)}
                          onBlur={() => setTimeout(() => setDiagnosisFocus(false), 150)}
                          disabled={locked}
                          rows={3}
                          placeholder="Select from CAP lexicon or type…"
                          className="w-full resize-none rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-sm transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100 disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-ink-400"
                        />
                        {diagnosisFocus && !locked && (
                          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-md border border-line-200 bg-surface-0 shadow-overlay">
                            {suggestions.map((s) => (
                              <button
                                key={s}
                                onMouseDown={() => setDiagnosis(s)}
                                className="block w-full px-3 py-2 text-left text-xs text-ink-700 transition-colors duration-fast hover:bg-accent-100/50 hover:text-accent-700"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-ink-400">
                        Auto-suggested from the CAP structured lexicon
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                          Grade
                        </label>
                        <select
                          value={grade}
                          onChange={(e) => setGrade(e.target.value)}
                          disabled={locked}
                          className="h-9 w-full rounded-md border border-line-300 bg-surface-0 px-2 text-xs transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100 disabled:bg-surface-100"
                        >
                          <option value="">—</option>
                          <option>G1 — well differentiated</option>
                          <option>G2 — moderately differentiated</option>
                          <option>G3 — poorly differentiated</option>
                          <option>GX — cannot be assessed</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                          Stage T
                        </label>
                        <select
                          value={stageT}
                          onChange={(e) => setStageT(e.target.value)}
                          disabled={locked}
                          className="h-9 w-full rounded-md border border-line-300 bg-surface-0 px-2 text-xs transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100 disabled:bg-surface-100"
                        >
                          <option value="">—</option>
                          <option>pTis</option>
                          <option>pT1</option>
                          <option>pT2</option>
                          <option>pT3</option>
                          <option>pT4</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                          Node
                        </label>
                        <select
                          value={stageN}
                          onChange={(e) => setStageN(e.target.value)}
                          disabled={locked}
                          className="h-9 w-full rounded-md border border-line-300 bg-surface-0 px-2 text-xs transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100 disabled:bg-surface-100"
                        >
                          <option value="">—</option>
                          <option>pN0</option>
                          <option>pN1</option>
                          <option>pN2</option>
                          <option>pN3</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                        Metastasis
                      </label>
                      <select
                        value={stageM}
                        onChange={(e) => setStageM(e.target.value)}
                        disabled={locked}
                        className="h-9 w-full rounded-md border border-line-300 bg-surface-0 px-2 text-xs transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100 disabled:bg-surface-100"
                      >
                        <option value="">—</option>
                        <option>pM0</option>
                        <option>pM1</option>
                        <option>pMX — cannot be assessed</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                        Comments
                      </label>
                      <textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        disabled={locked}
                        rows={3}
                        placeholder="Additional findings, IHC correlation, margin status…"
                        className="w-full resize-none rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-xs transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100 disabled:bg-surface-100 disabled:text-ink-400"
                      />
                    </div>

                    {!locked && (
                      <div className="flex items-center gap-2 border-t border-line-200 pt-3">
                        <button
                          onClick={saveDraft}
                          className="inline-flex items-center gap-1.5 rounded-sm border border-line-300 px-3 py-1.5 text-[11px] font-medium text-ink-600 transition-colors duration-fast hover:border-accent-500 hover:text-accent-700"
                        >
                          <PenLine className="size-3" /> Save Draft
                        </button>
                        {draftSavedAt && (
                          <span className="text-[10px] text-ink-400">
                            Draft saved {fmtTime(draftSavedAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── PATIENT TAB ── */}
                {rightTab === "patient" && (
                  <div className="space-y-4 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-bold text-accent-700">
                        {detail.patient.firstName.charAt(0)}
                        {detail.patient.lastName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold text-ink-950">
                            {detail.patient.title ? `${detail.patient.title} ` : ""}
                            {detail.patient.firstName} {detail.patient.lastName}
                          </h3>
                          {detail.emergency && (
                            <span className="rounded-sm bg-red-50 px-1.5 py-0.5 text-[9px] font-medium text-status-critical">
                              EMERGENCY
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-ink-600">
                          <span className="data-mono font-medium text-accent-700">{detail.orderNumber}</span>
                        </p>
                      </div>
                    </div>

                    <dl className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-ink-400">Date of birth</dt>
                        <dd className="font-medium text-ink-950">{fmtDate(detail.patient.dateOfBirth)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-ink-400">Gender</dt>
                        <dd className="font-medium capitalize text-ink-950">{detail.patient.gender ?? "—"}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-ink-400">Phone</dt>
                        <dd className="flex items-center gap-1 font-medium text-ink-950">
                          <Phone className="size-3" /> {detail.patient.phone ?? "—"}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-ink-400">Registered</dt>
                        <dd className="font-medium text-ink-950">{fmtDate(detail.createdAt)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-ink-400">Verified by</dt>
                        <dd className="font-medium text-ink-950">
                          {detail.verifiedByUser?.name ?? "—"}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-ink-400">Clinical remarks</dt>
                        <dd className="text-right text-ink-700">{detail.clinicalRemarks ?? "—"}</dd>
                      </div>
                    </dl>

                    <div>
                      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                        Results ({allTests.length})
                      </h4>
                      <div className="max-h-56 overflow-y-auto rounded-md border border-line-200">
                        <table className="w-full text-xs">
                          <tbody className="divide-y divide-line-200">
                            {allTests.map((t) => {
                              const flag = getFlag(t.result, t.refLow, t.refHigh);
                              const crit = isCritical(t);
                              return (
                                <tr key={t.id} className="hover:bg-surface-100">
                                  <td className="px-2.5 py-1.5 text-ink-700">{t.testName}</td>
                                  <td
                                    className={`data-mono px-2.5 py-1.5 text-right font-medium ${
                                      crit ? "text-status-critical" : "text-ink-950"
                                    }`}
                                  >
                                    {t.result ?? "—"}
                                    {flag && <span className="ml-0.5">{flag.icon}</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── AUDIT TAB ── */}
                {rightTab === "audit" && (
                  <div className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-ink-950">
                        <History className="size-3.5 text-accent-700" /> Immutable Audit Trail
                      </h3>
                      <span className="text-[9px] uppercase tracking-wider text-ink-400">
                        Read-only
                      </span>
                    </div>
                    <ol className="space-y-3">
                      <AuditEntry
                        icon={<Calendar className="size-3" />}
                        tone="accent"
                        title="Case registered"
                        meta={`${fmtDate(detail.createdAt)} ${fmtTime(detail.createdAt)} · ${detail.orderNumber}`}
                      />
                      <AuditEntry
                        icon={<FlaskConical className="size-3" />}
                        tone="green"
                        title="Results completed by technician"
                        meta={`${allTests.length} result${allTests.length === 1 ? "" : "s"} entered`}
                      />
                      {detail.verifiedByUser && (
                        <AuditEntry
                          icon={<BadgeCheck className="size-3" />}
                          tone="accent"
                          title={`Verified by ${detail.verifiedByUser.name}`}
                          meta={`${fmtDate(detail.verifiedAt)} ${fmtTime(detail.verifiedAt)}`}
                        />
                      )}
                      <AuditEntry
                        icon={<Eye className="size-3" />}
                        tone="ink"
                        title={`Opened for review by Dr. ${user?.firstName} ${user?.lastName ?? ""}`}
                        meta="Current session"
                      />
                      {draftSavedAt && (
                        <AuditEntry
                          icon={<PenLine className="size-3" />}
                          tone="ink"
                          title="Report draft saved"
                          meta={`${fmtDate(draftSavedAt)} ${fmtTime(draftSavedAt)}`}
                        />
                      )}
                      {hasCritical && (
                        <AuditEntry
                          icon={<AlertTriangle className="size-3" />}
                          tone="red"
                          title={`Critical value${criticals.length > 1 ? "s" : ""} acknowledged`}
                          meta={criticalAcknowledged ? "Acknowledged this session" : "Not yet acknowledged"}
                        />
                      )}
                      {detail.approvedAt && (
                        <AuditEntry
                          icon={<Lock className="size-3" />}
                          tone="green"
                          title={`Signed & released${detail.approvedBy ? ` by ${detail.approvedBy}` : ""}`}
                          meta={`${fmtDate(detail.approvedAt)} ${fmtTime(detail.approvedAt)} · locked & sent to EHR`}
                        />
                      )}
                    </ol>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <Stethoscope className="size-8 text-line-300" />
                <p className="text-sm font-medium text-ink-950">Select a case</p>
                <p className="text-xs text-ink-600">Choose a case from the pending review list.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Sign-off modal ── */}
      {signModal && detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4"
          onClick={() => !signing && setSignModal(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-accent-700 text-surface-0">
                  <PenLine className="size-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-ink-950">Final Review & Sign-Off</h2>
                  <p className="mt-0.5 text-xs text-ink-600">
                    <span className="data-mono font-medium text-accent-700">{detail.orderNumber}</span>
                    {` · ${detail.patient.firstName} ${detail.patient.lastName}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !signing && setSignModal(false)}
                className="rounded-sm p-1.5 text-ink-400 transition-colors duration-fast hover:bg-surface-100 hover:text-ink-950"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
              <dl className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-400">Tests in case</dt>
                  <dd className="data-mono font-semibold text-ink-950">{allTests.length}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-400">Critical values</dt>
                  <dd
                    className={`data-mono font-semibold ${
                      criticals.length > 0 ? "text-status-critical" : "text-status-normal"
                    }`}
                  >
                    {criticals.length}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-400">Diagnosis</dt>
                  <dd className="max-w-[60%] truncate font-medium text-ink-950">
                    {diagnosis || "— not entered —"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-400">Grade</dt>
                  <dd className="font-medium text-ink-950">{grade || "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-400">Stage</dt>
                  <dd className="font-medium text-ink-950">
                    {[stageT, stageN, stageM].filter(Boolean).join(" ") || "—"}
                  </dd>
                </div>
              </dl>

              {hasCritical && !criticalAcknowledged && (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] font-medium text-status-critical">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Critical values must be acknowledged before sign-off (CLIA).
                </div>
              )}

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-md border border-line-200 bg-surface-100/60 px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={signConfirm}
                  onChange={(e) => setSignConfirm(e.target.checked)}
                  disabled={hasCritical && !criticalAcknowledged}
                  className="mt-0.5 size-4 shrink-0 rounded-sm border-line-300 accent-accent-700"
                />
                <span className="text-xs leading-relaxed text-ink-700">
                  <span className="font-semibold text-ink-950">I confirm I have reviewed this case.</span>{" "}
                  Signing locks the report, transmits it to the EHR, and makes it legally defensible.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line-200 bg-surface-100 px-6 py-3">
              <span className="flex items-center gap-1.5 text-[11px] text-ink-600">
                <ShieldCheck className="size-3.5 text-accent-700" />
                Timestamped & user-stamped — immutable after release
              </span>
              <button
                onClick={doSign}
                disabled={!signConfirm || signing || (hasCritical && !criticalAcknowledged)}
                className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-5 py-2.5 text-xs font-semibold text-surface-0 shadow-raised transition-colors duration-fast hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {signing ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
                {signing ? "Signing…" : "Sign & Release"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Audit entry helper ───────────────────────────────────────── */

function AuditEntry({
  icon,
  tone,
  title,
  meta,
}: {
  icon: React.ReactNode;
  tone: "accent" | "green" | "red" | "ink";
  title: string;
  meta: string;
}) {
  const tones: Record<string, string> = {
    accent: "bg-accent-100 text-accent-700",
    green: "bg-green-50 text-status-normal",
    red: "bg-red-50 text-status-critical",
    ink: "bg-surface-100 text-ink-500",
  };
  return (
    <li className="flex items-start gap-3">
      <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-ink-950">{title}</div>
        <div className="data-mono mt-0.5 text-[10px] text-ink-400">{meta}</div>
      </div>
    </li>
  );
}
