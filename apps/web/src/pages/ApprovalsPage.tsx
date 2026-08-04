import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  ShieldCheck,
  BadgeCheck,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Phone,
  Clock,
  Activity,
  CheckCircle2,
  X,
  FileText,
  Calendar,
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

/** A result is critical when it sits outside the reference interval. */
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

const PROCESSED = new Set(["verified", "approved", "completed"]);

/** TAT proxy (hours in system) for processed orders. */
function tatHours(order: OrderListItem): number | null {
  if (!PROCESSED.has(order.status) || !order.createdAt) return null;
  const start = new Date(order.createdAt).getTime();
  if (isNaN(start)) return null;
  return Math.max(0, (Date.now() - start) / 3_600_000);
}

function fmtHrs(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface CriticalValue {
  orderId: string;
  orderNumber: string;
  patientName: string;
  testCode: string;
  testName: string;
  result: string;
  refRange: string | null;
  refLow: number | null;
  refHigh: number | null;
  direction: "high" | "low";
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await getOrders();
      setOrders(data);
    } catch {
      setOrders([]);
      setLoadError("Failed to load the approval queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ── Derived clinical view ── */

  const queue = useMemo(
    () => orders.filter((o) => o.status === "verified"),
    [orders],
  );

  const allTests = useMemo(
    () =>
      orders.flatMap((o) =>
        flatten(o.tests as unknown as TestChild[]).map((t) => ({ t, order: o })),
      ),
    [orders],
  );

  const criticals = useMemo<CriticalValue[]>(
    () =>
      allTests
        .filter(({ t }) => isCritical(t))
        .map(({ t, order }) => ({
          orderId: order.id,
          orderNumber: order.orderNumber,
          patientName: `${order.patient.firstName} ${order.patient.lastName}`.trim(),
          testCode: t.testCode,
          testName: t.testName,
          result: t.result ?? "",
          refRange: t.refRange,
          refLow: t.refLow,
          refHigh: t.refHigh,
          direction: t.refLow != null && parseFloat(t.result!) < t.refLow ? "low" : "high",
        })),
    [allTests],
  );

  const avgTat = useMemo(() => {
    const hrs = queue.map(tatHours).filter((h): h is number => h !== null);
    if (hrs.length === 0) return null;
    return hrs.reduce((a, b) => a + b, 0) / hrs.length;
  }, [queue]);

  /* 7-day avg TAT series — bars are computed from processed orders */
  const tatSeries = useMemo(() => {
    const days: { label: string; avg: number | null }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today.getTime() - i * 86_400_000);
      const key = dayKey(day.getTime());
      const hrs = orders
        .filter((o) => o.createdAt && dayKey(new Date(o.createdAt).getTime()) === key)
        .map(tatHours)
        .filter((h): h is number => h !== null);
      days.push({
        label: day.toLocaleDateString("en-IN", { weekday: "short" }),
        avg: hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : null,
      });
    }
    return days;
  }, [orders]);

  const maxTat = Math.max(24, ...tatSeries.map((d) => d.avg ?? 0));
  const verifiedToday = orders.filter(
    (o) =>
      (o.status === "verified" || o.status === "approved") &&
      o.createdAt &&
      dayKey(new Date(o.createdAt).getTime()) === dayKey(Date.now()),
  ).length;

  const filteredQueue = queue.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      `${o.patient.firstName} ${o.patient.lastName}`.toLowerCase().includes(q)
    );
  });

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /* ── Actions ── */

  const openDetail = async (order: OrderListItem) => {
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

  const doApprove = async (orderId: string) => {
    setApprovingId(orderId);
    setBanner(null);
    try {
      await approveOrder(orderId);
      setBanner({
        tone: "success",
        text: "Order approved — report unlocked and e-signed.",
      });
      await load();
      if (detail?.id === orderId) setDetail(null);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Approval failed. Only verified orders can be approved.";
      setBanner({ tone: "error", text: msg });
    } finally {
      setApprovingId(null);
    }
  };

  const detailFlagged = detail ? flatten(detail.tests).filter((t) => getFlag(t.result, t.refLow, t.refHigh)) : [];
  const selfVerified = !!detail?.verifiedBy && detail.verifiedBy === user?.id;

  const kpis = [
    {
      label: "Awaiting Approval",
      value: String(queue.length),
      unit: "orders",
      icon: ShieldCheck,
      tone: "petrol",
    },
    {
      label: "Avg TAT",
      value: avgTat !== null ? fmtHrs(avgTat) : "—",
      unit: "in system",
      icon: Clock,
      tone: "petrol",
    },
    {
      label: "Critical Values",
      value: String(criticals.length),
      unit: "need review",
      icon: AlertTriangle,
      tone: "red",
    },
    {
      label: "Verified Today",
      value: String(verifiedToday),
      unit: "orders",
      icon: CheckCircle2,
      tone: "green",
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* ── Header ── */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-ink-950">
                Pathologist Dashboard
              </h1>
              <span className="inline-flex items-center gap-1 rounded-sm border border-accent-200 bg-accent-100/60 px-2 py-0.5 text-[11px] font-medium text-accent-700">
                <ShieldCheck className="size-3" />
                NABL Sign-off
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-600">
              Review verified results, resolve critical values, and sign reports
              — {todayLabel}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-400">Signed in as</div>
            <div className="mt-0.5 text-sm font-semibold text-ink-950">
              Dr. {user?.firstName} {user?.lastName ?? ""}
            </div>
            <div className="text-[11px] capitalize text-accent-700">
              {user?.role ?? "pathologist"}
            </div>
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
          <LoadingState label="Loading pathologist dashboard…" rows={6} />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : (
          <>
            {/* ── KPI row ── */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className={`rounded-md border bg-surface-0 px-4 py-3.5 ${
                    k.tone === "red"
                      ? "border-red-200"
                      : "border-line-200"
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

            {/* ── TAT chart + Critical values rail ── */}
            <div className="mb-6 grid gap-4 lg:grid-cols-3">
              {/* TAT (central, wide) */}
              <div className="rounded-md border border-line-200 bg-surface-0 p-5 lg:col-span-2">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                      <Activity className="size-4 text-accent-700" />
                      Turnaround Time
                    </h2>
                    <p className="mt-1 text-xs text-ink-600">
                      Avg hours in system for processed orders · last 7 days
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="data-mono text-lg font-semibold text-ink-950">
                      {avgTat !== null ? fmtHrs(avgTat) : "—"}
                    </div>
                    <div className="text-[11px] text-ink-400">current avg</div>
                  </div>
                </div>
                <div className="flex h-44 items-end gap-3">
                  {tatSeries.map((d, i) => {
                    const h = d.avg ?? 0;
                    const pct = h > 0 ? Math.max(6, (h / maxTat) * 100) : 4;
                    const isToday = i === tatSeries.length - 1;
                    return (
                      <div key={d.label} className="flex h-full flex-1 flex-col justify-end gap-2">
                        <div className="relative flex flex-1 items-end justify-center">
                          {d.avg !== null && (
                            <span className="data-mono absolute -top-1 text-[10px] font-medium text-ink-600">
                              {fmtHrs(d.avg)}
                            </span>
                          )}
                          <div
                            title={d.avg !== null ? `${d.label}: ${fmtHrs(d.avg)}` : "No data"}
                            className={`w-full max-w-9 rounded-sm transition-colors duration-fast ${
                              d.avg !== null && d.avg > 24
                                ? "bg-status-critical/80 hover:bg-status-critical"
                                : isToday
                                  ? "bg-accent-700 hover:bg-accent-500"
                                  : "bg-accent-500/70 hover:bg-accent-500"
                            }`}
                            style={{ height: `${pct}%` }}
                          />
                        </div>
                        <span
                          className={`text-center text-[10px] ${
                            isToday ? "font-semibold text-accent-700" : "text-ink-400"
                          }`}
                        >
                          {d.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center gap-4 border-t border-line-200 pt-3 text-[11px] text-ink-600">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-accent-500/70" /> within target
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-status-critical/80" /> over 24h
                  </span>
                  <span className="ml-auto data-mono">target ≤ 24h</span>
                </div>
              </div>

              {/* Critical values rail — patient safety first */}
              <div
                className={`flex flex-col rounded-md border bg-surface-0 ${
                  criticals.length > 0 ? "border-red-200" : "border-line-200"
                }`}
              >
                <div
                  className={`flex items-center justify-between border-b px-4 py-3 ${
                    criticals.length > 0 ? "border-red-100 bg-red-50/60" : "border-line-200"
                  }`}
                >
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                    <AlertTriangle
                      className={`size-4 ${criticals.length > 0 ? "text-status-critical" : "text-ink-400"}`}
                    />
                    Critical Values
                  </h2>
                  <span
                    className={`data-mono rounded-sm px-2 py-0.5 text-xs font-semibold ${
                      criticals.length > 0
                        ? "bg-status-critical text-surface-0"
                        : "bg-green-50 text-status-normal"
                    }`}
                  >
                    {criticals.length}
                  </span>
                </div>
                {criticals.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                    <BadgeCheck className="size-8 text-status-normal/70" />
                    <p className="text-sm font-medium text-ink-950">All results in range</p>
                    <p className="text-xs text-ink-600">
                      No critical values across current orders
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-line-200">
                    {criticals.slice(0, 6).map((c) => (
                      <button
                        key={`${c.orderId}-${c.testCode}`}
                        onClick={() => {
                          const order = orders.find((o) => o.id === c.orderId);
                          if (order) openDetail(order);
                        }}
                        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-red-50/40"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink-950">
                            {c.patientName}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-ink-600">
                            {c.testName} <span className="data-mono">({c.testCode})</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="data-mono text-sm font-semibold text-status-critical">
                            {c.direction === "high" ? "▲" : "▼"} {c.result}
                          </div>
                          <div className="data-mono text-[10px] text-ink-400">
                            ref {c.refRange ?? "—"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {criticals.length > 6 && (
                  <div className="border-t border-line-200 px-4 py-2 text-[11px] text-ink-600">
                    +{criticals.length - 6} more — open an order to review
                  </div>
                )}
              </div>
            </div>

            {/* ── Approval queue ── */}
            <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-200 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-ink-950">
                    Awaiting Your Approval
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-600">
                    {queue.length} verified order{queue.length === 1 ? "" : "s"} ready for
                    NABL sign-off
                  </p>
                </div>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    placeholder="Search by order # or patient…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 w-full rounded-md border border-line-300 bg-surface-0 pl-9 pr-3 text-sm transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100"
                  />
                </div>
              </div>

              {filteredQueue.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title={search ? "No orders match your search" : "No orders waiting for approval"}
                  hint={
                    search
                      ? "Try a different order number or patient name"
                      : "Technicians verify results first — verified orders appear here for sign-off."
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-100">
                      <tr className="border-b border-line-200">
                        <th className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Patient</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Order #</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Tests</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">TAT</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Status</th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-ink-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-200">
                      {filteredQueue.map((order) => {
                        const tests = flatten(order.tests as unknown as TestChild[]);
                        const done = tests.filter((t) => t.status === "completed").length;
                        const tat = tatHours(order);
                        const hasCritical = tests.some(isCritical);
                        return (
                          <tr key={order.id} className="transition-colors duration-fast hover:bg-surface-100">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-bold text-accent-700">
                                  {order.patient.firstName.charAt(0)}
                                  {order.patient.lastName?.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate font-medium text-ink-950">
                                      {order.patient.firstName} {order.patient.lastName}
                                    </span>
                                    {order.emergency && (
                                      <span className="size-1.5 shrink-0 rounded-full bg-status-critical" />
                                    )}
                                  </div>
                                  {order.patient.phone && (
                                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-600">
                                      <Phone className="size-3" />
                                      {order.patient.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="data-mono text-xs font-medium text-accent-700">
                                {order.orderNumber}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="data-mono text-xs text-ink-950">
                                {done}/{tests.length}
                              </span>
                              <span className="ml-1 text-[11px] text-ink-400">done</span>
                              {hasCritical && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded-sm bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-status-critical">
                                  <AlertTriangle className="size-2.5" /> CRIT
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span className="data-mono text-xs text-ink-950">
                                {tat !== null ? fmtHrs(tat) : "—"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="status-chip border-blue-200 bg-blue-50 text-blue-700">
                                <BadgeCheck className="size-3" />
                                Verified
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => doApprove(order.id)}
                                  disabled={approvingId === order.id}
                                  className="inline-flex items-center gap-1.5 rounded-sm bg-accent-700 px-3 py-1.5 text-[11px] font-semibold text-surface-0 shadow-raised transition-colors duration-fast hover:bg-accent-500 disabled:opacity-50"
                                >
                                  {approvingId === order.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="size-3" />
                                  )}
                                  Approve
                                </button>
                                <button
                                  onClick={() => openDetail(order)}
                                  className="inline-flex items-center gap-1.5 rounded-sm border border-line-300 px-3 py-1.5 text-[11px] font-medium text-ink-600 transition-colors duration-fast hover:border-accent-500 hover:text-accent-700"
                                >
                                  <FileText className="size-3" />
                                  View Details
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Order review modal ── */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between gap-4 border-b border-line-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-bold text-accent-700">
                  {detail.patient.firstName.charAt(0)}
                  {detail.patient.lastName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-ink-950">
                      {detail.patient.title ? `${detail.patient.title} ` : ""}
                      {detail.patient.firstName} {detail.patient.lastName}
                    </h2>
                    {detail.emergency && (
                      <span className="rounded-sm bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-status-critical">
                        EMERGENCY
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-ink-600">
                    <span className="data-mono font-medium text-accent-700">{detail.orderNumber}</span>
                    <span className="flex items-center gap-0.5">
                      <Calendar className="size-3" /> {fmtDate(detail.createdAt)}
                    </span>
                    {detail.patient.phone && (
                      <span className="flex items-center gap-0.5">
                        <Phone className="size-3" /> {detail.patient.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="rounded-sm p-1.5 text-ink-400 transition-colors duration-fast hover:bg-surface-100 hover:text-ink-950"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Verified-by + flags summary */}
            <div className="flex flex-wrap items-center gap-2 border-b border-line-200 px-6 py-2.5">
              {detail.verifiedByUser && (
                <span className="status-chip border-accent-200 bg-accent-100/50 text-accent-800">
                  <BadgeCheck className="size-3" />
                  Verified by {detail.verifiedByUser.name}
                  {selfVerified ? " — you" : ""}
                </span>
              )}
              {detailFlagged.length > 0 && (
                <span className="status-chip border-amber-200 bg-amber-50 text-amber-700">
                  <AlertTriangle className="size-3" />
                  {detailFlagged.length} result{detailFlagged.length === 1 ? "" : "s"} outside
                  reference range
                </span>
              )}
              {selfVerified && (
                <span className="status-chip border-amber-200 bg-amber-50 text-amber-700">
                  <ShieldCheck className="size-3" />
                  You verified this — a different user must approve (NABL 2-person sign-off)
                </span>
              )}
            </div>

            {/* Tests table */}
            <div className="max-h-[50vh] overflow-auto px-6 py-4">
              {detailLoading ? (
                <LoadingState label="Loading order details…" rows={3} />
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-line-200 bg-surface-100">
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Test</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Result</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Unit</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Ref Range</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-200">
                    {flatten(detail.tests).map((t) => {
                      const flag = getFlag(t.result, t.refLow, t.refHigh);
                      const isParent = !!t.children?.length;
                      return (
                        <tr key={t.id} className={isParent ? "bg-accent-100/30" : ""}>
                          <td className="px-3 py-2 text-ink-950">
                            {isParent ? (
                              <span className="font-semibold">
                                {t.testName} ({t.testCode})
                              </span>
                            ) : (
                              <span>{t.testName}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="data-mono inline-flex items-center gap-1.5 font-medium">
                              {t.result ?? "—"}
                              {flag && (
                                <span className="text-status-critical" title={flag.title}>
                                  {flag.icon}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-ink-600">{t.unit ?? "—"}</td>
                          <td className="data-mono px-3 py-2 text-ink-600">{t.refRange ?? "—"}</td>
                          <td className="px-3 py-2 text-xs text-ink-400">{t.notes || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between gap-3 border-t border-line-200 bg-surface-100 px-6 py-3">
              <span className="text-[11px] text-ink-600">
                Approving e-signs every result and unlocks the report
              </span>
              <button
                onClick={() => doApprove(detail.id)}
                disabled={approvingId === detail.id || selfVerified}
                className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 shadow-raised transition-colors duration-fast hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {approvingId === detail.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="size-3.5" />
                )}
                Approve & Sign Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
