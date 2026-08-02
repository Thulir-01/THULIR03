import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ClipboardList,
  FileText,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  ScanLine,
} from "lucide-react";
import { useAuth } from "../lib/useAuth";
import PortalShell from "../components/PortalShell";
import {
  getPatientPortalOrders,
  getReferrerPortalOrders,
  type PortalOrder,
} from "../lib/api-client";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-surface-100 text-ink-600",
  completed: "bg-green-50 text-green-700",
  approved: "bg-green-50 text-green-700",
  processing: "bg-blue-50 text-blue-700",
  verified: "bg-teal-50 text-teal-700",
  rejected: "bg-status-critical/10 text-status-critical",
};

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: "Pending",
    processing: "Processing",
    completed: "Completed",
    verified: "Verified",
    approved: "Approved",
    rejected: "Rejected",
  };
  return map[s] ?? s;
}

export default function PortalOrdersPage({ kind }: { kind: "patient" | "referrer" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const roleOk = kind === "patient" ? user?.role === "patient" : user?.role === "referrer";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data =
        kind === "patient" ? await getPatientPortalOrders() : await getReferrerPortalOrders();
      setOrders(data);
    } catch {
      setOrders([]);
      setError("Failed to load your records. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    if (roleOk) void load();
  }, [roleOk, load]);

  if (!roleOk) {
    return (
      <PortalShell title={kind === "patient" ? "Patient Portal" : "Referrer Portal"} subtitle="…">
        <div className="rounded-md border border-line-200 bg-surface-0 p-8 text-center">
          <p className="text-sm text-ink-600">This portal is only for {kind} accounts.</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-3 text-xs font-medium text-accent-700 hover:text-accent-500"
          >
            Go to dashboard →
          </button>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell
      title={kind === "patient" ? "Patient Portal" : "Referrer Portal"}
      subtitle={
        kind === "patient"
          ? "Your test orders and laboratory reports"
          : "Orders referred to THULIR03 and their report status"
      }
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-400">
          {orders.length} {orders.length === 1 ? "record" : "records"}
        </p>
        <LinkVerify />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-400">
          <Loader2 className="size-5 animate-spin" /> Loading your records…
        </div>
      ) : error ? (
        <div className="rounded-md border border-status-critical/30 bg-status-critical/5 px-4 py-3 text-sm text-status-critical">
          {error}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-md border border-line-200 bg-surface-0 p-12 text-center">
          <ClipboardList className="mx-auto mb-3 size-8 text-ink-300" />
          <h3 className="text-sm font-semibold text-ink-950">No records yet</h3>
          <p className="mt-1 text-sm text-ink-500">
            {kind === "patient"
              ? "When tests are booked for you, they will appear here with their report status."
              : "Orders referred from your practice will appear here once registered."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-md border border-line-200 bg-surface-0 p-5 shadow-raised transition-all duration-fast hover:border-accent-500"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="data-mono text-sm font-semibold text-ink-950">{o.orderNumber}</span>
                    <span className="text-xs text-ink-400">
                      {new Date(o.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {kind === "referrer" && o.patientName && (
                    <div className="mt-1 text-sm text-ink-600">Patient: {o.patientName}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] font-semibold ${
                      STATUS_STYLES[o.status] ?? "bg-surface-100 text-ink-600"
                    }`}
                  >
                    {o.status === "approved" && <ShieldCheck className="size-3" />}
                    {statusLabel(o.status)}
                  </span>
                  {o.emergency && (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-status-critical/10 px-2 py-1 text-[11px] font-semibold text-status-critical">
                      <AlertTriangle className="size-3" /> Emergency
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line-200 pt-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {o.tests.map((t) => (
                    <span
                      key={t.testName}
                      className="rounded-sm bg-surface-100 px-2 py-1 text-xs text-ink-600"
                    >
                      {t.testName}
                    </span>
                  ))}
                  <span className="text-xs text-ink-400">· {o.testCount} test{o.testCount !== 1 ? "s" : ""}</span>
                </div>
                {o.reportReady ? (
                  <button
                    onClick={() => navigate(`/portal/${kind}/report/${o.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                  >
                    <FileText className="size-3.5" /> View report
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-400">
                    <Clock className="size-3.5" /> Report pending approval
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}

function LinkVerify() {
  return (
    <a
      href="/verify-report"
      className="inline-flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100"
    >
      <ScanLine className="size-3.5" /> Verify a report
    </a>
  );
}
