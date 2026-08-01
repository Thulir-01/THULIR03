import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Loader2,
  Printer,
  AlertTriangle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Phone,
  Calendar,
  User,
  FlaskConical,
} from "lucide-react";
import {
  getOrderReport,
  type ClinicalReport,
  type ReportTestRow,
} from "../lib/api-client";

function getFlag(
  result: string | null,
  refLow: number | null,
  refHigh: number | null,
): "high" | "low" | null {
  if (!result || (refLow === null && refHigh === null)) return null;
  const val = parseFloat(result);
  if (isNaN(val)) return null;
  if (refHigh !== null && val > refHigh) return "high";
  if (refLow !== null && val < refLow) return "low";
  return null;
}

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

export default function ReportPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<ClinicalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const renderTest = (t: ReportTestRow) => {
    const flag = getFlag(t.result, t.refLow, t.refHigh);
    return (
      <tr key={t.testCode + t.testName} className="border-b border-slate-200">
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
          onClick={() => window.print()}
          disabled={!report}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
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

      {report && !loading && (
        <div
          id="clinical-report"
          className="bg-white rounded-xl border border-slate-200 shadow-sm print:rounded-none print:border-0 print:shadow-none overflow-hidden"
        >
          {/* Letterhead */}
          <div className="border-b-2 border-slate-900 px-8 py-6 print:border-slate-800">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  THULIR<span className="text-sky-600">03</span>
                </h1>
                <p className="text-xs text-slate-600 mt-0.5 tracking-wide">
                  CLINICAL PATHOLOGY LABORATORY
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                  Diagnostic &amp; Reference Laboratory Services · NABL-aligned
                  quality management
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Pathology Report</p>
                <p className="font-mono text-sm font-semibold text-slate-900">
                  {report.orderNumber}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {fmtDate(report.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Patient + order meta */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 px-8 py-5 border-b border-slate-200 text-sm">
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
          <div className="px-8 py-5">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="w-4 h-4 text-sky-600" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                Laboratory Results
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-900 text-left">
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
                  <>
                    {renderTest(t)}
                    {t.children?.map((c) => (
                      <tr
                        key={c.testCode + c.testName}
                        className="border-b border-slate-100 bg-slate-50/60"
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
                  </>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 mt-3">
              * Flagged values outside the reference range are marked H / L.
              Results should be interpreted in the context of clinical history.
            </p>
          </div>

          {/* Signatures */}
          <div className="px-8 py-6 border-t border-slate-200 grid grid-cols-2 gap-6">
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

          {/* Footer */}
          <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 print:bg-white">
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
      )}
    </div>
  );
}
