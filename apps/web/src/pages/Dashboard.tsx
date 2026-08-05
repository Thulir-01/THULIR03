import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router";
import {
  Activity,
  Bell,
  ClipboardCheck,
  Timer,
  CheckCircle2,
  CheckCheck,
  XCircle,
  Eye,
  ArrowRight,
  AlertTriangle,
  FlaskConical,
  FileBarChart2,
  Settings,
  Lock,
  LogOut,
  History,
  Loader2,
  Calendar,
  Zap,
} from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { pushExtraAlert } from "../lib/alerts-store";
import {
  getOrders,
  getAuditLogs,
  getInventoryAlerts,
  approveOrder,
  login,
  type OrderListItem,
  type AuditLogEntry,
} from "../lib/api-client";
import PageHeader from "../components/ui/PageHeader";
import { LoadingState, ErrorState } from "../components/ui/PageStates";

const APPROVERS = new Set(["pathologist", "lab_admin", "lab_manager"]);
const LOCK_MS = 5 * 60e3; // auto-lock after 5 minutes of inactivity

// ─── Helpers ─────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60e3) return "just now";
  const mins = Math.floor(diff / 60e3);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join(".");
}

function maskName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•••";
  const first = parts[0].charAt(0).toUpperCase();
  const last = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first}.${last}.`;
}

function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Health gauge ────────────────────────────────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const color = score >= 90 ? "#16a34a" : score >= 75 ? "#d97706" : "#dc2626";
  const label = score >= 90 ? "Excellent" : score >= 75 ? "Needs attention" : "Critical";
  const tone =
    score >= 90
      ? "text-status-normal"
      : score >= 75
        ? "text-amber-600"
        : "text-status-critical";
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <svg viewBox="0 0 120 120" className="size-28">
          <circle cx="60" cy="60" r={R} fill="none" stroke="#e8eef0" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(C * score) / 100} ${C}`}
            transform="rotate(-90 60 60)"
            className="transition-all duration-700"
          />
          <text x="60" y="58" textAnchor="middle" fontSize="24" fontWeight="800" fill="#15181a">
            {score}%
          </text>
          <text x="60" y="74" textAnchor="middle" fontSize="10" fill="#5c6570">
            health
          </text>
        </svg>
        <span className="absolute -right-1 top-2 flex size-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: color }} />
          <span className="relative inline-flex size-3 rounded-full" style={{ backgroundColor: color }} />
        </span>
      </div>
      <div>
        <p className={`text-sm font-bold ${tone}`}>Lab Health · {label}</p>
        <p className="mt-1 max-w-[180px] text-[11px] leading-relaxed text-ink-500">
          Computed from open alerts, pending reviews &amp; review wait time.
        </p>
      </div>
    </div>
  );
}

// ─── Session lock overlay (5-min inactivity) ─────────────────────────────

