import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Printer, Loader2, FlaskConical, MapPin, Phone, Mail, ShieldCheck } from "lucide-react";
import PortalShell from "../components/PortalShell";
import {
  getPatientPortalReport,
  getReferrerPortalReport,
  type PortalReport,
  type PortalReportTest,
} from "../lib/api-client";

const fmtDate = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

function ageLabel(r: PortalReport) {
  const { ageYears, ageMonths, dateOfBirth } = r.patient;
  if (ageYears != null) return `${ageYears}y${ageMonths ? ` ${ageMonths}m` : ""}`;
  if (dateOfBirth) {
    const diff = Date.now() - new Date(dateOfBirth).getTime();
    const yrs = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
    return `${yrs}y`;
  }
  return "—";
}

function flagClass(r: PortalReportTest | PortalReportTest["children"][number]) {
  if (r.result == null || r.result === "") return null;
  const val = Number.parseFloat(r.result);
  if (Number.isNaN(val)) return null;
  if (r.refLow != null && val < r.refLow) return "text-status-critical font-semibold";
  if (r.refHigh != null && val > r.refHigh) return "text-status-critical font-semibold";
  return null;
}

export default function PortalReportPage() {
  const { orderId, kind } = useParams();
  const portalKind: "patient" | "referrer" =
    kind === "referrer" ? "referrer" : "patient";
  const navigate = useNavigate();
  const [report, setReport] = useState<PortalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    try {
      const data =
        portalKind === "patient"
          ? await getPatientPortalReport(orderId)
          : await getReferrerPortalReport(orderId);
      setReport(data);
    } catch (err: any) {
      setReport(null);
      setError(err.response?.data?.message || "Report is not available yet.");
    } finally {
      setLoading(false);
    }
  }, [portalKind, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PortalShell
      title={portalKind === "patient" ? "Patient Portal" : "Referrer Portal"}
      subtitle="Laboratory report"
    >
      <div className="mb-4 flex items-center justify-between print:hidden">
        <button
          onClick={() =>
            navigate(portalKind === "patient" ? "/portal/patient" : "/portal/referrer")
          }
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 transition-colors duration-fast hover:text-accent-700"
        >
          <ArrowLeft className="size-3.5" /> Back to records
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
        >
          <Printer className="size-3.5" /> Print / Save as PDF
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-400">
          <Loader2 className="size-5 animate-spin" /> Loading report…
        </div>
      ) : error ? (
        <div className="rounded-md border border-line-200 bg-surface-0 p-10 text-center">
          <p className="text-sm text-ink-600">{error}</p>
        </div>
      ) : report ? (
        <div className="rounded-md border border-line-200 bg-white p-8 shadow-raised print:rounded-none print:border-0 print:shadow-none print:p-0">
          {/* Letterhead */}
          <div className="mb-6 flex items-start justify-between gap-4 border-b-2 border-accent-700 pb-4 print:break-inside-avoid">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-700 text-surface-0 print:bg-ink-950">
                <FlaskConical className="size-5" />
              </div>
              <div>
                <div className="text-base font-bold tracking-wide text-ink-950">
                  {report.lab?.name ?? "THULIR03"}
                </div>
                <div className="text-[11px] text-ink-500">CLINICAL PATHOLOGY LABORATORY</div>
                <div className="mt-1 space-y-0.5 text-[11px] text-ink-500 print:text-[11px]">
                  {report.lab?.address && (
                    <div className="flex items-center gap-1">
                      <MapPin className="size-3 shrink-0" /> {report.lab.address}
                    </div>
                  )}
                  {report.lab?.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="size-3 shrink-0" /> {report.lab.phone}
                    </div>
                  )}
                  {report.lab?.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="size-3 shrink-0" /> {report.lab.email}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="data-mono text-xs font-semibold text-ink-950">{report.orderNumber}</div>
              <div className="text-[11px] text-ink-400">Report date: {fmtDate(report.finalReportDate ?? report.approvedAt)}</div>
            </div>
          </div>

          {/* Patient + order meta */}
          <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm print:break-inside-avoid sm:grid-cols-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400">Patient</div>
              <div className="font-semibold text-ink-950">
                {report.patient.firstName} {report.patient.lastName}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400">Age / Sex</div>
              <div className="text-ink-950">
                {ageLabel(report)} · {report.patient.gender ?? "—"}
              </div>
            </div>
            {report.patient.phone && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-400">Contact</div>
                <div className="text-ink-950">{report.patient.phone}</div>
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400">Sample collected</div>
              <div className="text-ink-950">{fmtDate(report.sampleCollectDt)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400">Lab ref no</div>
              <div className="data-mono text-ink-950">{report.refNo ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400">Referred by</div>
              <div className="text-ink-950">{report.referrer ?? "Self"}</div>
            </div>
          </div>

          {/* Results */}
          <table className="w-full border-collapse text-sm print:text-[11px]">
            <thead>
              <tr className="border-y-2 border-accent-700 bg-surface-100 print:bg-ink-950 print:text-surface-0">
                <th className="px-3 py-2 text-left font-semibold">Test</th>
                <th className="px-3 py-2 text-left font-semibold">Result</th>
                <th className="px-3 py-2 text-left font-semibold">Unit</th>
                <th className="px-3 py-2 text-left font-semibold">Ref range</th>
              </tr>
            </thead>
            <tbody>
              {report.tests.map((t) => (
                <TestRow key={t.testCode} test={t} />
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-between border-t border-line-200 pt-4 print:break-inside-avoid">
            <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
              <ShieldCheck className="size-3.5" /> Electronically generated report
            </div>
            <div className="text-[11px] text-ink-400">
              Verified {report.verifiedAt ? `· ${fmtDate(report.verifiedAt)}` : ""}
              {report.approvedAt ? ` · Approved ${fmtDate(report.approvedAt)}` : ""}
            </div>
          </div>
        </div>
      ) : null}
    </PortalShell>
  );
}

function TestRow({ test }: { test: PortalReportTest }) {
  const flag = flagClass(test);
  return (
    <>
      <tr className="border-b border-line-200">
        <td className="px-3 py-2.5 font-medium text-ink-950">{test.testName}</td>
        <td className={`px-3 py-2.5 ${flag ?? "text-ink-950"}`}>
          {test.result ?? "—"}
          {flag && test.result && <span className="ml-1">↑↓</span>}
        </td>
        <td className="px-3 py-2.5 text-ink-600">{test.unit ?? "—"}</td>
        <td className="px-3 py-2.5 text-ink-600">{test.refRange ?? "—"}</td>
      </tr>
      {test.children.map((c) => {
        const cflag = flagClass(c);
        return (
          <tr key={c.testCode} className="border-b border-line-200 bg-surface-100/50">
            <td className="px-3 py-2 pl-8 text-ink-600">▸ {c.testName}</td>
            <td className={`px-3 py-2 ${cflag ?? "text-ink-600"}`}>
              {c.result ?? "—"}
              {cflag && c.result && <span className="ml-1">↑↓</span>}
            </td>
            <td className="px-3 py-2 text-ink-600">{c.unit ?? "—"}</td>
            <td className="px-3 py-2 text-ink-600">{c.refRange ?? "—"}</td>
          </tr>
        );
      })}
    </>
  );
}
