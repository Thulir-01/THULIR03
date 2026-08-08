import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Loader2,
  Printer,
  AlertTriangle,
  MessageCircle,
  Copy,
  Check,
  X,
} from "lucide-react";
import {
  getOrderReport,
  type ClinicalReport,
} from "../lib/api-client";
import ReportDocument, { ReportQr } from "../components/print/ReportDocument";
import { getReportVerifyUrl } from "../lib/print-utils";

export default function ReportPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<ClinicalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getOrderReport(orderId);
      setReport(data);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Could not load the report for this order.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // Public verification URL — encoded in the printed QR and shared via WhatsApp.
  const verifyUrl = report ? getReportVerifyUrl(report.orderNumber) : "";

  const waMessage = report
    ? `Dear ${report.patient.firstName}${report.patient.lastName ? ` ${report.patient.lastName}` : ""}, your laboratory report (${report.orderNumber}) from ${report.lab?.name ?? "our lab"} is ready. Verify it online: ${verifyUrl}`
    : "";
  const waPhone = report?.patient.phone?.replace(/[^\d]/g, "") ?? "";
  const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`;

  async function copyVerifyLink() {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — the URL is visible next to the button.
    }
  }

  // Print through the dedicated print-optimized route (clean A4, no app shell).
  const openPrintView = () => {
    if (!orderId) return;
    window.open(`/print/report/${orderId}?autoprint=1`, "_blank", "noopener");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 print:max-w-none print:p-0">
      {/* Toolbar — hidden on print */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDeliverOpen(true)}
            disabled={!report}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageCircle className="w-4 h-4" /> Send on WhatsApp
          </button>
          <button
            onClick={openPrintView}
            disabled={!report}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading report…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3 print:hidden">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Report not available</p>
            <p className="text-sm text-amber-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {report && !loading && <ReportDocument report={report} />}

      {/* WhatsApp delivery modal — screen only, never printed */}
      {report && deliverOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 print:hidden"
          onClick={() => setDeliverOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Deliver report via WhatsApp
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {report.orderNumber}
                </p>
              </div>
              <button
                onClick={() => setDeliverOpen(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <span className="text-slate-500">Patient phone</span>
                <span className="font-semibold text-slate-900">
                  {report.patient.phone ?? "— (not on file)"}
                </span>
              </div>

              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                <MessageCircle className="w-4 h-4" /> Open in WhatsApp
              </a>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
                  {verifyUrl}
                </p>
                <button
                  onClick={copyVerifyLink}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-sky-50 px-3 py-2.5">
                <ReportQr value={verifyUrl} size={56} />
                <p className="text-[11px] text-sky-800">
                  The printed report also carries a verification QR. Patients can
                  scan it with any phone camera to confirm the report is genuine.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
