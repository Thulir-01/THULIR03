import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  BadgeCheck,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Phone,
} from "lucide-react";
import {
  getOrders,
  getOrder,
  approveOrder,
  type OrderListItem,
  type TestChild,
} from "../lib/api-client";
import PageHeader from "../components/ui/PageHeader";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";
import { useAuth } from "../lib/useAuth";

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

function flatten(tests: TestChild[]): TestChild[] {
  const out: TestChild[] = [];
  for (const t of tests) {
    out.push(t);
    if (t.children?.length) out.push(...flatten(t.children));
  }
  return out;
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OrderListItem | null>(null);
  const [detail, setDetail] = useState<{
    id: string;
    orderNumber: string;
    status: string;
    emergency: boolean;
    verifiedBy: string | null;
    verifiedByUser: { id: string; name: string } | null;
    patient: {
      firstName: string;
      lastName: string;
      title: string | null;
      phone: string | null;
      gender: string | null;
      dateOfBirth: string | null;
    };
    tests: TestChild[];
  } | null>(null);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await getOrders(q || undefined);
      // Approval queue = orders a technician has verified, awaiting the
      // pathologist's NABL sign-off.
      setOrders(data.filter((o) => o.status === "verified"));
    } catch {
      setOrders([]);
      setLoadError("Failed to load the approval queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [load, search]);

  const select = async (order: OrderListItem) => {
    setSelected(order);
    setDetail(null);
    setError("");
    try {
      const d = await getOrder(order.id);
      setDetail(d as unknown as typeof detail);
    } catch {
      setError("Failed to load order details.");
    }
  };

  const doApprove = async () => {
    if (!selected) return;
    setApproving(true);
    setError("");
    try {
      await approveOrder(selected.id);
      await load(search);
      setSelected(null);
      setDetail(null);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Approval failed. Only verified orders can be approved.";
      setError(msg);
    } finally {
      setApproving(false);
    }
  };

  const allTests = detail ? flatten(detail.tests) : [];
  const flagged = allTests.filter((t) =>
    getFlag(t.result, t.refLow, t.refHigh),
  );
  // NABL two-person sign-off: whoever verified this order cannot also approve
  // it. The backend enforces this with a 409 — we surface it in the UI first
  // so the rejection isn't a surprise.
  const selfVerified = !!detail?.verifiedBy && detail.verifiedBy === user?.id;

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-surface-100 p-3">
      <PageHeader
        title="Pathologist Approval"
        subtitle="Sign off verified results with NABL e-signature — unlocks the report"
      />

      <div className="flex min-h-0 flex-1 gap-3">
        {/* LEFT: verified queue */}
        <div className={`flex min-h-0 flex-col gap-3 ${detail ? "w-[35%]" : "w-full"}`}>
          <div className="shrink-0 rounded-md border border-line-200 bg-surface-0 px-4 py-2.5 shadow-raised">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                placeholder="Search verified orders…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-md border border-line-300 bg-surface-0 pl-9 pr-3 text-sm transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-raised">
            {loading ? (
              <LoadingState label="Loading approval queue…" rows={4} />
            ) : loadError ? (
              <ErrorState message={loadError} onRetry={() => load(search)} />
            ) : orders.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title={search ? "No verified orders match your search" : "No orders waiting for approval"}
                hint={search ? undefined : "Technicians verify results first — verified orders appear here for sign-off."}
              />
            ) : (
              <div className="h-full divide-y divide-line-200 overflow-y-auto">
                {orders.map((order) => {
                  const done = flatten(order.tests as unknown as TestChild[]).filter(
                    (t) => t.status === "completed",
                  ).length;
                  return (
                    <button
                      key={order.id}
                      onClick={() => select(order)}
                      className={`w-full px-4 py-3 text-left transition-colors duration-fast hover:bg-surface-100 ${
                        selected?.id === order.id
                          ? "border-l-2 border-accent-500 bg-accent-100/40"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-bold text-accent-700">
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
                          </div>
                          <div className="data-mono mt-0.5 text-[11px] text-ink-600">
                            {order.orderNumber}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-700">
                            <CheckCircle2 className="size-3" /> {done} done
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: review + approve */}
        {detail && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="shrink-0 rounded-md border border-line-200 bg-surface-0 px-4 py-3 shadow-raised">
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                      <span className="data-mono font-medium text-accent-700">
                        {detail.orderNumber}
                      </span>
                      {detail.patient.phone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="size-3" />
                          {detail.patient.phone}
                        </span>
                      )}
                      {detail.patient.gender && (
                        <span className="capitalize">{detail.patient.gender}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={doApprove}
                  disabled={approving || selfVerified}
                  title={
                    selfVerified
                      ? "You verified this order — a different user must approve it"
                      : "Approve with NABL e-signature — stamps every result and unlocks the report"
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 shadow-raised transition-colors duration-fast hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {approving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-3.5" />
                  )}
                  Approve & Sign Report
                </button>
              </div>
              {flagged.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
                  <AlertTriangle className="size-3.5" />
                  {flagged.length} result{flagged.length > 1 ? "s" : ""} outside
                  reference range — flagged on the report
                </div>
              )}
              {detail.verifiedByUser && (
                <div className="mt-2 flex items-center gap-1.5 rounded-md border border-accent-200 bg-accent-100/50 px-2.5 py-1.5 text-[11px] font-medium text-accent-800">
                  <BadgeCheck className="size-3.5" />
                  Verified by {detail.verifiedByUser.name}
                  {selfVerified ? " — you" : " — a different user must approve"}
                </div>
              )}
              {selfVerified && (
                <div className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
                  <ShieldCheck className="size-3.5" />
                  You verified this order — a different user must approve it
                  (NABL two-person sign-off)
                </div>
              )}
            </div>

            {error && (
              <div className="shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-status-critical">
                {error}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto rounded-md border border-line-200 bg-surface-0 shadow-raised">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-line-200 bg-surface-100">
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Test</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Result</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Unit</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Ref Range</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Notes</th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-ink-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-200">
                  {allTests.map((t) => {
                    const flag = getFlag(t.result, t.refLow, t.refHigh);
                    const isParent = !!t.children?.length;
                    return (
                      <tr key={t.id} className={isParent ? "bg-accent-100/30" : ""}>
                        <td className="px-4 py-2 text-sm text-ink-950">
                          {isParent ? (
                            <span className="font-semibold">
                              {t.testName} ({t.testCode})
                            </span>
                          ) : (
                            <span>{t.testName}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            {t.result ?? "—"}
                            {flag && (
                              <span className="text-status-critical" title={flag.title}>
                                {flag.icon}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-ink-600">{t.unit ?? "—"}</td>
                        <td className="px-3 py-2 text-ink-600">{t.refRange ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-ink-400">
                          {t.notes || "—"}
                        </td>
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
        )}
      </div>
    </div>
  );
}
