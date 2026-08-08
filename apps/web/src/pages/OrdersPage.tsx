import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Search, FileText, Clock, IndianRupee, ChevronDown, ChevronUp,
  FilePlus2, Phone, Calendar, User, AlertCircle,
  CheckCircle2, XCircle, FlaskConical, RefreshCw,
} from "lucide-react";
import { getOrders, type OrderListItem } from "../lib/api-client";
import { useContextActions } from "../lib/context-actions";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";

export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchOrders = async (q?: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await getOrders(q || undefined);
      setOrders(data);
    } catch {
      setOrders([]);
      setError("Failed to load orders. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = () => fetchOrders(search);

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
    if (e.key === "Escape") { setSearch(""); fetchOrders(); }
  };

  // Stats
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + (parseFloat(o.totalAmount || "0")), 0);
  const pendingTests = orders.reduce((s, o) => s + o.tests.filter(t => t.status === "pending").length, 0);
  const emergencyCount = orders.filter(o => o.emergency).length;

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      completed: "bg-green-50 text-green-700 border-green-200",
      verified: "bg-blue-50 text-blue-700 border-blue-200",
      approved: "bg-accent-100 text-accent-700 border-accent-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
    };
    return map[status] || "bg-surface-100 text-ink-600 border-line-200";
  };

  const priorityDot = (priority: string) => {
    if (priority === "stat") return "bg-status-critical";
    if (priority === "urgent") return "bg-status-borderline";
    return "bg-line-300";
  };

  const inr = (v: string | number | null) =>
    `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  // Context toolbar — new registration, jump-to-search, refresh queue.
  useContextActions([
    {
      id: "new-registration",
      label: "New Registration",
      icon: FilePlus2,
      variant: "primary",
      onClick: () => navigate("/registration"),
    },
    {
      id: "search",
      label: "Search",
      icon: Search,
      onClick: () => searchRef.current?.focus(),
    },
    {
      id: "refresh",
      label: "Refresh",
      icon: RefreshCw,
      onClick: () => fetchOrders(search),
    },
  ]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-surface-100 p-3">
      <PageHeader
        title="Orders"
        subtitle="All lab orders — search, expand, invoice & report"
      />

      {/* STATS */}
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Orders" value={String(totalOrders)} icon={FileText} accent="accent" />
        <StatCard label="Pending Tests" value={String(pendingTests)} icon={Clock} accent="amber" />
        <StatCard label="Emergency" value={String(emergencyCount)} icon={AlertCircle} accent="red" />
        <StatCard label="Total Revenue" value={inr(totalRevenue)} icon={IndianRupee} accent="green" />
      </div>

      {/* SEARCH */}
      <div className="shrink-0 rounded-md border border-line-200 bg-surface-0 px-4 py-2.5 shadow-raised">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by order number, patient name, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              className="h-9 w-full rounded-md border border-line-300 bg-surface-0 pl-9 pr-9 text-sm transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); fetchOrders(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 transition-colors duration-fast hover:text-ink-600"
              >
                <XCircle className="size-4" />
              </button>
            )}
          </div>
          <button
            onClick={onSearch}
            className="h-9 shrink-0 rounded-md bg-accent-700 px-5 text-xs font-semibold text-surface-0 shadow-raised transition-colors duration-fast hover:bg-accent-500"
          >
            Search
          </button>
        </div>
      </div>

      {/* ORDERS LIST */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-raised">
        {loading ? (
          <LoadingState label="Loading orders…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchOrders(search)} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search ? "No orders match your search" : "No orders yet"}
            hint={search ? "Try a different search term" : "Register a patient to create the first order"}
            action={
              !search ? (
                <button
                  onClick={() => navigate("/registration")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                >
                  <FilePlus2 className="size-3.5" /> New Registration
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-line-200 bg-surface-100">
                  <th className="w-36 px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Order #</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Patient</th>
                  <th className="w-20 px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-ink-600">Tests</th>
                  <th className="w-24 px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-ink-600">Amount</th>
                  <th className="w-24 px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-ink-600">Payment</th>
                  <th className="w-20 px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-ink-600">Status</th>
                  <th className="w-12 px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-ink-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-200">
                {orders.map((order) => {
                  const isExpanded = expandedId === order.id;
                  const testCount = order.tests.length;
                  const completedTests = order.tests.filter(t => t.status === "completed").length;
                  const totalAmt = parseFloat(order.totalAmount || "0");
                  const balanceAmt = parseFloat(order.balanceAmount || "0");

                  return (
                    <tr
                      key={order.id}
                      className="cursor-pointer transition-colors duration-fast hover:bg-surface-100"
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`size-2 shrink-0 rounded-full ${priorityDot(order.priority)}`} />
                          <span className="data-mono text-xs font-bold text-ink-950">{order.orderNumber}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-100 text-[11px] font-bold text-accent-700">
                            {order.patient.firstName.charAt(0)}{order.patient.lastName.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-ink-950">
                              {order.patient.firstName} {order.patient.lastName}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-ink-600">
                              {order.patient.phone && (
                                <span className="flex items-center gap-0.5">
                                  <Phone className="size-3" />
                                  {order.patient.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-ink-950">{completedTests}/{testCount}</span>
                          {pendingTests > 0 && <span className="size-1.5 rounded-full bg-status-borderline" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium tabular-nums text-ink-950">{inr(totalAmt)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {balanceAmt > 0 ? (
                          <span className="text-xs font-medium text-status-critical">Due {inr(balanceAmt)}</span>
                        ) : (
                          <span className="flex items-center justify-center gap-1 text-xs font-medium text-status-normal">
                            <CheckCircle2 className="size-3" /> Paid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-medium ${statusBadge(order.status)}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isExpanded ? (
                          <ChevronUp className="inline size-4 text-ink-400" />
                        ) : (
                          <ChevronDown className="inline size-4 text-ink-400" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Expanded rows rendered outside table */}
            {expandedId && (() => {
              const order = orders.find(o => o.id === expandedId);
              if (!order) return null;
              return (
                <div className="border-t-2 border-accent-100 bg-accent-100/20 px-6 py-4">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {/* Tests */}
                    <div>
                      <h4 className="field-label mb-2">Ordered Tests</h4>
                      <div className="space-y-1.5">
                        {order.tests.map((test) => (
                          <div key={test.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <FlaskConical className="size-3.5 text-accent-500" />
                              <span className="text-ink-950">{test.testName}</span>
                              <span className="data-mono text-[11px] text-accent-700">({test.testCode})</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-ink-600">{inr(test.rate)}</span>
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                test.status === "completed" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                              }`}>
                                {test.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Billing */}
                    <div>
                      <h4 className="field-label mb-2">Billing Details</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-ink-600">Bill Amount</span><span className="font-medium text-ink-950">{inr(order.billAmount)}</span></div>
                        {parseFloat(order.otherCharges || "0") > 0 && <div className="flex justify-between"><span className="text-ink-600">Other Charges</span><span className="text-ink-950">{inr(order.otherCharges)}</span></div>}
                        {parseFloat(order.discountPercent || "0") > 0 && <div className="flex justify-between"><span className="text-ink-600">Discount</span><span className="text-status-normal">-{order.discountPercent}%</span></div>}
                        <div className="flex justify-between border-t border-line-200 pt-1 font-bold text-ink-950"><span>Total</span><span>{inr(order.totalAmount)}</span></div>
                        <div className="flex justify-between"><span className="text-ink-600">Paid</span><span className="text-status-normal">{inr(order.amountPaid)}</span></div>
                        {parseFloat(order.balanceAmount || "0") > 0 && <div className="flex justify-between"><span className="text-ink-600">Balance</span><span className="font-medium text-status-critical">{inr(order.balanceAmount)}</span></div>}
                      </div>
                      {order.paymentMode && (
                        <div className="mt-2 text-[11px] text-ink-400">
                          Payment: {order.paymentMode}{order.deliveryMode ? ` | Delivery: ${order.deliveryMode}` : ""}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div>
                      <h4 className="field-label mb-2">Order Info</h4>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center gap-2 text-ink-600">
                          <Calendar className="size-3.5" />
                          <span>{new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {order.category && <div className="text-ink-600"><span className="text-ink-400">Category:</span> {order.category}</div>}
                        {order.source && <div className="text-ink-600"><span className="text-ink-400">Source:</span> {order.source}</div>}
                        {order.emergency && <div className="flex items-center gap-1.5 font-medium text-status-critical"><AlertCircle className="size-3.5" /> Emergency</div>}
                        <div className="flex items-center gap-2 text-ink-600">
                          <User className="size-3.5" />
                          <span className="capitalize">{order.patient.gender || "N/A"}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/orders/${order.id}/invoice`);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-2.5 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                          >
                            <FileText className="size-3.5" /> Invoice
                          </button>
                          {order.status === "approved" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/orders/${order.id}/report`);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-md bg-accent-100 px-2.5 py-1.5 text-xs font-semibold text-accent-700 transition-colors duration-fast hover:bg-accent-500 hover:text-surface-0"
                            >
                              <FileText className="size-3.5" /> View Report
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
