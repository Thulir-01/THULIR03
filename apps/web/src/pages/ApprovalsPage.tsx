import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldCheck,
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

function getFlag(
  result: string | null,
  refLow: number | null,
  refHigh: number | null,
): { icon: React.ReactNode; title: string } | null {
  if (!result || (refLow === null && refHigh === null)) return null;
  const val = parseFloat(result);
  if (isNaN(val)) return null;
  if (refHigh !== null && val > refHigh)
    return { icon: <ArrowUp className="w-3 h-3" />, title: "High" };
  if (refLow !== null && val < refLow)
    return { icon: <ArrowDown className="w-3 h-3" />, title: "Low" };
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
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OrderListItem | null>(null);
  const [detail, setDetail] = useState<{
    id: string;
    orderNumber: string;
    status: string;
    emergency: boolean;
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
    setError("");
    try {
      const data = await getOrders(q || undefined);
      // Approval queue = orders a technician has verified, awaiting the
      // pathologist's NABL sign-off.
      setOrders(data.filter((o) => o.status === "verified"));
    } catch {
      setOrders([]);
      setError("Failed to load the approval queue.");
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

  return (
    <div className="h-full w-full overflow-hidden bg-gray-100 flex flex-col">
      {/* TOP BAR */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-base tracking-wide">THULIR03</span>
          <span className="text-teal-300/60">|</span>
          <span className="text-sm font-medium text-teal-50 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Pathologist Approval
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/orders")}
            className="text-xs px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white transition-colors font-medium">
            Orders
          </button>
          <button onClick={() => navigate("/dashboard")}
            className="text-xs px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white transition-colors font-medium">
            Dashboard
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-3">
        <div className="h-full flex gap-3">
          {/* LEFT: verified queue */}
          <div className={`flex flex-col gap-3 min-h-0 ${detail ? "w-[35%]" : "w-full"}`}>
            <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-2.5 shrink-0 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search verified orders…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 transition-colors"
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 bg-white rounded-lg border border-gray-200/80 shadow-sm min-h-0 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm px-6 text-center">
                  <div>
                    <ShieldCheck className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    {search
                      ? "No verified orders match your search."
                      : "No orders waiting for approval — technicians verify results first."}
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto divide-y divide-gray-50">
                  {orders.map((order) => {
                    const done = flatten(order.tests as unknown as TestChild[]).filter(
                      (t) => t.status === "completed",
                    ).length;
                    return (
                      <button key={order.id} onClick={() => select(order)}
                        className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 ${
                          selected?.id === order.id
                            ? "bg-teal-50 border-l-2 border-teal-500"
                            : ""
                        }`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center text-teal-700 font-bold text-xs shrink-0">
                            {order.patient.firstName.charAt(0)}
                            {order.patient.lastName?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-gray-800 truncate">
                                {order.patient.firstName} {order.patient.lastName}
                              </span>
                              {order.emergency && (
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5 font-mono">
                              {order.orderNumber}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600">
                              <CheckCircle2 className="w-3 h-3" /> {done} done
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
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shrink-0 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
                      {detail.patient.firstName.charAt(0)}
                      {detail.patient.lastName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-gray-900">
                          {detail.patient.title ? `${detail.patient.title} ` : ""}
                          {detail.patient.firstName} {detail.patient.lastName}
                        </h2>
                        {detail.emergency && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-medium">
                            EMERGENCY
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="font-mono font-medium text-teal-600">
                          {detail.orderNumber}
                        </span>
                        {detail.patient.phone && (
                          <span className="flex items-center gap-0.5">
                            <Phone className="w-3 h-3" />
                            {detail.patient.phone}
                          </span>
                        )}
                        {detail.patient.gender && (
                          <span className="capitalize">{detail.patient.gender}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={doApprove} disabled={approving}
                    title="Approve with NABL e-signature — stamps every result and unlocks the report"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 shadow-sm">
                    {approving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    Approve & Sign Report
                  </button>
                </div>
                {flagged.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {flagged.length} result{flagged.length > 1 ? "s" : ""} outside
                    reference range — flagged on the report
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 shrink-0">
                  {error}
                </div>
              )}

              <div className="flex-1 bg-white rounded-lg border border-gray-200/80 shadow-sm min-h-0 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50/95 border-b border-gray-200">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Test</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Result</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Unit</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Ref Range</th>
                      <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Notes</th>
                      <th className="text-center px-3 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allTests.map((t) => {
                      const flag = getFlag(t.result, t.refLow, t.refHigh);
                      const isParent = !!t.children?.length;
                      return (
                        <tr key={t.id} className={isParent ? "bg-teal-50/40" : ""}>
                          <td className="px-4 py-2 text-sm text-gray-800">
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
                                <span className="text-red-600" title={flag.title}>
                                  {flag.icon}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{t.unit ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{t.refRange ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-400 text-xs">
                            {t.notes || "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {t.status === "completed" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600">
                                <CheckCircle2 className="w-3 h-3" /> Done
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                                <Clock className="w-3 h-3" /> Pending
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
    </div>
  );
}
