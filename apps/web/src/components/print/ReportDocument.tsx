import { Fragment, useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import {
  ArrowUp,
  ArrowDown,
  Phone,
  Calendar,
  User,
  FlaskConical,
  MapPin,
  Mail,
  QrCode,
  CheckCircle2,
} from "lucide-react";
import type { ClinicalReport, ReportTestRow } from "../../lib/api-client";
import { getFlag, getReportVerifyUrl } from "../../lib/print-utils";

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

function ageLabel(p: ClinicalReport["patient"]): string {
  if (p.ageYears) {
    const parts = [`${p.ageYears} yrs`];
    if (p.ageMonths) parts.push(`${p.ageMonths} mo`);
    return parts.join(" ");
  }
  if (p.dateOfBirth) return fmtDate(p.dateOfBirth);
  return "—";
}

/** Code128 barcode of the order number — scannable on the printed report. */
export function OrderBarcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (ref.current) {
      try {
        JsBarcode(ref.current, value, {
          format: "CODE128",
          displayValue: false,
          width: 1.6,
          height: 36,
          margin: 0,
          background: "#ffffff",
          lineColor: "#0f172a",
        });
      } catch {
        // Invalid barcode content — the order number text below still shows.
      }
    }
  }, [value]);

  return (
    <svg
      ref={ref}
      className="h-9 w-44 print:h-10"
      aria-label={`Barcode ${value}`}
    />
  );
}

/** QR encoding the public verification URL — scannable on the printed report. */
export function ReportQr({ value, size = 88 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      margin: 1,
      width: size * 3,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        // Invalid QR payload — the plain-text URL below still shows.
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        className="shrink-0 rounded-md bg-white"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <img
      src={src}
      alt="Scan to verify report"
      width={size}
      height={size}
      className="shrink-0 rounded-md"
    />
  );
}

/**
 * The full printable clinical report — used by the in-app Report page and by
 * the print-optimized /print/report/:orderId route. Renders clean on A4.
 */
