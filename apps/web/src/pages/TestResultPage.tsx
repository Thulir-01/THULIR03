import { useState, useEffect, useRef, useMemo, Fragment, type ReactNode } from "react";
import {
  Search, FlaskConical, Loader2, CheckCircle2, Clock,
  Save, Phone, Calendar, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { getOrders, getOrder, updateTestResult, verifyOrder, type OrderListItem, type TestChild } from "../lib/api-client";

function getFlag(result: string, refLow: number | null, refHigh: number | null): { icon: ReactNode; color: string; title: string } | null {
  if (!result || (refLow === null && refHigh === null)) return null;
  const val = parseFloat(result);
  if (isNaN(val)) return null;
  if (refHigh !== null && val > refHigh) return { icon: <ArrowUp className="w-3.5 h-3.5" />, color: "text-red-600", title: "High" };
  if (refLow !== null && val < refLow) return { icon: <ArrowDown className="w-3.5 h-3.5" />, color: "text-red-600", title: "Low" };
  return null;
}

type ResultMap = Record<string, { result: string; unit: string; refRange: string; notes: string }>;

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
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<{ id: string; orderNumber: string; status: string; emergency: boolean; createdAt: string; patient: { id: string; firstName: string; lastName: string; title: string | null; phone: string | null; gender: string | null; dateOfBirth: string | null }; tests: TestChild[] } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [results, setResults] = useState<ResultMap>({});
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  // Ref registry for Result inputs so Tab can jump straight to the next
  // test's Result box (fast data-entry flow).
  const resultRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Visible, editable result rows in display order (profile children only
  // when the package is expanded; profile headers have no result box).
  const visibleResultTests = useMemo(() => {
    const list: TestChild[] = [];
    const walk = (tests: TestChild[]) => {
      for (const t of tests) {
        if (t.isProfile && t.children?.length) {
          if (expandedProfiles.has(t.id)) walk(t.children);
        } else {
          list.push(t);
        }
      }
    };
    if (orderDetail) walk(orderDetail.tests);
    return list;
  }, [orderDetail, expandedProfiles]);

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
          r[t.id] = { result: t.result || "", unit: t.unit || "", refRange: t.refRange || "", notes: t.notes || "" };
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
          status: data.result ? "completed" : "pending",
          notes: data.notes || undefined,
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

  const [verifying, setVerifying] = useState(false);

  const doVerify = async () => {
    if (!orderDetail) return;
    setVerifying(true);
    try {
      const updated = await verifyOrder(orderDetail.id);
      setOrderDetail((prev) => (prev ? { ...prev, status: updated.status } : prev));
    } catch {
      alert("Verification failed — all results must be completed first.");
    } finally {
      setVerifying(false);
    }
  };

  const pendingCount = orderDetail ? countPending(orderDetail.tests) : 0;
  const allTestCount = orderDetail ? countTotal(orderDetail.tests) : 0;
  const completedCount = allTestCount - pendingCount;

  // Box classes — one height everywhere; pr-7 keeps room for the flag overlay.
  const boxCls = (isCompleted: boolean) =>
    isCompleted
      ? "w-full h-9 pl-3 pr-7 border rounded-md text-[13px] bg-green-50 border-green-200 text-green-800 font-medium cursor-default"
      : "w-full h-9 pl-3 pr-7 border rounded-md text-[13px] bg-white border-gray-300 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 transition-colors";
  const plainBoxCls = (isCompleted: boolean) =>
    isCompleted
      ? "w-full h-9 px-3 border rounded-md text-[13px] bg-green-50 border-green-200 text-green-800 font-medium cursor-default"
      : "w-full h-9 px-3 border rounded-md text-[13px] bg-white border-gray-300 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 transition-colors";

  const renderTestRow = (test: TestChild, depth: number = 0) => {
    const r = results[test.id] || { result: "", unit: "", refRange: "", notes: "" };
    const isCompleted = test.status === "completed";
    const isProfile = test.isProfile && test.children && test.children.length > 0;
    const isExpanded = expandedProfiles.has(test.id);
    const flag = getFlag(r.result || test.result || "", test.refLow, test.refHigh);

    // Profile package: a real grid row (same 6 columns) with an expander.
    if (isProfile) {
      return (
        <Fragment key={test.id}>
          <tr
            onClick={() => toggleProfile(test.id)}
            className={`cursor-pointer border-b border-gray-100 transition-colors ${isExpanded ? "bg-teal-50/70 hover:bg-teal-50/90" : "bg-teal-50/40 hover:bg-teal-50/70"}`}
          >
            <td className="px-3 py-2">
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronUp className="w-4 h-4 text-teal-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-teal-500 shrink-0" />}
                <FlaskConical className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="font-semibold text-sm text-gray-800 truncate">{test.testName} ({test.testCode})</span>
                <span className="text-[11px] text-gray-400 shrink-0 ml-1">
                  {test.children!.filter((c) => c.status === "completed").length}/{test.children!.length} done
                </span>
              </div>
            </td>
            <td className="px-2 py-2" />
            <td className="px-2 py-2" />
            <td className="px-2 py-2" />
            <td className="px-2 py-2" />
            <td className="px-2 py-2 text-center">
              <span className="text-[11px] font-medium text-teal-600">{test.children!.length} params</span>
            </td>
          </tr>
          {isExpanded && test.children!.map((child) => renderTestRow(child, depth + 1))}
        </Fragment>
      );
    }

    // Standalone test / profile child: 6 cells exactly matching the header.
    return (
      <Fragment key={test.id}>
        <tr className={`border-b border-gray-100 transition-colors hover:bg-gray-50/50 ${isCompleted ? "bg-green-50/30" : ""}`}>
          <td className="px-3 py-1.5">
            <div className="flex items-center gap-2">
              {depth > 0 && <div className="w-4 h-px bg-gray-300 mr-0.5 shrink-0" />}
              <FlaskConical className={`w-3.5 h-3.5 shrink-0 ${isCompleted ? "text-green-500" : "text-teal-500"}`} />
              <div className="min-w-0">
                <div className={`text-sm leading-tight truncate ${isCompleted ? "text-green-800" : "text-gray-800"} ${depth > 0 ? "font-normal" : "font-medium"}`}>
                  {test.testName}
                </div>
                <div className="text-[10px] text-gray-400 font-mono">{test.testCode}</div>
              </div>
            </div>
          </td>
          <td className="px-2 py-1.5">
            <div className="relative">
              <input
                type="text"
                value={r.result}
                onChange={(e) => setResults(prev => ({ ...prev, [test.id]: { ...prev[test.id], result: e.target.value } }))}
                onKeyDown={(e) => {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const idx = visibleResultTests.findIndex((t) => t.id === test.id);
                    const next = e.shiftKey ? visibleResultTests[idx - 1] : visibleResultTests[idx + 1];
                    if (next) resultRefs.current[next.id]?.focus();
                  }
                }}
                ref={(el) => { if (el) resultRefs.current[test.id] = el; else delete resultRefs.current[test.id]; }}
                placeholder={isCompleted ? test.result || "—" : "Type result…"}
                className={boxCls(isCompleted)}
                readOnly={isCompleted}
              />
              <span
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${flag ? flag.color : isCompleted ? "text-green-400" : "text-gray-200"}`}
                title={flag?.title}
              >
                {flag ? flag.icon : isCompleted ? <Minus className="w-3.5 h-3.5" /> : null}
              </span>
            </div>
          </td>
          <td className="px-2 py-1.5">
            <div
              className="w-full h-9 px-3 border rounded-md text-[13px] bg-gray-50 border-gray-200 text-gray-500 flex items-center truncate"
              title={test.unit || undefined}
            >
              {test.unit || "—"}
            </div>
          </td>
          <td className="px-2 py-1.5">
            <div
              className="w-full h-9 px-3 border rounded-md text-[13px] bg-gray-50 border-gray-200 text-gray-500 flex items-center truncate"
              title={test.refRange || undefined}
            >
              {test.refRange || "—"}
            </div>
          </td>
          <td className="px-2 py-1.5">
            <input
              type="text"
              value={r.notes}
              onChange={(e) => setResults(prev => ({ ...prev, [test.id]: { ...prev[test.id], notes: e.target.value } }))}
              placeholder="Notes…"
              className={plainBoxCls(false)}
            />
          </td>
          <td className="px-2 py-1.5 text-center">
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
        </tr>
      </Fragment>
    );
  };

  return (
    <div className="h-full w-full overflow-hidden bg-surface-100 flex flex-col">
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
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        orderDetail.status === "approved" || orderDetail.status === "verified"
                          ? "text-teal-600"
                          : pendingCount === 0 ? "text-green-600" : "text-amber-600"
                      }`}>
                        {orderDetail.status === "approved" ? (
                          <><CheckCircle2 className="w-3 h-3" /> Approved</>
                        ) : orderDetail.status === "verified" ? (
                          <><CheckCircle2 className="w-3 h-3" /> Verified — awaiting approval</>
                        ) : pendingCount === 0 ? (
                          <><CheckCircle2 className="w-3 h-3" /> Completed</>
                        ) : (
                          <><Clock className="w-3 h-3" /> {pendingCount} pending</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Test results table */}
              <div className="flex-1 bg-white rounded-lg border border-gray-200/80 shadow-sm min-h-0 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Test Results</h3>
                  <div className="flex items-center gap-2">
                    {pendingCount > 0 && (
                      <button onClick={saveAll} disabled={saving !== null}
                        className="h-7 px-3 bg-teal-600 text-white rounded text-[11px] font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-1">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Save All ({pendingCount})
                      </button>
                    )}
                    {orderDetail.status === "completed" && pendingCount === 0 && (
                      <button onClick={doVerify} disabled={verifying}
                        title="Confirm all results are correct — moves the order to verified (next: pathologist approval)"
                        className="h-7 px-3 bg-teal-600 text-white rounded text-[11px] font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-1">
                        {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Verify & Send for Approval
                      </button>
                    )}
                    {orderDetail.status === "verified" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600">
                        <CheckCircle2 className="w-3 h-3" /> Verified — sent to pathologist
                      </span>
                    )}
                    {orderDetail.status === "approved" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600">
                        <CheckCircle2 className="w-3 h-3" /> Approved — report ready
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[30%]" />
                      <col className="w-[20%]" />
                      <col className="w-[10%]" />
                      <col className="w-[13%]" />
                      <col className="w-[17%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50/95 border-b border-gray-200">
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Test</th>
                        <th className="text-left px-2 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Result ⚑</th>
                        <th className="text-left px-2 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Unit</th>
                        <th className="text-left px-2 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Ref Range</th>
                        <th className="text-left px-2 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Notes</th>
                        <th className="text-center px-2 py-2.5 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {orderDetail.tests.map((test) => renderTestRow(test))}
                    </tbody>
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
