import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  Search, FlaskConical, Loader2, CheckCircle2, Clock,
  Save, Phone, Calendar, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { getOrders, getOrder, updateTestResult, type OrderListItem, type TestChild } from "../lib/api-client";

function getFlag(result: string, refLow: number | null, refHigh: number | null): { icon: ReactNode; color: string; title: string } | null {
  if (!result || (refLow === null && refHigh === null)) return null;
  const val = parseFloat(result);
  if (isNaN(val)) return null;
  if (refHigh !== null && val > refHigh) return { icon: <ArrowUp className="w-3.5 h-3.5" />, color: "text-red-600", title: "High" };
  if (refLow !== null && val < refLow) return { icon: <ArrowDown className="w-3.5 h-3.5" />, color: "text-red-600", title: "Low" };
  return null;
}

type ResultMap = Record<string, { result: string; unit: string; refRange: string }>;

function collectTestsRecursive(tests: TestChild[]): TestChild[] {
  const all: TestChild[] = [];
  for (const t of tests) {
    all.push(t);
    if (t.children?.length) all.push(...collectTestsRecursive(t.children));
  }
  return all;
}

function countPending(tests: TestChild[]): number {
  let count = 0;
  for (const t of tests) {
    if (t.status !== "completed") count++;
    if (t.children?.length) count += countPending(t.children);
  }
  return count;
}

function countTotal(tests: TestChild[]): number {
  let c = 0;
  for (const t of tests) {
    c++;
    if (t.children?.length) c += countTotal(t.children);
  }
  return c;
}

