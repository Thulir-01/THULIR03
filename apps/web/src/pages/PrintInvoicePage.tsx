import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, FlaskConical, Loader2, Printer, AlertTriangle } from "lucide-react";
import { getOrderInvoice, type OrderInvoice } from "../lib/api-client";
import InvoiceDocument from "../components/print/InvoiceDocument";

/**
 * Print-optimized invoice route (/print/invoice/:orderId).
 * Renders the tax invoice / receipt on a bare stage — no app shell — so the
 * PDF/paper output is clean A4. Opened by the in-app "Print / Save as PDF"
 * button with ?autoprint=1 to skip straight to the print dialog.
 */
export default function PrintInvoicePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const autoPrint = searchParams.get("autoprint") === "1";
  const [invoice, setInvoice] = useState<OrderInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printedRef = useRef(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getOrderInvoice(orderId);
      setInvoice(data);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Could not load the invoice for this order.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // Fire the print dialog once the document has rendered.
  useEffect(() => {
    if (autoPrint && invoice && !loading && !printedRef.current) {
      printedRef.current = true;
      const t = window.setTimeout(() => window.print(), 400);
      return () => window.clearTimeout(t);
    }
  }, [autoPrint, invoice, loading]);

  // Meaningful PDF filename/tab title.
  useEffect(() => {
    document.title = invoice
      ? `${invoice.orderNumber} — Invoice`
      : "Print — Invoice";
    return () => {
      document.title = "THULIR03 · Lab LIMS";
    };
  }, [invoice]);

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
              Invoice print view
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => orderId && navigate(`/orders/${orderId}/invoice`)}
            className="inline-flex items-center gap-2 rounded-lg border border-line-200 bg-surface-0 px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100 hover:text-ink-950"
          >
            <ArrowLeft className="size-4" /> Back to app
          </button>
          <button
            onClick={() => window.print()}
            disabled={!invoice}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="size-4" /> Print / Save as PDF
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-6 print:max-w-none print:p-0">
        {loading && (
          <div className="flex items-center justify-center py-24 text-ink-400">
            <Loader2 className="size-5 animate-spin mr-2" /> Loading invoice…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Invoice not available</p>
              <p className="text-sm text-amber-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {invoice && !loading && <InvoiceDocument invoice={invoice} />}
      </main>
    </div>
  );
}
