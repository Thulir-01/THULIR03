import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  IndianRupee,
  Receipt,
  Wallet,
  TrendingUp,
  FlaskConical,
  UserRound,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { getAnalytics, type AnalyticsReport } from "../lib/api-client";

function inr(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtDay(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function ReportsPage() {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async (f?: string, t?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnalytics(
        f || t ? { from: f || undefined, to: t || undefined } : undefined,
      );
      setReport(data);
    } catch {
      setError("Failed to load analytics. Please try again.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyRange = () => load(from, to);

  const maxBilled = report
    ? Math.max(...report.dailySeries.map((d) => d.billed), 1)
    : 1;

  const statsCards = report
    ? [
        {
          label: "Total Billed",
          value: inr(report.revenue.totalBilled),
          color: "text-teal-600",
          bg: "bg-teal-50",
          icon: Receipt,
          sub: `${report.revenue.orderCount} orders`,
        },
        {
          label: "Collected",
          value: inr(report.revenue.totalCollected),
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          icon: Wallet,
          sub: `${report.revenue.totalDiscount ? `${inr(report.revenue.totalDiscount)} discounts` : "no discounts"}`,
        },
        {
          label: "Outstanding",
          value: inr(report.revenue.totalOutstanding),
          color: "text-amber-600",
          bg: "bg-amber-50",
          icon: IndianRupee,
          sub: "unpaid balance",
        },
        {
          label: "Referrer Payouts",
          value: inr(
            (report.referrerPayouts || []).reduce(
              (s, r) => s + r.estimatedPayout,
              0,
            ),
          ),
          color: "text-sky-600",
          bg: "bg-sky-50",
          icon: TrendingUp,
          sub: "estimated commission",
        },
      ]
    : [];

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-500 mt-1">
              Revenue, test volumes and referrer payouts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-transparent focus:outline-none text-sm"
              />
              <span className="text-gray-300">–</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-transparent focus:outline-none text-sm"
              />
            </div>
            <button
              onClick={applyRange}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Apply
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Crunching numbers…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
            {error}
          </div>
        ) : report ? (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {statsCards.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-10 rounded-lg ${stat.bg} flex items-center justify-center`}
                    >
                      <stat.icon className={`size-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Daily revenue chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-gray-900">
                  Daily Revenue (14 days)
                </h2>
                <div className="flex items-center gap-4 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" /> Billed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Collected
                  </span>
                </div>
              </div>
              <div className="flex items-end gap-1.5 h-40">
                {report.dailySeries.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center gap-1 group"
                    title={`${fmtDay(d.date)} — billed ${inr(d.billed)}, collected ${inr(d.collected)}`}
                  >
                    <div className="w-full flex items-end justify-center gap-0.5 flex-1">
                      <div
                        className="w-1/2 max-w-[14px] rounded-t bg-teal-500/90 group-hover:bg-teal-600 transition-colors"
                        style={{ height: `${Math.max((d.billed / maxBilled) * 100, 2)}%` }}
                      />
                      <div
                        className="w-1/2 max-w-[14px] rounded-t bg-emerald-400/80 group-hover:bg-emerald-500 transition-colors"
                        style={{ height: `${Math.max((d.collected / maxBilled) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-400 whitespace-nowrap">
                      {fmtDay(d.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top test volumes */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-teal-600" />
                  <h2 className="text-base font-semibold text-gray-900">
                    Top Tests by Volume
                  </h2>
                </div>
                {report.testVolumes.length === 0 ? (
                  <p className="px-5 py-10 text-sm text-gray-400 text-center">
                    No tests in this period.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/70 text-left">
                        <th className="px-5 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                          Test
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                          Count
                        </th>
                        <th className="px-5 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                          Rate Sum
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {report.testVolumes.map((t, i) => (
                        <tr key={t.testCode} className="hover:bg-gray-50/50">
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-gray-400 w-6">
                                #{i + 1}
                              </span>
                              <span className="font-medium text-gray-800">
                                {t.testName}
                              </span>
                            </div>
                            <span className="ml-8 text-[10px] font-mono text-teal-600">
                              {t.testCode}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                            {t.count}
                          </td>
                          <td className="px-5 py-2.5 text-right text-gray-600 tabular-nums">
                            {inr(t.rateSum)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Referrer payouts */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <UserRound className="w-4 h-4 text-sky-600" />
                  <h2 className="text-base font-semibold text-gray-900">
                    Referrer Payouts
                  </h2>
                </div>
                {report.referrerPayouts.length === 0 ? (
                  <p className="px-5 py-10 text-sm text-gray-400 text-center">
                    No referrer activity in this period.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/70 text-left">
                        <th className="px-5 py-2.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                          Referrer
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                          Orders
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                          Billed
                        </th>
                        <th className="px-5 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                          Est. Payout
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {report.referrerPayouts.map((r) => (
                        <tr key={r.partyId ?? r.name} className="hover:bg-gray-50/50">
                          <td className="px-5 py-2.5">
                            <span className="font-medium text-gray-800">{r.name}</span>
                            {r.commissionPercent > 0 && (
                              <span className="ml-1.5 text-[10px] font-semibold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
                                {r.commissionPercent}%
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">
                            {r.orderCount}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">
                            {inr(r.billed)}
                          </td>
                          <td className="px-5 py-2.5 text-right font-semibold text-sky-700 tabular-nums">
                            {inr(r.estimatedPayout)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
