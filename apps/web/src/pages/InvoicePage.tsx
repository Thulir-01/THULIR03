import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Loader2, Printer, AlertTriangle } from "lucide-react";
import { getOrderInvoice, type OrderInvoice } from "../lib/api-client";
import InvoiceDocument from "../components/print/InvoiceDocument";

export default function InvoicePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<OrderInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getOrderInvoice(orderId);
      setInvoice(data);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Could not load the invoice for this order.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // Print through the dedicated print-optimized route (clean A4, no app shell).
  const openPrintView = () => {
    if (!orderId) return;
    window.open(`/print/invoice/${orderId}?autoprint=1`, "_blank", "noopener");
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
        <button
          onClick={openPrintView}
          disabled={!invoice}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading invoice…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3 print:hidden">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Invoice not available</p>
            <p className="text-sm text-amber-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {invoice && !loading && <InvoiceDocument invoice={invoice} />}
    </div>
  );
}
