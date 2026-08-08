import { Fragment } from "react";
import { CheckCircle2, Phone, Calendar, User, Receipt, FlaskConical } from "lucide-react";
import type { OrderInvoice } from "../../lib/api-client";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function inr(value: string | number | null | undefined): string {
  const n = parseFloat(String(value ?? "0"));
  if (isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ageLabel(p: OrderInvoice["patient"]): string {
  if (p.ageYears) {
    const parts = [`${p.ageYears} yrs`];
    if (p.ageMonths) parts.push(`${p.ageMonths} mo`);
    return parts.join(" ");
  }
  if (p.dateOfBirth) return fmtDate(p.dateOfBirth);
  return "—";
}

/**
 * The full printable tax invoice / payment receipt — used by the in-app
 * Invoice page and by the print-optimized /print/invoice/:orderId route.
 * Renders clean on A4.
 */
export default function InvoiceDocument({ invoice }: { invoice: OrderInvoice }) {
  const b = invoice.billing;
  const hasDiscount =
    b && parseFloat(String(b.discountAmount ?? "0")) > 0;
  const isPaid = b && parseFloat(String(b.balanceAmount ?? "0")) <= 0;

  return (
    <div
      id="invoice"
      className="bg-white rounded-xl border border-slate-200 shadow-sm print:rounded-none print:border-0 print:shadow-none overflow-hidden"
    >
      {/* Letterhead */}
      <div className="border-b-2 border-slate-900 px-8 py-6 flex items-start justify-between print:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            THULIR<span className="text-sky-600">03</span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5 tracking-wide">
            CLINICAL PATHOLOGY LABORATORY
          </p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
            Diagnostic &amp; Reference Laboratory Services · GSTIN:
            applicable
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            {isPaid ? "Payment Receipt" : "Tax Invoice"}
          </p>
          <p className="font-mono text-sm font-semibold text-slate-900">
            {invoice.orderNumber}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {fmtDateTime(invoice.createdAt)}
          </p>
          <span
            className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
              isPaid
                ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                : "text-amber-700 border-amber-200 bg-amber-50"
            }`}
          >
            {isPaid ? "PAID" : `BALANCE ${inr(b.balanceAmount)}`}
          </span>
        </div>
      </div>

      {/* Patient + order meta */}
      <div className="px-8 py-5 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
            <User className="w-3 h-3" /> Patient
          </p>
          <p className="font-semibold text-slate-900 mt-0.5">
            {invoice.patient.title ? `${invoice.patient.title} ` : ""}
            {invoice.patient.firstName} {invoice.patient.lastName}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Age / Sex
          </p>
          <p className="text-slate-800 mt-0.5">
            {ageLabel(invoice.patient)} · {invoice.patient.gender ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
            <Phone className="w-3 h-3" /> Contact
          </p>
          <p className="text-slate-800 mt-0.5">{invoice.patient.phone ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Referred By
          </p>
          <p className="text-slate-800 mt-0.5">{invoice.referrer ?? "Self"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Lab Ref No
          </p>
          <p className="text-slate-800 mt-0.5">{invoice.refNo ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Priority
          </p>
          <p className="text-slate-800 mt-0.5 capitalize">
            {invoice.priority}
            {invoice.emergency ? " · Emergency" : ""}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Delivery
          </p>
          <p className="text-slate-800 mt-0.5 capitalize">
            {invoice.deliveryMode ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Billed On
          </p>
          <p className="text-slate-800 mt-0.5">
            {fmtDate(invoice.createdAt)}
          </p>
        </div>
      </div>

      {/* Tests */}
      <div className="px-8 py-5">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
            Investigations
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left">
              <th className="py-2 pr-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Test
              </th>
              <th className="py-2 pr-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Code
              </th>
              <th className="py-2 text-right text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.tests.map((t) => (
              <Fragment key={t.testCode}>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-2 font-semibold text-slate-900">
                    {t.testName}
                    {t.isProfile && t.children?.length ? (
                      <span className="block text-[10px] text-slate-500 font-normal">
                        {t.children.length} parameters
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 font-mono text-xs text-slate-500">
                    {t.testCode}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums text-slate-900">
                    {inr(t.rate)}
                  </td>
                </tr>
                {t.children?.map((c) => (
                  <tr key={c.testCode} className="border-b border-slate-50 bg-slate-50/50">
                    <td className="py-1.5 pr-2 pl-4 text-slate-700 text-[13px]">
                      <span className="text-[11px]">▸ {c.testName}</span>
                    </td>
                    <td className="py-1.5 pr-2 font-mono text-[11px] text-slate-400">
                      {c.testCode}
                    </td>
                    <td className="py-1.5 text-right text-[13px] text-slate-600 tabular-nums">
                      {inr(c.rate)}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Billing summary + payment */}
      <div className="px-8 py-6 border-t border-slate-200 grid grid-cols-2 gap-8">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-1">
            <Receipt className="w-3 h-3" /> Payment Details
          </p>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Mode</dt>
              <dd className="font-medium text-slate-900 capitalize">
                {b.paymentMode ?? "—"}
                {b.bankName ? ` · ${b.bankName}` : ""}
              </dd>
            </div>
            {b.paymentRef && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Ref</dt>
                <dd className="font-mono text-slate-900">{b.paymentRef}</dd>
              </div>
            )}
            {b.paymentDate && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Date</dt>
                <dd className="text-slate-900">{fmtDate(b.paymentDate)}</dd>
              </div>
            )}
            {b.paymentRemarks && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Remarks</dt>
                <dd className="text-slate-900">{b.paymentRemarks}</dd>
              </div>
            )}
            {invoice.consolidatedBill && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Consolidated</dt>
                <dd className="text-slate-900">Yes</dd>
              </div>
            )}
          </dl>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
            Amount Summary
          </p>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Bill Amount</dt>
              <dd className="font-medium tabular-nums text-slate-900">
                {inr(b.billAmount)}
              </dd>
            </div>
            {parseFloat(String(b.otherCharges ?? "0")) > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Other Charges</dt>
                <dd className="tabular-nums text-slate-900">
                  {inr(b.otherCharges)}
                </dd>
              </div>
            )}
            {hasDiscount && (
              <div className="flex justify-between">
                <dt className="text-slate-500">
                  Discount
                  {parseFloat(String(b.discountPercent ?? "0")) > 0
                    ? ` (${b.discountPercent}%)`
                    : ""}
                </dt>
                <dd className="tabular-nums text-emerald-600">
                  −{inr(b.discountAmount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between font-bold border-t-2 border-slate-900 pt-2">
              <dt>Total</dt>
              <dd className="tabular-nums">{inr(b.totalAmount)}</dd>
            </div>
            <div className="flex justify-between text-emerald-700">
              <dt>Paid</dt>
              <dd className="tabular-nums font-medium">{inr(b.amountPaid)}</dd>
            </div>
            {parseFloat(String(b.balanceAmount ?? "0")) > 0 && (
              <div className="flex justify-between text-amber-700">
                <dt>Balance Due</dt>
                <dd className="tabular-nums font-semibold">
                  {inr(b.balanceAmount)}
                </dd>
              </div>
            )}
            {isPaid && (
              <div className="flex items-center gap-1.5 text-emerald-600 font-medium pt-1">
                <CheckCircle2 className="w-4 h-4" /> Fully paid
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 print:bg-white flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" />
          {isPaid ? "Payment receipt" : "Invoice"} · {invoice.orderNumber} ·
          Order status: {invoice.status}
        </div>
        <p>Thank you for choosing THULIR03</p>
      </div>
    </div>
  );
}