export default function ReportDocument({ report }: { report: ClinicalReport }) {
  const verifyUrl = getReportVerifyUrl(report.orderNumber);
  const lab = report.lab;

  const renderTest = (t: ReportTestRow) => {
    const flag = getFlag(t.result, t.refLow, t.refHigh);
    return (
      <tr key={t.testCode + t.testName} className="border-b border-slate-200 print:break-inside-avoid">
        <td className="py-2 pr-2 align-top">
          <span className="font-semibold text-slate-900">{t.testName}</span>
          <span className="block text-[10px] text-slate-500 uppercase tracking-wide">
            {t.testCode}
          </span>
        </td>
        <td className="py-2 pr-2 align-top font-medium text-slate-900 whitespace-nowrap">
          {t.result ?? "—"}
          {flag && (
            <span
              className={`ml-1 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase ${
                flag === "high" ? "text-rose-600" : "text-amber-600"
              }`}
            >
              {flag === "high" ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )}
              {flag}
            </span>
          )}
        </td>
        <td className="py-2 pr-2 align-top text-slate-600 whitespace-nowrap">
          {t.unit ?? "—"}
        </td>
        <td className="py-2 pr-2 align-top text-slate-600 whitespace-nowrap">
          {t.refRange ?? (t.refLow || t.refHigh ? `${t.refLow ?? ""} – ${t.refHigh ?? ""}` : "—")}
        </td>
        <td className="py-2 align-top text-slate-500 text-sm">
          {t.notes || ""}
        </td>
      </tr>
    );
  };

  return (
    <div
      id="clinical-report"
      className="bg-white rounded-xl border border-slate-200 shadow-sm print:rounded-none print:border-0 print:shadow-none overflow-hidden print:overflow-visible"
    >
      {/* Letterhead */}
      <div className="border-b-2 border-slate-900 px-8 py-6 print:border-slate-800 print:break-inside-avoid">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              THULIR<span className="text-sky-600">03</span>
            </h1>
            <p className="text-xs text-slate-600 mt-0.5 tracking-wide">
              {lab?.name ?? "CLINICAL PATHOLOGY LABORATORY"}
            </p>
            {/* Lab contact — real org address/phone/email, printed */}
            <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
              {lab?.address && (
                <p className="flex items-start gap-1.5">
                  <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{lab.address}</span>
                </p>
              )}
              {lab?.phone && (
                <p className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span>{lab.phone}</span>
                </p>
              )}
              {lab?.email && (
                <p className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span>{lab.email}</span>
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500">Pathology Report</p>
            <p className="font-mono text-sm font-semibold text-slate-900">
              {report.orderNumber}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {fmtDate(report.createdAt)}
            </p>
            {/* Barcode */}
            <div className="mt-2 flex justify-end">
              <OrderBarcode value={report.orderNumber} />
            </div>
          </div>
        </div>
      </div>

      {/* Patient + order meta */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 px-8 py-5 border-b border-slate-200 text-sm print:break-inside-avoid">
        <div className="col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
              <User className="w-3 h-3" /> Patient
            </p>
            <p className="font-semibold text-slate-900 mt-0.5">
              {report.patient.title ? `${report.patient.title} ` : ""}
              {report.patient.firstName} {report.patient.lastName}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Age / Sex
            </p>
            <p className="text-slate-800 mt-0.5">
              {ageLabel(report.patient)} · {report.patient.gender ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
              <Phone className="w-3 h-3" /> Contact
            </p>
            <p className="text-slate-800 mt-0.5">{report.patient.phone ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Sample Collected
            </p>
            <p className="text-slate-800 mt-0.5">
              {fmtDate(report.sampleCollectDt)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Lab Ref No
            </p>
            <p className="text-slate-800 mt-0.5">{report.refNo ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Referred By
            </p>
            <p className="text-slate-800 mt-0.5">{report.referrer ?? "Self"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Priority
            </p>
            <p className="text-slate-800 mt-0.5 capitalize">
              {report.priority}
              {report.emergency ? " · Emergency" : ""}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Report Date
            </p>
            <p className="text-slate-800 mt-0.5">
              {fmtDate(report.finalReportDate)}
            </p>
          </div>
        </div>
        {report.remarks && (
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Clinical Remarks
            </p>
            <p className="text-slate-800 mt-0.5 text-sm">{report.remarks}</p>
          </div>
        )}
      </div>

      {/* Results table */}
      <div className="px-8 py-5 print:px-6">
        <div className="flex items-center gap-2 mb-3 print:break-inside-avoid">
          <FlaskConical className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
            Laboratory Results
          </h2>
        </div>
        <table className="w-full text-sm print:text-[11px]">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left print:break-inside-avoid">
              <th className="py-2 pr-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Test
              </th>
              <th className="py-2 pr-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Result
              </th>
              <th className="py-2 pr-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Unit
              </th>
              <th className="py-2 pr-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Ref Range
              </th>
              <th className="py-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {report.tests.map((t) => (
              <Fragment key={t.testCode + t.testName}>
                {renderTest(t)}
                {t.children?.map((c) => (
                  <tr
                    key={c.testCode + c.testName}
                    className="border-b border-slate-100 bg-slate-50/60 print:break-inside-avoid"
                  >
                    <td className="py-1.5 pr-2 pl-4 align-top text-slate-700">
                      <span className="text-[11px]">▸ {c.testName}</span>
                    </td>
                    <td className="py-1.5 pr-2 align-top text-slate-700 whitespace-nowrap">
                      {c.result ?? "—"}
                      {getFlag(c.result, c.refLow, c.refHigh) && (
                        <span
                          className={`ml-1 text-[10px] font-bold uppercase ${
                            getFlag(c.result, c.refLow, c.refHigh) === "high"
                              ? "text-rose-600"
                              : "text-amber-600"
                          }`}
                        >
                          ({getFlag(c.result, c.refLow, c.refHigh)})
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 align-top text-slate-600 whitespace-nowrap">
                      {c.unit ?? "—"}
                    </td>
                    <td className="py-1.5 pr-2 align-top text-slate-600 whitespace-nowrap">
                      {c.refRange ??
                        (c.refLow || c.refHigh
                          ? `${c.refLow ?? ""} – ${c.refHigh ?? ""}`
                          : "—")}
                    </td>
                    <td className="py-1.5 align-top text-slate-500 text-xs">
                      {c.notes || ""}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-slate-400 mt-3 print:break-inside-avoid">
          * Flagged values outside the reference range are marked H / L.
          Results should be interpreted in the context of clinical history.
        </p>
      </div>

      {/* Signatures */}
      <div className="px-8 py-6 border-t border-slate-200 grid grid-cols-2 gap-6 print:break-inside-avoid">
        <div className="text-center">
          {report.verifiedBy?.signatureImageUrl && (
            <img
              src={report.verifiedBy.signatureImageUrl}
              alt="Technician signature"
              className="mx-auto h-12 object-contain mb-1"
            />
          )}
          <p className="text-[11px] text-slate-500">
            Verified by — {report.verifiedBy?.name ?? "—"}
          </p>
          <p className="text-[10px] text-slate-400">
            {report.verifiedAt ? fmtDate(report.verifiedAt) : ""} · Lab
            Technician
          </p>
        </div>
        <div className="text-center">
          {report.approvedBy?.signatureImageUrl && (
            <img
              src={report.approvedBy.signatureImageUrl}
              alt="Pathologist signature"
              className="mx-auto h-12 object-contain mb-1"
            />
          )}
          <p className="text-[11px] text-slate-500">
            Approved by — {report.approvedBy?.name ?? "—"}
          </p>
          <p className="text-[10px] text-slate-400">
            {report.approvedBy?.designation ?? "Pathologist"}
            {report.approvedBy?.registrationNo
              ? ` · Reg. ${report.approvedBy.registrationNo}`
              : ""}
          </p>
        </div>
      </div>

      {/* Verification QR — printable on the PDF */}
      <div className="px-8 py-5 border-t border-slate-200 flex items-center gap-5 print:break-inside-avoid">
        <ReportQr value={verifyUrl} size={88} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-900">
            <QrCode className="w-4 h-4 text-slate-700" />
            Report Verification
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Scan this code with your phone camera to verify the report online.
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5 break-all">{verifyUrl}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 print:bg-white print:break-inside-avoid">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Electronically generated report · {report.orderNumber}
          </div>
          <p>
            Page 1 of 1 · {fmtDate(report.finalReportDate ?? report.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
