import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Check,
  FlaskConical,
  Loader2,
  MessageCircle,
  Printer,
  AlertTriangle,
} from "lucide-react";
import { getOrderReport, type ClinicalReport } from "../lib/api-client";
import ReportDocument from "../components/print/ReportDocument";
import { generateDocumentPdf, sharePdfViaWhatsApp } from "../lib/report-pdf";
import { buildWaShareLink, getReportVerifyUrl } from "../lib/print-utils";

type WaState = "idle" | "generating" | "shared" | "error";

/**
 * Print-optimized report route (/print/report/:orderId).
 * Renders the clinical report on a bare stage — no app shell, no sidebar —
 * so the PDF/paper output is clean A4. Opened by the in-app "Print / Save as
 * PDF" button with ?autoprint=1 to skip straight to the print dialog.
 * Also the source of the PDF attached when staff send the report via WhatsApp.
 */
export default function PrintReportPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const autoPrint = searchParams.get("autoprint") === "1";
  const [report, setReport] = useState<ClinicalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waState, setWaState] = useState<WaState>("idle");
  const printedRef = useRef(false);
  const docRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getOrderReport(orderId);
      setReport(data);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Could not load the report for this order.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // Fire the print dialog once, after the barcode/QR have rendered.
  useEffect(() => {
    if (autoPrint && report && !loading && !printedRef.current) {
      printedRef.current = true;
      const t = window.setTimeout(() => window.print(), 400);
      return () => window.clearTimeout(t);
    }
  }, [autoPrint, report, loading]);

  // Meaningful PDF filename/tab title.
  useEffect(() => {
    document.title = report
      ? `${report.orderNumber} — Pathology Report`
      : "Print — Pathology Report";
    return () => {
      document.title = "THULIR03 · Lab LIMS";
    };
  }, [report]);

  // "Shared" confirmation resets after a moment.
  useEffect(() => {
    if (waState !== "shared") return;
    const t = window.setTimeout(() => setWaState("idle"), 2200);
    return () => window.clearTimeout(t);
  }, [waState]);

  async function handleSendPdf() {
    const node = docRef.current;
    if (!node || !report) return;
    setWaState("generating");
    try {
      const blob = await generateDocumentPdf(node);
      const fileName = `${report.orderNumber}_Report.pdf`;
      const shareText = `Dear ${report.patient.firstName}${report.patient.lastName ? ` ${report.patient.lastName}` : ""}, your laboratory report (${report.orderNumber}) is ready — PDF attached.`;
      const result = await sharePdfViaWhatsApp(blob, fileName, shareText);
      if (result === "unsupported") {
        // Browser can't attach files — fall back to the wa.me text link.
        const verifyUrl = getReportVerifyUrl(report.orderNumber);
        const message = `Dear ${report.patient.firstName}${report.patient.lastName ? ` ${report.patient.lastName}` : ""}, your laboratory report (${report.orderNumber}) from ${report.lab?.name ?? "our lab"} is ready. Verify it online: ${verifyUrl}`;
        window.open(buildWaShareLink(report.patient.phone, message), "_blank", "noopener");
      }
      setWaState(result === "shared" ? "shared" : "idle");
    } catch {
      setWaState("error");
    }
  }

  return (
    <div className="min-h-screen bg-surface-100 print:bg-white">
      {/* Toolbar — screen only, never printed */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line-200 bg-surface-0 px-4 py-2.5 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-accent-700 text-surface-0">
            <FlaskConical className="size-4" />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight text-ink-950">
              THULIR03
            </p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-ink-400">
              Report print view
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {waState === "error" && (
            <span className="hidden text-[11px] text-rose-600 sm:block">
              Could not prepare the PDF — try the print button instead.
            </span>
          )}
          <button
            onClick={() => orderId && navigate(`/orders/${orderId}/report`)}
            className="inline-flex items-center gap-2 rounded-lg border border-line-200 bg-surface-0 px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100 hover:text-ink-950"
          >
            <ArrowLeft className="size-4" /> Back to app
          </button>
          <button
            onClick={handleSendPdf}
            disabled={!report || waState === "generating"}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-fast hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {waState === "generating" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Preparing PDF…
              </>
            ) : waState === "shared" ? (
              <>
                <Check className="size-4" /> PDF ready — pick WhatsApp
              </>
            ) : (
              <>
                <MessageCircle className="size-4" /> Send on WhatsApp
              </>
            )}
          </button>
          <button
            onClick={() => window.print()}
            disabled={!report}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="size-4" /> Print / Save as PDF
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-6 print:max-w-none print:p-0">
        {loading && (
          <div className="flex items-center justify-center py-24 text-ink-400">
            <Loader2 className="size-5 animate-spin mr-2" /> Loading report…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Report not available</p>
              <p className="text-sm text-amber-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {report && !loading && (
          <div ref={docRef} className="print:contents">
            <ReportDocument report={report} />
          </div>
        )}
      </main>
    </div>
  );
}
