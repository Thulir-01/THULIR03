import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import {
  FlaskConical,
  ShieldCheck,
  ShieldX,
  Loader2,
  Search,
  CalendarDays,
  FileCheck2,
} from "lucide-react";
import { verifyReportPublic, type ReportVerification } from "../lib/api-client";

export default function VerifyReportPage() {
  const [params] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get("ref") ?? "");
  const [result, setResult] = useState<ReportVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function run(orderNo: string) {
    if (!orderNo.trim()) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      setResult(await verifyReportPublic(orderNo));
    } catch {
      setResult(null);
      setError("Could not verify. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ref = params.get("ref");
    if (ref) void run(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void run(orderNumber);
  }

  return (
    <div className="min-h-screen bg-surface-100">
      <header className="border-b border-line-200 bg-surface-0">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-accent-700 text-surface-0">
              <FlaskConical className="size-4.5" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight text-ink-950">THULIR03</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-ink-400">
                Report Verification
              </div>
            </div>
          </div>
          <Link
            to="/login"
            className="text-xs font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500"
          >
            Staff / Portal login →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-xl font-semibold text-ink-950">Verify a laboratory report</h1>
          <p className="mt-1 text-sm text-ink-500">
            Enter the order / reference number printed on the report to confirm it is genuine.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. ORD-3D5ECDAB"
              className="w-full rounded-md border border-line-300 bg-surface-0 py-2.5 pl-10 pr-4 text-sm uppercase focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-4 py-2.5 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Verify
          </button>
        </form>

        {error && (
          <div className="rounded-md border border-status-critical/30 bg-status-critical/5 px-4 py-3 text-sm text-status-critical">
            {error}
          </div>
        )}

        {searched && !loading && result && (
          <div
            className={`overflow-hidden rounded-md border bg-surface-0 shadow-raised ${
              result.valid ? "border-green-300" : "border-status-critical/40"
            }`}
          >
            <div
              className={`flex items-center gap-3 px-5 py-4 ${
                result.valid ? "bg-green-50" : "bg-status-critical/10"
              }`}
            >
              {result.valid ? (
                <ShieldCheck className="size-7 shrink-0 text-green-700" />
              ) : (
                <ShieldX className="size-7 shrink-0 text-status-critical" />
              )}
              <div>
                <div className={`text-base font-semibold ${result.valid ? "text-green-800" : "text-status-critical"}`}>
                  {result.valid ? "Report is authentic" : "Verification failed"}
                </div>
                <div className="text-xs text-ink-500">
                  {result.valid
                    ? `This report matches our records for ${result.orderNumber}.`
                    : result.message ?? "No matching report found for this number."}
                </div>
              </div>
            </div>

            {result.valid && (
              <div className="divide-y divide-line-200">
                <div className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-ink-500">Order number</span>
                  <span className="data-mono font-semibold text-ink-950">{result.orderNumber}</span>
                </div>
                <div className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-ink-500">Laboratory</span>
                  <span className="font-medium text-ink-950">{result.labName}</span>
                </div>
                <div className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="flex items-center gap-1.5 text-ink-500">
                    <CalendarDays className="size-3.5" /> Report date
                  </span>
                  <span className="font-medium text-ink-950">
                    {result.reportDate
                      ? new Date(result.reportDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-ink-400">
          <FileCheck2 className="size-3.5" />
          Verification confirms the report is genuine — it does not display
          patient details or results. Those are available through the patient
          portal.
        </p>
      </main>
    </div>
  );
}
