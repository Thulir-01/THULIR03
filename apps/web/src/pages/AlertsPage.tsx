import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  AlertTriangle,
  AlertCircle,
  Info,
  Wrench,
  Package,
  FlaskConical,
  Activity,
  Check,
  CheckCheck,
  X,
  Clock,
  MessageSquare,
  Eye,
  Inbox,
  ShieldAlert,
  User,
} from "lucide-react";
import { getInventoryAlerts } from "../lib/api-client";
import {
  loadExtraAlerts,
  type AlertComment,
  type AlertItem,
  type AlertKind,
  type AlertStatus,
  type QcSeries,
  type Severity,
} from "../lib/alerts-store";
import { useAuth } from "../lib/useAuth";
import PageHeader from "../components/ui/PageHeader";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";

// ─── Persistence (localStorage — demo layer for non-server-backed alerts) ──

const STATUS_KEY = "thulir03-alerts-status";
const COMMENTS_KEY = "thulir03-alerts-comments";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
  }
}

type StatusMap = Record<string, AlertStatus>;
type CommentsMap = Record<string, AlertComment[]>;

// ─── Time helpers ─────────────────────────────────────────────────────────

function ageLabel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60e3) return "just now";
  const mins = Math.floor(diff / 60e3);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ago`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

const ALL_ROLES = ["technician", "pathologist", "lab_admin", "lab_manager"];

// ─── Demo alerts (QC/system — QC module is a later sprint; clearly labeled) ─

function buildDemoAlerts(now: number): AlertItem[] {
  const h = 3600e3;
  const m = 60e3;
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

  // Glucose Low Control run series — one point punches through ±3 SD.
  const base: number[] = [101, 103, 99, 102, 104, 100, 101, 98, 103, 102, 100, 99, 101, 100, 112, 103, 102, 101];
  const history = [99, 101, 100, 102, 98, 101, 100, 99, 102, 101];

  return [
    {
      id: "demo-qc-1-3s",
      severity: "critical",
      kind: "qc",
      status: "unread",
      title: "QC Failure: Glucose Low Control",
      detail:
        "1:3s breach on Analyzer 2 — one control point exceeded ±3 SD. Run must be reviewed before sign-off.",
      analyzer: "Sysmex XN-1000 (A2)",
      lot: "LOT-A123",
      rule: "1:3s",
      test: "Glucose · Low Control",
      createdAt: iso(2 * h + 12 * m),
      roles: ALL_ROLES,
      demo: true,
      qc: { mean: 102, sd: 3.2, unit: "mg/dL", points: base, flaggedIndex: 14 },
      history,
    },
    {
      id: "demo-system-offline",
      severity: "critical",
      kind: "maintenance",
      status: "in_progress",
      title: "System Offline: XN-1000 Hematology",
      detail:
        "Heartbeat lost on Analyzer 1 — no instrument messages for 18 minutes. Pending runs are queued.",
      analyzer: "Sysmex XN-1000 (A1)",
      createdAt: iso(3 * h + 5 * m),
      roles: ["technician", "lab_admin", "lab_manager"],
      demo: true,
    },
    {
      id: "demo-qc-2-2s",
      severity: "warning",
      kind: "qc",
      status: "unread",
      title: "QC Trend: 2:2s on Potassium",
      detail:
        "Two consecutive points on the same side of the mean beyond ±2 SD — trending, not yet out of control.",
      analyzer: "Roche Cobas c501",
      lot: "LOT-B221",
      rule: "2:2s",
      test: "Potassium · Level 1",
      createdAt: iso(55 * m),
      roles: ALL_ROLES,
      demo: true,
      qc: { mean: 4.1, sd: 0.12, unit: "mmol/L", points: [4.05, 4.1, 4.28, 4.24, 4.31, 4.08, 4.12, 4.26, 4.29, 4.22], flaggedIndex: 8 },
      history: [4.08, 4.11, 4.09, 4.12, 4.3, 4.26, 4.31],
    },
    {
      id: "demo-sigma-drop",
      severity: "warning",
      kind: "qc",
      status: "unread",
      title: "Sigma Metric Drop: HbA1c",
      detail: "Sigma fell to 3.1 (target ≥ 4.0). Review bias/CV contribution before next run batch.",
      analyzer: "Tosoh G8",
      test: "HbA1c",
      createdAt: iso(3 * h + 40 * m),
      roles: ["pathologist", "lab_admin", "lab_manager"],
      demo: true,
    },
    {
      id: "demo-cal-due",
      severity: "warning",
      kind: "maintenance",
      status: "acknowledged",
      title: "Calibration Due: Electrolyte Module",
      detail: "Calibration overdue by 1 day — results may be flagged until recalibrated.",
      analyzer: "Roche Cobas c501",
      createdAt: iso(26 * h),
      roles: ALL_ROLES,
      demo: true,
    },
    {
      id: "demo-signoff-fail",
      severity: "warning",
      kind: "system",
      status: "unread",
      title: "Sign-off Failure: Order THL-10429",
      detail: "Electronic signature could not be captured — pathologist must re-authenticate to sign off.",
      createdAt: iso(4 * h + 20 * m),
      roles: ["pathologist", "lab_admin", "lab_manager"],
      demo: true,
    },
    {
      id: "demo-info-user",
      severity: "info",
      kind: "info",
      status: "unread",
      title: "New User Added",
      detail: "A new staff account was created with the Lab Technician role and an invitation was sent.",
      createdAt: iso(40 * m),
      roles: ALL_ROLES,
      demo: true,
    },
    {
      id: "demo-info-summary",
      severity: "info",
      kind: "info",
      status: "acknowledged",
      title: "Daily Summary Generated",
      detail: "342 tests processed · 3 pending verification · 2 awaiting sign-off · revenue ₹1,84,500.",
      createdAt: iso(8 * h),
      roles: ALL_ROLES,
      demo: true,
    },
  ];
}

// ─── Real inventory alerts (from /inventory/alerts) ───────────────────────

function buildInventoryAlerts(
  inv: { lowStock: { id: string; name: string; sku: string; unit: string | null; quantityOnHand: number; minStock: number }[]; expiring: { id: string; itemId: string; itemName: string; sku: string; batchNo: string | null; expiryDate: string }[]; expired: { id: string; itemId: string; itemName: string; sku: string; batchNo: string | null; expiryDate: string }[] },
): AlertItem[] {
  const items: AlertItem[] = [];
  for (const e of inv.expired) {
    items.push({
      id: `inv-expired-${e.id}`,
      severity: "critical",
      kind: "inventory",
      status: "unread",
      title: `Reagent Expired: ${e.itemName}`,
      detail: `Batch ${e.batchNo ?? e.sku} expired on ${new Date(e.expiryDate).toLocaleDateString("en-IN")} — do not use.`,
      lot: e.batchNo ?? e.sku,
      createdAt: new Date().toISOString(),
      roles: ALL_ROLES,
      demo: false,
    });
  }
  for (const e of inv.expiring) {
    items.push({
      id: `inv-expiring-${e.id}`,
      severity: "warning",
      kind: "inventory",
      status: "unread",
      title: `Reagent Expiry Soon: ${e.itemName}`,
      detail: `Batch ${e.batchNo ?? e.sku} expires ${new Date(e.expiryDate).toLocaleDateString("en-IN")} — within 30 days.`,
      lot: e.batchNo ?? e.sku,
      createdAt: new Date().toISOString(),
      roles: ALL_ROLES,
      demo: false,
    });
  }
  for (const i of inv.lowStock) {
    items.push({
      id: `inv-low-${i.id}`,
      severity: "warning",
      kind: "inventory",
      status: "unread",
      title: `Low Stock: ${i.name}`,
      detail: `On hand ${i.quantityOnHand} ${i.unit ?? "units"} · minimum ${i.minStock} — reorder soon.`,
      createdAt: new Date().toISOString(),
      roles: ALL_ROLES,
      demo: false,
    });
  }
  return items;
}

// ─── Severity / status meta ───────────────────────────────────────────────

const SEVERITY_META: Record<Severity, { label: string; chip: string; icon: typeof AlertTriangle; strip: string; dot: string }> = {
  critical: {
    label: "Critical",
    chip: "bg-red-50 text-red-700 border-red-200",
    icon: AlertTriangle,
    strip: "bg-status-critical",
    dot: "bg-status-critical",
  },
  warning: {
    label: "Warning",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    icon: AlertCircle,
    strip: "bg-amber-400",
    dot: "bg-amber-400",
  },
  info: {
    label: "Info",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Info,
    strip: "bg-blue-500",
    dot: "bg-blue-500",
  },
};

const STATUS_META: Record<AlertStatus, { label: string; chip: string }> = {
  unread: { label: "Unread", chip: "bg-surface-100 text-ink-700 border-line-200 font-semibold" },
  in_progress: { label: "In Progress", chip: "bg-violet-50 text-violet-700 border-violet-200" },
  acknowledged: { label: "Acknowledged", chip: "bg-sky-50 text-sky-700 border-sky-200" },
  resolved: { label: "Resolved", chip: "bg-green-50 text-green-700 border-green-200" },
};

const KIND_LABEL: Record<AlertKind, string> = {
  qc: "QC",
  maintenance: "Maintenance",
  inventory: "Inventory",
  system: "System",
  info: "Info",
};

// ─── SLA escalation ───────────────────────────────────────────────────────

const SLA_MS = 2 * 3600e3;

function isEscalated(item: AlertItem) {
  if (item.status === "resolved" || item.status === "acknowledged") return false;
  return Date.now() - new Date(item.createdAt).getTime() > SLA_MS;
}

// ─── QC plot (Levey-Jennings) ─────────────────────────────────────────────

function QcPlot({ qc }: { qc: QcSeries }) {
  const W = 560;
  const H = 210;
  const PAD = 12;
  const n = qc.points.length;
  const { mean, sd } = qc;
  const maxV = mean + 3.6 * sd;
  const minV = mean - 3.6 * sd;
  const x = (i: number) => PAD + (i / Math.max(n - 1, 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - minV) / (maxV - minV)) * (H - 2 * PAD);

  const line = (level: number) =>
    qc.points.map((_, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(mean + level * sd).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Levey-Jennings control chart">
      {/* ±3s band */}
      <rect x={PAD} y={y(mean + 3 * sd)} width={W - 2 * PAD} height={y(mean - 3 * sd) - y(mean + 3 * sd)} fill="#fef2f2" />
      {/* ±2s band */}
      <rect x={PAD} y={y(mean + 2 * sd)} width={W - 2 * PAD} height={y(mean - 2 * sd) - y(mean + 2 * sd)} fill="#fffbeb" />
      {/* ±1s band */}
      <rect x={PAD} y={y(mean + 1 * sd)} width={W - 2 * PAD} height={y(mean - 1 * sd) - y(mean + 1 * sd)} fill="#f8fafc" />
      {/* lines */}
      <line x1={PAD} x2={W - PAD} y1={y(mean)} y2={y(mean)} stroke="#334155" strokeWidth={1.5} />
      <line x1={PAD} x2={W - PAD} y1={y(mean + sd)} y2={y(mean + sd)} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2 3" />
      <line x1={PAD} x2={W - PAD} y1={y(mean - sd)} y2={y(mean - sd)} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2 3" />
      <line x1={PAD} x2={W - PAD} y1={y(mean + 2 * sd)} y2={y(mean + 2 * sd)} stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 4" />
      <line x1={PAD} x2={W - PAD} y1={y(mean - 2 * sd)} y2={y(mean - 2 * sd)} stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 4" />
      <line x1={PAD} x2={W - PAD} y1={y(mean + 3 * sd)} y2={y(mean + 3 * sd)} stroke="#dc2626" strokeWidth={1.2} strokeDasharray="6 4" />
      <line x1={PAD} x2={W - PAD} y1={y(mean - 3 * sd)} y2={y(mean - 3 * sd)} stroke="#dc2626" strokeWidth={1.2} strokeDasharray="6 4" />
      {/* labels */}
      {[
        { lvl: 3, label: `+3 SD (${(mean + 3 * sd).toFixed(1)})`, color: "#dc2626" },
        { lvl: 2, label: `+2 SD (${(mean + 2 * sd).toFixed(1)})`, color: "#b45309" },
        { lvl: 0, label: `Mean (${mean.toFixed(1)})`, color: "#334155" },
        { lvl: -2, label: `−2 SD (${(mean - 2 * sd).toFixed(1)})`, color: "#b45309" },
        { lvl: -3, label: `−3 SD (${(mean - 3 * sd).toFixed(1)})`, color: "#dc2626" },
      ].map((l) => (
        <text key={l.lvl} x={W - PAD - 2} y={y(mean + l.lvl * sd) - 3} textAnchor="end" fontSize={10} fill={l.color} fontWeight={l.lvl === 0 ? 700 : 500}>
          {l.label}
        </text>
      ))}
      {/* control line */}
      <path d={line(0)} fill="none" stroke="#0f766e" strokeWidth={1.6} />
      {/* points */}
      {qc.points.map((p, i) =>
        i === qc.flaggedIndex ? (
          <g key={i}>
            <circle cx={x(i)} cy={y(p)} r={5.5} fill="#dc2626" opacity={0.25} />
            <circle cx={x(i)} cy={y(p)} r={3.5} fill="#dc2626" stroke="#fff" strokeWidth={1.2} />
          </g>
        ) : (
          <circle key={i} cx={x(i)} cy={y(p)} r={2.4} fill="#0f766e" opacity={0.8} />
        ),
      )}
      {qc.flaggedIndex >= 0 && (
        <text x={x(qc.flaggedIndex)} y={y(qc.points[qc.flaggedIndex]) - 9} textAnchor="middle" fontSize={11} fontWeight={800} fill="#dc2626">
          1:3s
        </text>
      )}
    </svg>
  );
}

function TrendSpark({ values }: { values: number[] }) {
  const W = 560;
  const H = 56;
  const PAD = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / Math.max(values.length - 1, 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Previous run trend">
      <path d={d} fill="none" stroke="#0f766e" strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={x(last)} cy={y(values[last])} r={3} fill="#0f766e" />
    </svg>
  );
}

// ─── Alert card ───────────────────────────────────────────────────────────

function AlertCard({
  item,
  selected,
  onToggle,
  onOpen,
  onAction,
}: {
  item: AlertItem;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onAction: (action: string) => void;
}) {
  const meta = SEVERITY_META[item.severity];
  const stMeta = STATUS_META[item.status];
  const Icon = meta.icon;
  const escalated = isEscalated(item);

  return (
    <div
      className={`group relative overflow-hidden rounded-md border bg-surface-0 shadow-raised transition-all duration-fast hover:-translate-y-px hover:shadow-overlay ${
        item.severity === "critical" ? "border-red-200" : "border-line-200"
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${meta.strip}`} />
      <div className="flex items-start gap-3 p-4 pl-5">
        <label className="mt-0.5 flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="size-4 cursor-pointer rounded border-line-300 accent-[#0f766e]"
          />
        </label>
        <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md ${meta.chip}`}>
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[13px] font-semibold leading-snug text-ink-950">{item.title}</p>
            {escalated && (
              <span className="inline-flex items-center gap-1 rounded-full border border-status-critical bg-red-50 px-1.5 py-px text-[10px] font-bold text-status-critical">
                <BellRing className="size-3 animate-pulse" /> SLA · Escalated
              </span>
            )}
            {item.demo && (
              <span className="rounded-full border border-line-200 bg-surface-100 px-1.5 py-px text-[10px] font-medium text-ink-400">
                demo
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-600">{item.detail}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
            {item.analyzer && (
              <span className="inline-flex items-center gap-1">
                <FlaskConical className="size-3" /> {item.analyzer}
              </span>
            )}
            {item.lot && <span className="data-mono">{item.lot}</span>}
            {item.rule && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-red-50 px-1.5 py-px font-mono text-[10px] font-semibold text-status-critical">
                {item.rule}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {ageLabel(item.createdAt)}
            </span>
            <span className={`rounded-full border px-1.5 py-px text-[10px] font-medium ${stMeta.chip}`}>
              {stMeta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-line-200 bg-surface-100/50 px-4 py-2.5 pl-5">
        {item.kind === "qc" && (
          <>
            <button
              onClick={onOpen}
              className="inline-flex items-center gap-1.5 rounded-md bg-status-critical px-3 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-red-700"
            >
              <Eye className="size-3.5" /> Review &amp; Sign-Off
            </button>
            <button
              onClick={() => onAction("reject")}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100"
            >
              Reject Run
            </button>
          </>
        )}
        {item.kind === "maintenance" && (
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
          >
            <Wrench className="size-3.5" /> Schedule Service
          </button>
        )}
        {item.kind === "inventory" && (
          <button
            onClick={() => onAction("order")}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
          >
            <Package className="size-3.5" /> Order Reagent
          </button>
        )}
        {item.kind === "system" && (
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
          >
            <Eye className="size-3.5" /> View Details
          </button>
        )}
        {item.kind === "info" && (
          <button
            onClick={() => onAction("dismiss")}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100"
          >
            Dismiss
          </button>
        )}
        <button
          onClick={onOpen}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500"
        >
          <Activity className="size-3.5" /> Details
        </button>
      </div>
    </div>
  );
}

// ─── Detail slide-over ────────────────────────────────────────────────────

function DetailPanel({
  item,
  comments,
  onClose,
  onStatus,
  onComment,
}: {
  item: AlertItem;
  comments: AlertComment[];
  onClose: () => void;
  onStatus: (status: AlertStatus) => void;
  onComment: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const meta = SEVERITY_META[item.severity];
  const stMeta = STATUS_META[item.status];
  const Icon = meta.icon;
  const escalated = isEscalated(item);
  const needsComment = item.kind === "qc" && text.trim().length === 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink-950/30 backdrop-blur-[2px]" />
      <aside className="relative flex h-full w-full max-w-[600px] flex-col overflow-hidden border-l border-line-200 bg-surface-0 shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-md ${meta.chip}`}>
              <Icon className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>
                  {meta.label}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${stMeta.chip}`}>
                  {stMeta.label}
                </span>
                <span className="rounded-full border border-line-200 bg-surface-100 px-2 py-0.5 text-[11px] text-ink-500">
                  {KIND_LABEL[item.kind]}
                </span>
              </div>
              <h2 className="mt-1.5 text-[15px] font-semibold leading-snug text-ink-950">{item.title}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-400">
                <Clock className="size-3.5" /> {fmtTime(item.createdAt)} ({ageLabel(item.createdAt)})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-400 transition-colors duration-fast hover:bg-surface-100 hover:text-ink-950"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {escalated && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-status-critical bg-red-50 px-3 py-2 text-xs font-semibold text-status-critical">
              <BellRing className="size-4 animate-pulse" />
              Unresolved for more than 2 hours — automatically escalated to Lab Management.
            </div>
          )}

          <p className="text-[13px] leading-relaxed text-ink-700">{item.detail}</p>

          {/* Meta grid */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {item.analyzer && (
              <div className="rounded-md border border-line-200 p-2.5">
                <p className="field-label">Analyzer</p>
                <p className="mt-0.5 text-xs font-medium text-ink-950">{item.analyzer}</p>
              </div>
            )}
            {item.lot && (
              <div className="rounded-md border border-line-200 p-2.5">
                <p className="field-label">Lot / Batch</p>
                <p className="mt-0.5 data-mono text-xs text-ink-950">{item.lot}</p>
              </div>
            )}
            {item.rule && (
              <div className="rounded-md border border-status-critical/40 bg-red-50/50 p-2.5">
                <p className="field-label text-status-critical">Rule violated</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-status-critical">{item.rule}</p>
              </div>
            )}
            {item.test && (
              <div className="rounded-md border border-line-200 p-2.5">
                <p className="field-label">Test / Level</p>
                <p className="mt-0.5 text-xs font-medium text-ink-950">{item.test}</p>
              </div>
            )}
            <div className="rounded-md border border-line-200 p-2.5">
              <p className="field-label">Source</p>
              <p className="mt-0.5 text-xs font-medium text-ink-950">
                {item.demo ? "QC demo data" : "Inventory module"}
              </p>
            </div>
          </div>

          {/* QC plot + trend */}
          {item.qc && (
            <section className="mt-3 rounded-md border border-line-200 p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="field-label mb-0">Control chart (flagged run)</p>
                <span className="text-[10px] uppercase tracking-wide text-ink-400">unit {item.qc.unit}</span>
              </div>
              <QcPlot qc={item.qc} />
              {item.history && item.history.length > 0 && (
                <div className="mt-2.5 border-t border-line-200 pt-2.5">
                  <p className="field-label mb-1">Previous runs (trend)</p>
                  <TrendSpark values={item.history} />
                </div>
              )}
            </section>
          )}

          {/* Comments */}
          <section className="mt-3 rounded-md border border-line-200 p-3.5">
            <p className="field-label mb-2 flex items-center gap-1.5">
              <MessageSquare className="size-3.5 text-ink-400" /> Team comments
            </p>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {comments.length === 0 && (
                <p className="rounded bg-surface-100 px-2.5 py-2 text-xs text-ink-400">
                  No comments yet — document the root cause here (e.g. “re-calibrated pipette”, “new reagent lot”).
                </p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="rounded-md border border-line-200 bg-surface-100/60 p-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
                    <User className="size-3" />
                    <span className="font-semibold text-ink-700">{c.author}</span>
                    <span>·</span>
                    <span>{fmtTime(c.at)}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-700">{c.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && text.trim()) {
                    onComment(text.trim());
                    setText("");
                  }
                }}
                placeholder="Add a comment documenting the resolution…"
                className="flex-1 rounded-md border border-line-200 bg-surface-0 px-2.5 py-2 text-xs text-ink-950 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
              />
              <button
                onClick={() => {
                  if (!text.trim()) return;
                  onComment(text.trim());
                  setText("");
                }}
                disabled={!text.trim()}
                className="rounded-md border border-line-200 bg-surface-0 px-3 py-2 text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </section>
        </div>

        {/* Footer actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line-200 px-5 py-3">
          {item.status !== "acknowledged" && item.status !== "resolved" && (
            <button
              onClick={() => onStatus("acknowledged")}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100"
            >
              <Check className="size-3.5" /> Acknowledge
            </button>
          )}
          {item.status === "unread" && (
            <button
              onClick={() => onStatus("in_progress")}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100"
            >
              Mark In Progress
            </button>
          )}
          {item.kind === "qc" && (
            <>
              <button
                onClick={() => onStatus("resolved")}
                disabled={needsComment}
                title={needsComment ? "Add a comment documenting your decision to sign off" : undefined}
                className="inline-flex items-center gap-1.5 rounded-md bg-status-critical px-3 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCheck className="size-3.5" /> Sign Off &amp; Resolve
              </button>
              <button
                onClick={() => {
                  onComment("Run rejected — flagged for re-run / repeat draw.");
                  onStatus("resolved");
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100"
              >
                Reject Run
              </button>
            </>
          )}
          {item.kind === "inventory" && (
            <button
              onClick={() => {
                onComment("Reagent ordered from Alerts center — awaiting delivery.");
                onStatus("acknowledged");
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
            >
              <Package className="size-3.5" /> Order Reagent
            </button>
          )}
          {item.status !== "resolved" && (
            <button
              onClick={() => onStatus("resolved")}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-green-600"
            >
              <CheckCheck className="size-3.5" /> Resolve
            </button>
          )}
        </div>
        <p className="shrink-0 border-t border-line-200 px-5 py-2 text-[10px] text-ink-400">
          Every acknowledgment, resolution &amp; comment is captured in the Audit Trail (Setup → Audit Log).
          {item.demo && " QC/system alerts are simulated demo data — the QC module ships in a later sprint."}
        </p>
      </aside>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

type Tab = "all" | AlertStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "in_progress", label: "In Progress" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "resolved", label: "Resolved" },
];

export default function AlertsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [myAlerts, setMyAlerts] = useState(false);
  const [statusMap, setStatusMap] = useState<StatusMap>(() => loadJson(STATUS_KEY, {}));
  const [commentsMap, setCommentsMap] = useState<CommentsMap>(() => loadJson(COMMENTS_KEY, {}));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  const me = useMemo(() => {
    const f = user?.firstName ?? "";
    const l = user?.lastName ?? "";
    return `${f} ${l}`.trim() || user?.email || "You";
  }, [user]);

  const myRole = user?.role ?? "";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const inv = await getInventoryAlerts();
        if (!alive) return;
        setError("");
        setDemoAlerts(buildInventoryAlerts(inv));
      } catch {
        if (!alive) return;
        setError("Inventory alert feed unavailable — showing QC/system demo alerts.");
        setDemoAlerts(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Demo alerts regenerate with now-relative timestamps on each load; their
  // status/comments persist via localStorage.
  const setDemoAlerts = (inv: ReturnType<typeof buildInventoryAlerts> | null) => {
    // Extra alerts (raised by other modules, e.g. rejected results under
    // investigation) lead the inbox, then demo QC/system + real inventory.
    setAlerts([...loadExtraAlerts(), ...buildDemoAlerts(Date.now()), ...(inv ?? [])]);
  };

  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const statusOf = useCallback(
    (id: string, fallback: AlertStatus): AlertStatus => statusMap[id] ?? fallback,
    [statusMap],
  );

  const setStatus = (id: string, status: AlertStatus) => {
    const next = { ...statusMap, [id]: status };
    setStatusMap(next);
    saveJson(STATUS_KEY, next);
  };

  const addComment = (id: string, text: string) => {
    const next = {
      ...commentsMap,
      [id]: [
        ...(commentsMap[id] ?? []),
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, author: me, text, at: new Date().toISOString() },
      ],
    };
    setCommentsMap(next);
    saveJson(COMMENTS_KEY, next);
  };

  const handleCardAction = (item: AlertItem, action: string) => {
    if (action === "dismiss") {
      setStatus(item.id, "acknowledged");
    } else if (action === "reject") {
      addComment(item.id, "Run rejected — flagged for re-run / repeat draw.");
      setStatus(item.id, "resolved");
    } else if (action === "order") {
      addComment(item.id, "Reagent ordered from Alerts center — awaiting delivery.");
      setStatus(item.id, "acknowledged");
    } else if (action === "open") {
      setOpenId(item.id);
    }
  };

  const visibleAlerts = useMemo(() => {
    const roleMatch = (a: AlertItem) => !myAlerts || a.roles.includes(myRole) || a.roles.length === 0;
    return alerts
      .filter((a) => (tab === "all" ? true : statusOf(a.id, a.status) === tab))
      .filter(roleMatch)
      .map((a) => ({ ...a, status: statusOf(a.id, a.status) }))
      .sort((a, b) => {
        const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
        if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [alerts, tab, myAlerts, myRole, statusOf]);

  const counts = useMemo(() => {
    const c = { all: alerts.length, unread: 0, in_progress: 0, acknowledged: 0, resolved: 0, critical: 0, escalated: 0 };
    for (const a of alerts) {
      const s = statusOf(a.id, a.status);
      c[s]++;
      if (a.severity === "critical") c.critical++;
      if (isEscalated({ ...a, status: s })) c.escalated++;
    }
    return c;
  }, [alerts, statusOf]);

  const bulkAck = () => {
    const next = { ...statusMap };
    for (const id of selected) next[id] = "acknowledged";
    setStatusMap(next);
    saveJson(STATUS_KEY, next);
    setSelected(new Set());
  };

  const openItem = useMemo(
    () => (openId ? visibleAlerts.find((a) => a.id === openId) ?? alerts.find((a) => a.id === openId) ?? null : null),
    [openId, visibleAlerts, alerts],
  );

  const unreadCritical = counts.unread > 0 ? counts.critical : 0;

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-surface-100 p-3">
      <PageHeader
        title="Alerts & Notifications"
        subtitle="Central inbox for QC failures, warnings & system messages — nothing critical goes unnoticed"
      />

      {/* SLA banner */}
      {counts.escalated > 0 && (
        <div className="flex shrink-0 items-center gap-2.5 rounded-md border border-status-critical bg-red-50 px-4 py-2.5">
          <ShieldAlert className="size-4 shrink-0 text-status-critical" />
          <p className="text-xs font-semibold text-status-critical">
            {counts.escalated} alert{counts.escalated > 1 ? "s" : ""} unresolved for over 2 hours — escalated to Lab
            Management per SLA policy.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2.5 rounded-md border border-line-200 bg-surface-0 px-4 py-3 shadow-raised">
        <div className="flex flex-wrap items-center gap-1 rounded-md bg-surface-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors duration-fast ${
                tab === t.key ? "bg-surface-0 text-accent-700 shadow-raised" : "text-ink-500 hover:text-ink-950"
              }`}
            >
              {t.label}
              <span className="ml-1 text-[10px] text-ink-400 tabular-nums">{counts[t.key]}</span>
            </button>
          ))}
        </div>

        <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-600">
          <input
            type="checkbox"
            checked={myAlerts}
            onChange={(e) => setMyAlerts(e.target.checked)}
            className="size-3.5 accent-[#0f766e]"
          />
          My Alerts
        </label>

        <span className="mx-1 hidden h-6 w-px bg-line-200 sm:block" />

        <button
          onClick={bulkAck}
          disabled={selected.size === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCheck className="size-3.5" /> Acknowledge {selected.size > 0 ? `(${selected.size})` : ""}
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs font-medium text-ink-400 transition-colors duration-fast hover:text-ink-950"
          >
            Clear selection
          </button>
        )}

        <div className="ml-auto flex items-center gap-3 text-[11px] text-ink-400">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-status-critical" /> Critical
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-400" /> Warning
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-blue-500" /> Info
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <Inbox className="size-3 text-accent-700" /> Unread
          </div>
          <div className="mt-0.5 text-2xl font-bold text-ink-950 tabular-nums">{counts.unread}</div>
        </div>
        <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <AlertTriangle className="size-3 text-status-critical" /> Critical
          </div>
          <div className="mt-0.5 text-2xl font-bold text-status-critical tabular-nums">{counts.critical}</div>
        </div>
        <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <BellRing className="size-3 text-amber-500" /> Escalated (SLA)
          </div>
          <div className="mt-0.5 text-2xl font-bold text-amber-500 tabular-nums">{counts.escalated}</div>
        </div>
        <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <CheckCheck className="size-3 text-status-normal" /> Resolved
          </div>
          <div className="mt-0.5 text-2xl font-bold text-status-normal tabular-nums">{counts.resolved}</div>
        </div>
      </div>

      {/* Cards */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {loading ? (
          <div className="rounded-md border border-line-200 bg-surface-0 shadow-raised">
            <LoadingState label="Loading alerts…" rows={4} />
          </div>
        ) : error && alerts.length === 0 ? (
          <div className="rounded-md border border-line-200 bg-surface-0 shadow-raised">
            <ErrorState message={error} onRetry={() => window.location.reload()} />
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="rounded-md border border-line-200 bg-surface-0 shadow-raised">
            <EmptyState
              icon={Inbox}
              title="Inbox zero"
              hint={unreadCritical > 0 ? "You're all caught up on this view." : "No alerts match this filter — the inbox is clear."}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleAlerts.map((item) => (
              <AlertCard
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onToggle={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  })
                }
                onOpen={() => setOpenId(item.id)}
                onAction={(action) => handleCardAction(item, action)}
              />
            ))}
          </div>
        )}
      </div>

      {alerts.length >= 40 && (
        <p className="shrink-0 text-center text-[11px] text-ink-400">Showing the latest {alerts.length} alerts.</p>
      )}

      {openItem && (
        <DetailPanel
          item={openItem}
          comments={commentsMap[openItem.id] ?? []}
          onClose={() => setOpenId(null)}
          onStatus={(s) => setStatus(openItem.id, s)}
          onComment={(text) => addComment(openItem.id, text)}
        />
      )}
    </div>
  );
}