function LockOverlay({
  onUnlock,
  onLogout,
}: {
  onUnlock: () => void;
  onLogout: () => void;
}) {
  const { user } = useAuth();
  const [pass, setPass] = useState("");
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState("");

  const tryUnlock = async () => {
    if (!pass) return;
    setChecking(true);
    setErr("");
    try {
      await login(user?.email ?? "", pass);
      setPass("");
      onUnlock();
    } catch {
      setErr(
        "Incorrect password, or this account requires MFA. Use Log out to return to sign-in.",
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-lg border border-line-200 bg-surface-0 p-7 shadow-overlay">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-700/10 text-accent-700">
          <Lock className="size-6" />
        </div>
        <h2 className="mt-4 text-center text-base font-bold text-ink-950">Session locked</h2>
        <p className="mt-1 text-center text-xs text-ink-500">
          Auto-locked after 5 minutes of inactivity. Enter your password to resume.
        </p>
        <input
          type="password"
          value={pass}
          autoFocus
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void tryUnlock()}
          placeholder="Account password"
          className="mt-4 w-full rounded-md border border-line-200 bg-surface-0 px-3 py-2 text-sm text-ink-950 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
        />
        {err && <p className="mt-2 text-xs text-status-critical">{err}</p>}
        <button
          onClick={() => void tryUnlock()}
          disabled={checking || !pass}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-accent-700 px-3 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {checking ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          Unlock
        </button>
        <button
          onClick={onLogout}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-2 text-sm font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100"
        >
          <LogOut className="size-4" /> Log out
        </button>
      </div>
    </div>
  );
}

// ─── Activity feed ───────────────────────────────────────────────────────

function activityText(a: AuditLogEntry) {
  const verb = a.action === "POST" ? "created" : a.action === "DELETE" ? "deleted" : "updated";
  const actor = a.actorName ?? "System";
  const target = a.entity.replace(/_/g, " ");
  return `${actor} ${verb} ${target}`;
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [invAlertCount, setInvAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [approveAllOpen, setApproveAllOpen] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [locked, setLocked] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const lastActiveRef = useRef(Date.now());
  const toastTimer = useRef<number | null>(null);

  const roleName =
    user?.role === "lab_admin"
      ? "Lab Admin"
      : user?.role === "pathologist"
        ? "Pathologist"
        : user?.role === "technician"
          ? "Technician"
          : user?.role;

  const canApprove = APPROVERS.has(user?.role ?? "");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([getOrders(), getAuditLogs({ limit: 8 }), getInventoryAlerts()])
      .then(([o, logs, inv]) => {
        setOrders(o);
        setActivity(logs);
        setInvAlertCount((inv.expired?.length ?? 0) + (inv.lowStock?.length ?? 0) + (inv.expiring?.length ?? 0));
      })
      .catch(() => {
        setOrders([]);
        setActivity([]);
        setInvAlertCount(0);
        setError("Failed to load the command center. Please try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inactivity auto-lock (security: 5-minute session lock).
  useEffect(() => {
    const bump = () => {
      lastActiveRef.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    for (const e of events) window.addEventListener(e, bump, { passive: true });
    const iv = window.setInterval(() => {
      setNowTick(Date.now());
      if (Date.now() - lastActiveRef.current > LOCK_MS) setLocked(true);
    }, 1000);
    return () => {
      for (const e of events) window.removeEventListener(e, bump);
      window.clearInterval(iv);
    };
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────

  const pendingReviews = useMemo(
    () =>
      orders
        .filter((o) => o.status === "verified")
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders],
  );

  const avgWaitMin = useMemo(() => {
    if (pendingReviews.length === 0) return null;
    const now = Date.now();
    const total = pendingReviews.reduce((sum, o) => sum + (now - new Date(o.createdAt).getTime()), 0);
    return Math.max(1, Math.round(total / pendingReviews.length / 60e3));
  }, [pendingReviews]);

  // Demo QC alerts (QC module is a later sprint) — drives the critical banner.
  const demoCriticalCount = 1;
  const openAlerts = demoCriticalCount + invAlertCount;

  const healthScore = useMemo(() => {
    let s = 100;
    s -= Math.min(24, demoCriticalCount * 12);
    s -= Math.min(18, invAlertCount * 6);
    s -= Math.min(10, Math.max(0, pendingReviews.length - 5) * 2);
    if (avgWaitMin !== null && avgWaitMin > 60) s -= 4;
    return Math.max(20, Math.min(100, s));
  }, [demoCriticalCount, invAlertCount, pendingReviews.length, avgWaitMin]);

  const secondsToLock = Math.max(0, Math.ceil((LOCK_MS - (nowTick - lastActiveRef.current)) / 1000));

  const feed = useMemo(() => {
    const real = activity.map((a) => ({
      id: `real-${a.id}`,
      icon: a.action === "DELETE" ? XCircle : a.action === "POST" ? CheckCircle2 : Activity,
      text: activityText(a),
      time: a.createdAt,
      demo: false,
    }));
    const now = Date.now();
    const demo = [
      { id: "demo-run405", icon: Activity, text: "Analyzer 1 completed Run #405", time: new Date(now - 9 * 60e3).toISOString(), demo: true },
      { id: "demo-signoff", icon: CheckCircle2, text: "Dr. Smith signed off Sample #102", time: new Date(now - 26 * 60e3).toISOString(), demo: true },
      { id: "demo-lot", icon: FlaskConical, text: "Reagent Lot #B23 added to stock", time: new Date(now - 47 * 60e3).toISOString(), demo: true },
    ];
    return [...real, ...demo].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [activity]);

  const shortcuts = [
    { icon: FlaskConical, label: "Manual QC Entry", desc: "Enter control values · Westgard", to: "/qc" },
    { icon: ClipboardCheck, label: "Result Entry", desc: "Manual entry · auto flags", to: "/results" },
    { icon: FileBarChart2, label: "Generate Report", desc: "Daily summary", to: "/reports" },
    { icon: Settings, label: "Settings", desc: "Lab configuration", to: "/general-settings" },
  ];

  // ── Actions ────────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  };

  const approve = async (id: string) => {
    setApprovingId(id);
    try {
      await approveOrder(id);
      showToast("Order approved — report unlocked and e-signed.");
      await load();
    } catch {
      showToast("Approval failed — only verified orders can be approved (NABL 2-person sign-off).");
    } finally {
      setApprovingId(null);
    }
  };

  const reject = (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (order) {
      // Closed loop: a rejected result raises a critical investigation alert
      // in the Alerts Center so it is never lost between modules.
      pushExtraAlert({
        severity: "critical",
        kind: "system",
        title: `Result Rejected: ${order.orderNumber}`,
        detail: `${order.orderNumber} (${maskName(`${order.patient.firstName} ${order.patient.lastName}`)}) was rejected during review and flagged for investigation — re-test / repeat draw required before sign-off.`,
        roles: ["pathologist", "lab_admin", "lab_manager"],
      });
      showToast("Investigation alert raised in the Alerts Center.");
    }
    // Open the full review so the pathologist can document the re-test request.
    navigate(`/approvals/${id}`);
  };

  const approveAll = async () => {
    setApprovingAll(true);
    let ok = 0;
    let fail = 0;
    for (const o of pendingReviews) {
      try {
        await approveOrder(o.id);
        ok++;
      } catch {
        fail++;
      }
    }
    setApprovingAll(false);
    setApproveAllOpen(false);
    showToast(`Approved ${ok} order${ok === 1 ? "" : "s"}${fail > 0 ? ` · ${fail} failed` : ""} — e-signed & released.`);
    await load();
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <PageHeader
          title={`Welcome back, ${user?.firstName ?? "there"}`}
          subtitle={`Command center · ${roleName} · ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}`}
          actions={
            <div className="flex items-center gap-2">
              <span
                className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex ${
                  secondsToLock < 60 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-line-200 bg-surface-0 text-ink-500"
                }`}
                title="Session auto-locks after 5 minutes of inactivity"
              >
                <Lock className="size-3" /> Auto-lock {fmtClock(secondsToLock * 1000)}
              </span>
              <button
                onClick={() => navigate("/patient-registration")}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
              >
                New Registration
              </button>
            </div>
          }
        />

        {loading ? (
          <LoadingState label="Loading command center…" rows={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            {/* HEALTH CHECK */}
            <section className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
              <div className="rounded-md border border-line-200 bg-surface-0 p-4 shadow-raised lg:col-span-1">
                <HealthGauge score={healthScore} />
                <div className="mt-3 space-y-1 border-t border-line-200 pt-3 text-[11px] text-ink-500">
                  <p className="flex justify-between">
                    <span>Open alerts</span>
                    <span className="font-semibold text-ink-950">{openAlerts}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Pending reviews</span>
                    <span className="font-semibold text-ink-950">{pendingReviews.length}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Avg review wait</span>
                    <span className="font-semibold text-ink-950">{avgWaitMin === null ? "—" : `${avgWaitMin} min`}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate("/approvals")}
                className="group rounded-md border border-line-200 bg-surface-0 p-4 text-left shadow-raised transition-all duration-fast hover:-translate-y-px hover:border-accent-500 hover:shadow-overlay"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                    <ClipboardCheck className="size-4.5" />
                  </span>
                  <ArrowRight className="size-4 text-line-300 transition-colors duration-fast group-hover:text-accent-500" />
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums text-ink-950">{pendingReviews.length}</p>
                <p className="text-xs font-medium text-ink-600">Pending Reviews</p>
                <p className="mt-0.5 text-[11px] text-ink-400">Click to open the Review Queue</p>
              </button>

              <button
                onClick={() => navigate("/alerts")}
                className={`group rounded-md border p-4 text-left shadow-raised transition-all duration-fast hover:-translate-y-px hover:shadow-overlay ${
                  openAlerts > 0 ? "border-red-200 bg-red-50/50" : "border-line-200 bg-surface-0"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`flex size-9 items-center justify-center rounded-md ${openAlerts > 0 ? "bg-status-critical text-surface-0" : "bg-amber-50 text-amber-600"}`}>
                    <Bell className="size-4.5" />
                  </span>
                  <ArrowRight className="size-4 text-line-300 transition-colors duration-fast group-hover:text-accent-500" />
                </div>
                <p className={`mt-3 text-2xl font-bold tabular-nums ${openAlerts > 0 ? "text-status-critical" : "text-ink-950"}`}>
                  {openAlerts}
                </p>
                <p className="text-xs font-medium text-ink-600">Open Alerts</p>
                <p className="mt-0.5 text-[11px] text-ink-400">{openAlerts > 0 ? "Critical action needed" : "Inbox clear"}</p>
              </button>

              <button
                onClick={() => navigate("/reports")}
                className="group rounded-md border border-line-200 bg-surface-0 p-4 text-left shadow-raised transition-all duration-fast hover:-translate-y-px hover:border-accent-500 hover:shadow-overlay"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-md bg-green-50 text-status-normal">
                    <Timer className="size-4.5" />
                  </span>
                  <ArrowRight className="size-4 text-line-300 transition-colors duration-fast group-hover:text-accent-500" />
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums text-ink-950">
                  {avgWaitMin === null ? "—" : `${avgWaitMin}m`}
                </p>
                <p className="text-xs font-medium text-ink-600">Avg Review Wait</p>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  {avgWaitMin === null ? "No pending reviews" : "Oldest-first queue · SLA 60m"}
                </p>
              </button>
            </section>

            {/* MY TASKS + ACTIVITY */}
            <section className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {/* My Tasks */}
              <div className="rounded-md border border-line-200 bg-surface-0 shadow-raised lg:col-span-2">
                <div className="flex items-center justify-between border-b border-line-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-ink-950">My Tasks</h2>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-[10px] text-ink-400 sm:block">Patient details masked — open a task to view</span>
                    {canApprove && pendingReviews.length > 0 && (
                      <button
                        onClick={() => setApproveAllOpen(true)}
                        disabled={approvingAll}
                        className="inline-flex items-center gap-1 rounded-md bg-status-normal px-2.5 py-1.5 text-[11px] font-semibold text-surface-0 transition-colors duration-fast hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {approvingAll ? <Loader2 className="size-3 animate-spin" /> : <CheckCheck className="size-3.5" />}
                        Approve All ({pendingReviews.length})
                      </button>
                    )}
                    <Link to="/approvals" className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500">
                      View All <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Critical action required */}
                <div className="flex flex-wrap items-center gap-3 border-b border-red-100 bg-red-50/60 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-status-critical text-surface-0">
                    <AlertTriangle className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-status-critical">1 Critical · QC Failure on Analyzer 2</p>
                    <p className="mt-0.5 text-[11px] text-red-800/70">
                      1:3s breach (Glucose Low Control) requires sign-off · <span className="rounded-sm bg-surface-0 px-1 py-px text-[9px] text-ink-400">demo</span>
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/alerts")}
                    className="inline-flex items-center gap-1.5 rounded-md bg-status-critical px-3 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-red-700"
                  >
                    <Eye className="size-3.5" /> Review &amp; Resolve
                  </button>
                </div>

                {/* Routine approvals */}
                {pendingReviews.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <CheckCircle2 className="size-9 text-status-normal/60" />
                    <p className="text-sm font-medium text-ink-700">No pending reviews</p>
                    <p className="max-w-xs text-[11px] text-ink-400">
                      Verified results awaiting sign-off will appear here, oldest first.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-line-200">
                    {pendingReviews.slice(0, 6).map((order) => (
                      <li key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition-colors duration-fast hover:bg-surface-100">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-700/10 text-xs font-bold text-accent-700">
                          {initials(`${order.patient.firstName} ${order.patient.lastName}`)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-xs font-medium text-ink-950">
                            <span>{maskName(`${order.patient.firstName} ${order.patient.lastName}`)}</span>
                            {order.emergency && (
                              <span className="rounded-sm bg-red-50 px-1 py-px text-[9px] font-semibold text-status-critical">EMERGENCY</span>
                            )}
                          </p>
                          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500">
                            <span className="data-mono font-medium text-accent-700">{order.orderNumber}</span>
                            <span className="flex items-center gap-0.5">
                              <Calendar className="size-3" /> {relTime(order.createdAt)}
                            </span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {canApprove && (
                            <button
                              onClick={() => void approve(order.id)}
                              disabled={approvingId === order.id}
                              className="inline-flex items-center gap-1 rounded-md bg-status-normal px-2.5 py-1.5 text-[11px] font-semibold text-surface-0 transition-colors duration-fast hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {approvingId === order.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => reject(order.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[11px] font-medium text-status-critical transition-colors duration-fast hover:bg-red-50"
                          >
                            <XCircle className="size-3.5" /> Reject
                          </button>
                          <button
                            onClick={() => navigate(`/approvals/${order.id}`)}
                            className="inline-flex items-center gap-1 rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[11px] font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100"
                          >
                            <Eye className="size-3.5" /> Review
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Recent Activity */}
              <div className="flex min-h-0 flex-col rounded-md border border-line-200 bg-surface-0 shadow-raised">
                <div className="flex items-center justify-between border-b border-line-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-ink-950">Recent Activity</h2>
                  <History className="size-4 text-ink-400" />
                </div>
                <ul className="min-h-0 flex-1 space-y-0 divide-y divide-line-200 overflow-y-auto">
                  {feed.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-2.5 px-4 py-2.5">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-700">
                        <entry.icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-snug text-ink-700">{entry.text}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-400">
                          {relTime(entry.time)}
                          {entry.demo && <span className="rounded-sm bg-surface-100 px-1 py-px text-[9px]">demo</span>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/audit"
                  className="inline-flex items-center justify-center gap-1 border-t border-line-200 px-4 py-2.5 text-xs font-medium text-accent-700 transition-colors duration-fast hover:bg-surface-100 hover:text-accent-500"
                >
                  Open full Audit Trail <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </section>

            {/* QUICK ACCESS */}
            <section>
              <h2 className="mb-3 text-sm font-semibold text-ink-950">Quick Access</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {shortcuts.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => s.to && navigate(s.to)}
                    className="group flex items-center gap-3 rounded-md border border-line-200 bg-surface-0 p-4 text-left shadow-raised transition-all duration-fast hover:-translate-y-px hover:border-accent-500 hover:shadow-overlay"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-700 transition-colors duration-fast group-hover:bg-accent-700 group-hover:text-surface-0">
                      <s.icon className="size-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink-950">{s.label}</span>
                      <span className="mt-0.5 block text-[11px] text-ink-500">{s.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[55] -translate-x-1/2 rounded-md border border-line-200 bg-surface-0 px-4 py-2.5 text-xs font-medium text-ink-950 shadow-overlay">
          {toast}
        </div>
      )}

      {/* Approve All confirm — NABL 2-person sign-off gate */}
      {approveAllOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-line-200 bg-surface-0 p-6 shadow-overlay">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-green-50 text-status-normal">
                <CheckCheck className="size-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink-950">Approve all pending reviews?</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">
                  This e-signs and releases{" "}
                  <span className="font-semibold text-ink-950">
                    {pendingReviews.length} verified order{pendingReviews.length === 1 ? "" : "s"}
                  </span>{" "}
                  in one batch. Results were already verified by the technician — you are the second
                  signer (NABL 2-person sign-off). Every approval is recorded in the Audit Trail.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setApproveAllOpen(false)}
                disabled={approvingAll}
                className="rounded-md border border-line-200 bg-surface-0 px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => void approveAll()}
                disabled={approvingAll}
                className="inline-flex items-center gap-1.5 rounded-md bg-status-normal px-3 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {approvingAll ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
                {approvingAll ? "Approving…" : `Approve all (${pendingReviews.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {locked && <LockOverlay onUnlock={() => { setLocked(false); lastActiveRef.current = Date.now(); }} onLogout={handleLogout} />}
    </div>
  );
}
