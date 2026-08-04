import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Hash,
  FlaskConical,
  Plus,
  FileText,
} from "lucide-react";
import { getPatient, type Patient } from "../lib/api-client";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";

interface PatientOrder {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  totalAmount: string | null;
  balanceAmount: string | null;
  createdAt: string;
  _count?: { tests: number };
}

interface PatientWithOrders extends Patient {
  orders?: PatientOrder[];
}

const ORDER_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  verified: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

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

function ageFromDob(iso: string | null): string {
  if (!iso) return "—";
  const dob = new Date(iso);
  if (isNaN(dob.getTime())) return "—";
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--;
  if (years < 1) {
    const months = Math.max(0, (now.getFullYear() - dob.getFullYear()) * 12 + m);
    return `${months} mo`;
  }
  return `${years} yrs`;
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientWithOrders | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    getPatient(id)
      .then((p) => setPatient(p as PatientWithOrders))
      .catch(() => {
        setPatient(null);
        setError("Failed to load patient details. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const orders = patient?.orders ?? [];

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate("/patients")}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-xs font-semibold text-ink-600 transition-colors duration-fast hover:border-accent-500 hover:text-accent-700"
          >
            <ArrowLeft className="size-3.5" />
            Back to Patients
          </button>
          <Link
            to="/registration"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
          >
            <Plus className="size-3.5" />
            New Order
          </Link>
        </div>

        {loading ? (
          <LoadingState label="Loading patient details…" rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => id && getPatient(id).then((p) => setPatient(p as PatientWithOrders)).catch(() => setError("Failed to load patient details. Please try again."))} />
        ) : patient ? (
          <>
            {/* Patient identity card */}
            <div className="mb-6 overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-raised">
              <div className="border-b border-line-200 bg-accent-700/5 px-6 py-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-full bg-accent-700 text-lg font-semibold text-surface-0">
                    {patient.firstName[0]}
                    {patient.lastName?.[0] ?? ""}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-semibold text-ink-950">
                      {patient.firstName} {patient.lastName}
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
                      {patient.patientId && (
                        <span className="data-mono inline-flex items-center gap-1">
                          <Hash className="size-3" /> ID: {patient.patientId}
                        </span>
                      )}
                      {patient.gender && (
                        <span className="capitalize">
                          {patient.gender === "male" ? "♂" : patient.gender === "female" ? "♀" : ""} {patient.gender}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" /> Age: {ageFromDob(patient.dateOfBirth)}
                      </span>
                      <span>Registered {fmtDate(patient.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-accent-700">{orders.length}</div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
                      Orders
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact details */}
              <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 size-4 text-ink-400" />
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">Phone</div>
                    <div className="mt-0.5 text-sm text-ink-900">{patient.phone || "—"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 size-4 text-ink-400" />
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">Email</div>
                    <div className="mt-0.5 text-sm text-ink-900">{patient.email || "—"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 text-ink-400" />
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">Address</div>
                    <div className="mt-0.5 text-sm text-ink-900">{patient.address || "—"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Hash className="mt-0.5 size-4 text-ink-400" />
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">ABHA</div>
                    <div className="mt-0.5 text-sm text-ink-900">
                      {patient.abhaAddress || patient.abhaNumber || "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent orders */}
            <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-raised">
              <div className="flex items-center justify-between border-b border-line-200 px-6 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                  <FlaskConical className="size-4 text-accent-700" />
                  Recent Orders
                </h2>
                {orders.length > 0 && (
                  <Link
                    to="/orders"
                    className="text-xs font-semibold text-accent-700 transition-colors duration-fast hover:text-accent-500"
                  >
                    View all orders →
                  </Link>
                )}
              </div>

              {orders.length === 0 ? (
                <EmptyState
                  icon={FlaskConical}
                  title="No orders yet"
                  hint="Register a new order for this patient to get started"
                  action={
                    <Link
                      to="/registration"
                      className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                    >
                      <Plus className="size-3.5" />
                      Register Order
                    </Link>
                  }
                />
              ) : (
                <div className="divide-y divide-line-200">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors duration-fast hover:bg-surface-100"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex size-10 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                          <FileText className="size-4" />
                        </div>
                        <div>
                          <div className="data-mono text-sm font-medium text-ink-950">
                            {order.orderNumber}
                          </div>
                          <div className="mt-0.5 text-xs text-ink-400">
                            {fmtDate(order.createdAt)}
                            {order._count?.tests ? ` · ${order._count.tests} tests` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {order.totalAmount != null && (
                          <span className="data-mono text-sm font-semibold text-ink-900">
                            ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                          </span>
                        )}
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${
                            ORDER_STATUS_STYLES[order.status] ?? "bg-surface-100 text-ink-600 border-line-200"
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
