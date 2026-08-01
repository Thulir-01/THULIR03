import { useCallback, useEffect, useState } from "react";
import {
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
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import { LoadingState, ErrorState } from "../components/ui/PageStates";

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
          accent: "accent" as const,
          icon: Receipt,
          sub: `${report.revenue.orderCount} orders`,
        },
        {
          label: "Collected",
          value: inr(report.revenue.totalCollected),
          accent: "green" as const,
          icon: Wallet,
          sub: `${report.revenue.totalDiscount ? `${inr(report.revenue.totalDiscount)} discounts` : "no discounts"}`,
        },
        {
          label: "Outstanding",
          value: inr(report.revenue.totalOutstanding),
          accent: "amber" as const,
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
          accent: "blue" as const,
          icon: TrendingUp,
          sub: "estimated commission",
        },
      ]
    : [];

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <PageHeader
            title="Reports & Analytics"
            subtitle="Revenue, test volumes and referrer payouts"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-1.5 text-sm text-ink-600">
                  <Calendar className="size-4 text-ink-400" />
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="bg-transparent text-sm focus:outline-none"
                  />
                  <span className="text-line-300">–</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="bg-transparent text-sm focus:outline-none"
                  />
                </div>
                <button
                  onClick={applyRange}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                >
                  <RefreshCw className="size-3.5" /> Apply
                </button>
              </div>
            }
          />
        </div>

        {loading ? (
          <LoadingState label="Crunching numbers…" rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load(from, to)} />
        ) : report ? (
          <>
            {/* KPI cards */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statsCards.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  icon={stat.icon}
                  accent={stat.accent}
                  sub={stat.sub}
                />
              ))}
            </div>

            {/* Daily revenue chart */}
            <div className="mb-8 rounded-md border border-line-200 bg-surface-0 p-6 shadow-raised">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink-950">
                  Daily Revenue (14 days)
                </h2>
                <div className="flex items-center gap-4 text-[11px] text-ink-600">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-accent-500" /> Billed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-status-normal" /> Collected
                  </span>
                </div>
              </div>
              <div className="flex h-40 items-end gap-1.5">
                {report.dailySeries.map((d) => (
                  <div
                    key={d.date}
                    className="group flex flex-1 flex-col items-center gap-1"
                    title={`${fmtDay(d.date)} — billed ${inr(d.billed)}, collected ${inr(d.collected)}`}
                  >
                    <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                      <div
                        className="w-1/2 max-w-[14px] rounded-t bg-accent-500/90 transition-colors duration-fast group-hover:bg-accent-700"
                        style={{ height: `${Math.max((d.billed / maxBilled) * 100, 2)}%` }}
                      />
                      <div
                        className="w-1/2 max-w-[14px] rounded-t bg-status-normal/80 transition-colors duration-fast group-hover:bg-status-normal"
                        style={{ height: `${Math.max((d.collected / maxBilled) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="whitespace-nowrap text-[9px] text-ink-400">
                      {fmtDay(d.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Top test volumes */}
              <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-raised">
                <div className="flex items-center gap-2 border-b border-line-200 px-5 py-4">
                  <FlaskConical className="size-4 text-accent-700" />
                  <h2 className="text-base font-semibold text-ink-950">
                    Top Tests by Volume
                  </h2>
                </div>
                {report.testVolumes.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-ink-400">
                    No tests in this period.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-100 text-left">
                        <th className="px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-600">
                          Test
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-ink-600">
                          Count
                        </th>
                        <th className="px-5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-ink-600">
                          Rate Sum
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-200">
                      {report.testVolumes.map((t, i) => (
                        <tr key={t.testCode} className="transition-colors duration-fast hover:bg-surface-100">
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="data-mono w-6 text-[10px] text-ink-400">
                                #{i + 1}
                              </span>
                              <span className="font-medium text-ink-950">
                                {t.testName}
                              </span>
                            </div>
                            <span className="data-mono ml-8 text-[10px] text-accent-700">
                              {t.testCode}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-ink-950">
                            {t.count}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-ink-600">
                            {inr(t.rateSum)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Referrer payouts */}
              <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-raised">
                <div className="flex items-center gap-2 border-b border-line-200 px-5 py-4">
                  <UserRound className="size-4 text-blue-600" />
                  <h2 className="text-base font-semibold text-ink-950">
                    Referrer Payouts
                  </h2>
                </div>
                {report.referrerPayouts.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-ink-400">
                    No referrer activity in this period.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-100 text-left">
                        <th className="px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-600">
                          Referrer
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-ink-600">
                          Orders
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-ink-600">
                          Billed
                        </th>
                        <th className="px-5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-ink-600">
                          Est. Payout
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-200">
                      {report.referrerPayouts.map((r) => (
                        <tr key={r.partyId ?? r.name} className="transition-colors duration-fast hover:bg-surface-100">
                          <td className="px-5 py-2.5">
                            <span className="font-medium text-ink-950">{r.name}</span>
                            {r.commissionPercent > 0 && (
                              <span className="ml-1.5 rounded-sm bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                {r.commissionPercent}%
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-ink-600">
                            {r.orderCount}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-ink-600">
                            {inr(r.billed)}
                          </td>
                          <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-blue-700">
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