export default function TestResultPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<{ id: string; orderNumber: string; status: string; emergency: boolean; createdAt: string; patient: { id: string; firstName: string; lastName: string; title: string | null; phone: string | null; gender: string | null; dateOfBirth: string | null }; tests: TestChild[] } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [results, setResults] = useState<ResultMap>({});
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchOrders(); }, []);

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

  const onSearch = () => {
    fetchOrders(search);
    setSelectedOrderId(null);
    setOrderDetail(null);
  };

  const selectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setOrderDetail(null);
    setResults({});
    try {
      const detail = await getOrder(orderId);
      setOrderDetail(detail);
      const r: ResultMap = {};
      const collect = (tests: TestChild[]) => {
        tests.forEach((t) => {
          r[t.id] = { result: t.result || "", unit: t.unit || "", refRange: t.refRange || "" };
          if (t.children?.length) collect(t.children);
        });
      };
      collect(detail.tests);
      setResults(r);
    } catch {
      setSelectedOrderId(null);
      setOrderDetail(null);
    }
  };

  const saveResult = async (testId: string) => {
    setSaving(testId);
    try {
      const data = results[testId];
      if (!data || !orderDetail) return;
      await updateTestResult(orderDetail.id, testId, {
        result: data.result || undefined,
        unit: data.unit || undefined,
        refRange: data.refRange || undefined,
        status: data.result ? "completed" : "pending",
      });
      const detail = await getOrder(orderDetail.id);
      setOrderDetail(detail);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  };

  const saveAll = async () => {
    if (!orderDetail) return;
    const allTests = collectTestsRecursive(orderDetail.tests);
    const pendingTests = allTests.filter(t => t.status !== "completed" && !t.isProfile);
    for (const test of pendingTests) {
      setSaving(test.id);
      try {
        const data = results[test.id];
        if (!data) continue;
        await updateTestResult(orderDetail.id, test.id, {
          result: data.result || undefined,
          unit: data.unit || undefined,
          refRange: data.refRange || undefined,
          status: data.result ? "completed" : "pending",
        });
      } catch {
        // continue
      }
    }
    setSaving(null);
    try {
      const detail = await getOrder(orderDetail.id);
      setOrderDetail(detail);
    } catch {
      // silent
    }
  };

  const toggleProfile = (id: string) => {
    setExpandedProfiles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pendingCount = orderDetail ? countPending(orderDetail.tests) : 0;
  const allTestCount = orderDetail ? countTotal(orderDetail.tests) : 0;
  const completedCount = allTestCount - pendingCount;

  const renderTestRow = (test: TestChild, depth: number = 0) => {
    const r = results[test.id] || { result: "", unit: "", refRange: "" };
    const isCompleted = test.status === "completed";
    const isSaving = saving === test.id;
    const isProfile = test.isProfile && test.children && test.children.length > 0;
    const isExpanded = expandedProfiles.has(test.id);
    const flag = getFlag(r.result || test.result || "", test.refLow, test.refHigh);

    return (
      <tbody key={test.id} className="divide-y divide-gray-50">
        {isProfile && (
          <tr className="bg-teal-50/50 hover:bg-teal-50/80 transition-colors cursor-pointer" onClick={() => toggleProfile(test.id)}>
            <td className="px-4 py-2.5" colSpan={6}>
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronUp className="w-4 h-4 text-teal-500" /> : <ChevronDown className="w-4 h-4 text-teal-500" />}
                <FlaskConical className="w-4 h-4 text-teal-600" />
                <span className="font-semibold text-sm text-gray-800">{test.testName} ({test.testCode})</span>
                <span className="text-xs text-gray-400">— {test.children!.length} parameters</span>
                <span className="ml-auto text-xs font-medium">
                  {test.children!.filter((c) => c.status === "completed").length}/{test.children!.length} done
                </span>
              </div>
            </td>
          </tr>
        )}
        {isProfile && isExpanded && test.children!.map((child) => renderTestRow(child, depth + 1))}
        {!isProfile && (
          <tr className={`hover:bg-gray-50/50 transition-colors ${isCompleted ? "bg-green-50/30" : ""}`}>
            <td className="px-4 py-2.5 pl-4">
              <div className="flex items-center gap-2">
                {depth > 0 && <div className="w-4 h-px bg-gray-300 mr-1 shrink-0" />}
                <FlaskConical className={`w-3.5 h-3.5 shrink-0 ${isCompleted ? "text-green-500" : "text-teal-500"}`} />
                <div>
                  <div className={`text-sm ${isCompleted ? "text-green-800" : "text-gray-800"} ${depth > 0 ? "font-normal" : "font-medium"}`}>
                    {test.testName}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">{test.testCode}</div>
                </div>
              </div>
            </td>
            <td className="px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <input type="text"
                  value={r.result}
                  onChange={(e) => setResults(prev => ({ ...prev, [test.id]: { ...prev[test.id], result: e.target.value } }))}
                  placeholder={isCompleted ? test.result || "—" : "Result"}
                  className={`w-full h-7 px-2 border rounded text-sm transition-colors ${
                    isCompleted
                      ? "bg-green-50 border-green-200 text-green-800 font-medium cursor-default"
                      : "bg-white border-gray-300 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
                  }`}
                  readOnly={isCompleted}
                />
                {flag && <span className={`shrink-0 ${flag.color}`} title={flag.title}>{flag.icon}</span>}
                {!flag && isCompleted && <span className="shrink-0 text-green-400"><Minus className="w-3.5 h-3.5" /></span>}
              </div>
            </td>
            <td className="px-3 py-2.5">
              <input type="text"
                value={r.unit}
                onChange={(e) => setResults(prev => ({ ...prev, [test.id]: { ...prev[test.id], unit: e.target.value } }))}
                placeholder={isCompleted ? test.unit || "—" : "Unit"}
                className={`w-full h-7 px-2 border rounded text-sm transition-colors ${
                  isCompleted
                    ? "bg-green-50 border-green-200 text-green-800 cursor-default"
                    : "bg-white border-gray-300 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
                }`}
                readOnly={isCompleted}
              />
            </td>
            <td className="px-3 py-2.5">
              <input type="text"
                value={r.refRange}
                onChange={(e) => setResults(prev => ({ ...prev, [test.id]: { ...prev[test.id], refRange: e.target.value } }))}
                placeholder={isCompleted ? test.refRange || "—" : "Range"}
                className={`w-full h-7 px-2 border rounded text-sm transition-colors ${
                  isCompleted
                    ? "bg-green-50 border-green-200 text-green-800 cursor-default"
                    : "bg-white border-gray-300 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
                }`}
                readOnly={isCompleted}
              />
            </td>
            <td className="px-3 py-2.5 text-center">
              {isCompleted ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-green-600">
                  <CheckCircle2 className="w-3 h-3" /> Done
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600">
                  <Clock className="w-3 h-3" /> Pending
                </span>
              )}
            </td>
            <td className="px-3 py-2.5 text-center">
              {isCompleted ? (
                <span className="text-[11px] text-green-500">Saved</span>
              ) : (
                <button onClick={() => saveResult(test.id)}
                  disabled={isSaving || !r.result}
                  className="h-7 px-2.5 bg-teal-600 text-white rounded text-[11px] font-semibold hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 mx-auto">
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save
                </button>
              )}
            </td>
          </tr>
        )}
      </tbody>
    );
  };

  return (
    <div className="h-full w-full overflow-hidden bg-gray-100 flex flex-col">
      {/* TOP BAR */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-base tracking-wide">THULIR03</span>
          <span className="text-teal-300/60">|</span>
          <span className="text-sm font-medium text-teal-50">Test Results Entry</span>
        </div>
        <button onClick={() => navigate("/dashboard")}
          className="text-xs px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white transition-colors font-medium">
          Dashboard
        </button>
      </div>

      <div className="flex-1 overflow-hidden p-3">
        <div className="h-full flex gap-3">
          {/* LEFT: Orders list */}
          <div className={`flex flex-col gap-3 min-h-0 ${orderDetail ? "w-[35%]" : "w-full"}`}>
            <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-2.5 shrink-0 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input ref={searchRef}
                    type="text" placeholder="Search by order#, name..." value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSearch()}
                    className="w-full h-9 pl-9 pr-3 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 transition-colors"
                  />
                </div>
                <button onClick={onSearch}
                  className="h-9 px-4 bg-teal-600 text-white rounded-md text-xs font-semibold hover:bg-teal-700 transition-colors shrink-0">Search</button>
              </div>
            </div>
            <div className="flex-1 bg-white rounded-lg border border-gray-200/80 shadow-sm min-h-0 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
              ) : orders.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">{search ? "No matches" : "No orders"}</div>
              ) : (
                <div className="h-full overflow-y-auto divide-y divide-gray-50">
                  {orders.map((order) => {
                    const total = order.tests.reduce((s, t) => s + 1 + (t.children?.length || 0), 0);
                    const doneOrder = order.tests.reduce((s, t) => s + (t.status === "completed" ? 1 : 0) + (t.children?.filter(c => c.status === "completed").length || 0), 0);
                    const isSelected = selectedOrderId === order.id;
                    return (
                      <button key={order.id} onClick={() => selectOrder(order.id)}
                        className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 ${isSelected ? "bg-teal-50 border-l-2 border-teal-500" : ""}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center text-teal-700 font-bold text-xs shrink-0">
                            {order.patient.firstName.charAt(0)}{order.patient.lastName?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-gray-800 truncate">{order.patient.firstName} {order.patient.lastName}</span>
                              {order.emergency && <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5 font-mono">{order.orderNumber}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-xs font-bold ${doneOrder < total ? "text-amber-600" : "text-green-600"}`}>{doneOrder}/{total}</div>
                            <div className="text-[10px] text-gray-400">done</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Results panel */}
          {orderDetail && (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              {/* Order info header */}
              <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shrink-0 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
                      {orderDetail.patient.firstName.charAt(0)}{orderDetail.patient.lastName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-gray-900">{orderDetail.patient.firstName} {orderDetail.patient.lastName}</h2>
                        {orderDetail.emergency && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-medium">EMERGENCY</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="font-mono font-medium text-teal-600">{orderDetail.orderNumber}</span>
                        {orderDetail.patient.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{orderDetail.patient.phone}</span>}
                        {orderDetail.patient.gender && <span className="capitalize">{orderDetail.patient.gender}</span>}
                        <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{new Date(orderDetail.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Params</div>
                      <div className="font-bold text-sm">{completedCount}/{allTestCount}</div>
                    </div>
                    <div className="w-px h-8 bg-gray-200" />
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Status</div>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${pendingCount === 0 ? "text-green-600" : "text-amber-600"}`}>
                        {pendingCount === 0 ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {pendingCount === 0 ? "Completed" : `${pendingCount} pending`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Test results table */}
              <div className="flex-1 bg-white rounded-lg border border-gray-200/80 shadow-sm min-h-0 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Test Results</h3>
                  {pendingCount > 0 && (
                    <button onClick={saveAll} disabled={saving !== null}
                      className="h-7 px-3 bg-teal-600 text-white rounded text-[11px] font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-1">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save All ({pendingCount})
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50/95 border-b border-gray-200">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Test</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-28">Result ⚑</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-20">Unit</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-28">Ref Range</th>
                        <th className="text-center px-4 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-14">Status</th>
                        <th className="text-center px-4 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-20">Action</th>
                      </tr>
                    </thead>
                    {orderDetail.tests.map((test) => renderTestRow(test))}
                  </table>
                  {orderDetail.tests.length === 0 && (
                    <div className="text-center py-16 text-gray-400">
                      <FlaskConical className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No tests in this order</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
