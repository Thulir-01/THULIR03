import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Search, FileText, Clock, IndianRupee, ChevronDown, ChevronUp,
  Loader2, FilePlus2, Phone, Calendar, User, AlertCircle,
  CheckCircle2, XCircle, FlaskConical,
} from "lucide-react";
import { getOrders, type OrderListItem } from "../lib/api-client";

export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchOrders = async (q?: string) => {
    setLoading(true);
    try {
      const data = await getOrders(q || undefined);
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
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
      cancelled: "bg-red-50 text-red-700 border-red-200",
    };
    return map[status] || "bg-gray-50 text-gray-600 border-gray-200";
  };

  const priorityDot = (priority: string) => {
    if (priority === "stat") return "bg-red-500";
    if (priority === "urgent") return "bg-amber-500";
    return "bg-gray-300";
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100 flex flex-col">
      {/* TOP BAR */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-base tracking-wide">THULIR03</span>
          <span className="text-teal-300/60">|</span>
          <span className="text-sm font-medium text-teal-50">Orders</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/registration")}
            className="text-xs px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white transition-colors font-medium flex items-center gap-1.5">
            <FilePlus2 className="w-3.5 h-3.5" /> New Registration
          </button>
          <button onClick={() => navigate("/dashboard")}
            className="text-xs px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white transition-colors font-medium">
            Dashboard
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-3">
        <div className="h-full flex flex-col gap-3">

          {/* STATS */}
          <div className="grid grid-cols-4 gap-3 shrink-0">
            <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                  <FileText className="w-4.5 h-4.5 text-teal-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{totalOrders}</p>
                  <p className="text-[11px] text-gray-500">Total Orders</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Clock className="w-4.5 h-4.5 text-amber-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{pendingTests}</p>
                  <p className="text-[11px] text-gray-500">Pending Tests</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertCircle className="w-4.5 h-4.5 text-red-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{emergencyCount}</p>
                  <p className="text-[11px] text-gray-500">Emergency</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center">
                  <IndianRupee className="w-4.5 h-4.5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">₹{totalRevenue.toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                  <p className="text-[11px] text-gray-500">Total Revenue</p>
                </div>
              </div>
            </div>
          </div>

          {/* SEARCH */}
          <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-2.5 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input ref={searchRef}
                  type="text"
                  placeholder="Search by order number, patient name, or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  className="w-full h-9 pl-9 pr-9 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 transition-colors"
                />
                {search && (
                  <button onClick={() => { setSearch(""); fetchOrders(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button onClick={onSearch}
                className="h-9 px-5 bg-teal-600 text-white rounded-md text-xs font-semibold hover:bg-teal-700 transition-colors shadow-sm shrink-0">
                Search
              </button>
            </div>
          </div>

          {/* ORDERS LIST */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] min-h-0 overflow-hidden flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                  <p className="text-sm text-gray-400">Loading orders...</p>
                </div>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-gray-200 mx-auto mb-3" />
                  <p className="text-base font-medium text-gray-400">
                    {search ? "No orders match your search" : "No orders yet"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {search ? "Try a different search term" : "Register a patient to create the first order"}
                  </p>
                  {!search && (
                    <button onClick={() => navigate("/registration")}
                      className="mt-4 px-5 h-9 bg-teal-600 text-white rounded-md text-xs font-semibold hover:bg-teal-700 transition-colors">
                      New Registration
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50/95 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-36">Order #</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Patient</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-20">Tests</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-24">Amount</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-24">Payment</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-20">Status</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {orders.map((order) => {
                      const isExpanded = expandedId === order.id;
                      const testCount = order.tests.length;
                      const completedTests = order.tests.filter(t => t.status === "completed").length;
                      const totalAmt = parseFloat(order.totalAmount || "0");
                      const balanceAmt = parseFloat(order.balanceAmount || "0");

                      return (
                        <tr key={order.id}
                          className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${priorityDot(order.priority)} shrink-0`} />
                              <span className="font-mono text-xs font-bold text-gray-700">{order.orderNumber}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center text-teal-700 font-bold text-[11px] shrink-0">
                                {order.patient.firstName.charAt(0)}{order.patient.lastName.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-800">
                                  {order.patient.firstName} {order.patient.lastName}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                  {order.patient.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{order.patient.phone}</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-gray-700">{completedTests}/{testCount}</span>
                              {pendingTests > 0 && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-medium tabular-nums text-sm">₹{totalAmt.toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {balanceAmt > 0 ? (
                              <span className="text-xs text-red-600 font-medium">Due ₹{balanceAmt.toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                            ) : (
                              <span className="text-xs text-green-600 font-medium flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Paid
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-md border ${statusBadge(order.status)}`}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-300 inline" /> : <ChevronDown className="w-4 h-4 text-gray-300 inline" />}
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
                    <div className="border-t-2 border-teal-100 bg-teal-50/30 px-6 py-4">
                      <div className="grid grid-cols-3 gap-6">
                        {/* Tests */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ordered Tests</h4>
                          <div className="space-y-1.5">
                            {order.tests.map((test) => (
                              <div key={test.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <FlaskConical className="w-3.5 h-3.5 text-teal-500" />
                                  <span className="text-gray-700">{test.testName}</span>
                                  <span className="text-[11px] font-mono text-teal-600">({test.testCode})</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-500 font-medium">₹{parseFloat(test.rate).toLocaleString('en-IN')}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                    test.status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
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
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Billing Details</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Bill Amount</span><span className="font-medium">₹{parseFloat(order.billAmount || "0").toLocaleString('en-IN')}</span></div>
                            {parseFloat(order.otherCharges || "0") > 0 && <div className="flex justify-between"><span className="text-gray-500">Other Charges</span><span>₹{parseFloat(order.otherCharges || "0").toLocaleString('en-IN')}</span></div>}
                            {parseFloat(order.discountPercent || "0") > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="text-green-600">-{order.discountPercent}%</span></div>}
                            <div className="flex justify-between font-bold border-t border-gray-200 pt-1"><span>Total</span><span>₹{parseFloat(order.totalAmount || "0").toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="text-green-600">₹{parseFloat(order.amountPaid || "0").toLocaleString('en-IN')}</span></div>
                            {parseFloat(order.balanceAmount || "0") > 0 && <div className="flex justify-between"><span className="text-gray-500">Balance</span><span className="text-red-600 font-medium">₹{parseFloat(order.balanceAmount || "0").toLocaleString('en-IN')}</span></div>}
                          </div>
                          {order.paymentMode && (
                            <div className="mt-2 text-[11px] text-gray-400">
                              Payment: {order.paymentMode}{order.deliveryMode ? ` | Delivery: ${order.deliveryMode}` : ""}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Order Info</h4>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            {order.category && <div className="text-gray-600"><span className="text-gray-400">Category:</span> {order.category}</div>}
                            {order.source && <div className="text-gray-600"><span className="text-gray-400">Source:</span> {order.source}</div>}
                            {order.emergency && <div className="flex items-center gap-1.5 text-red-600 font-medium"><AlertCircle className="w-3.5 h-3.5" /> Emergency</div>}
                            <div className="flex items-center gap-2 text-gray-600">
                              <User className="w-3.5 h-3.5" />
                              <span className="capitalize">{order.patient.gender || "N/A"}</span>
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
      </div>
    </div>
  );
}
