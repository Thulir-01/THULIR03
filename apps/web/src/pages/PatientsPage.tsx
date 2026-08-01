import { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  Search,
  Plus,
  Users,
  Phone,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { getPatients, type Patient } from "../lib/api-client";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = (q?: string) => {
    setLoading(true);
    setError("");
    getPatients(q || undefined)
      .then(setPatients)
      .catch(() => {
        setPatients([]);
        setError("Failed to load patients. Please try again.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <PageHeader
            title="Patients"
            subtitle="Manage patient records and registrations"
            actions={
              <Link
                to="/patients/new"
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
              >
                <Plus className="size-3.5" />
                Add Patient
              </Link>
            }
          />
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search by name, phone, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-line-300 bg-surface-0 py-2.5 pl-10 pr-4 text-sm transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
          />
        </div>

        {loading ? (
          <LoadingState label="Loading patients…" rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load(search)} />
        ) : (
          <>
            {/* Stats */}
            {patients.length > 0 && (
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Total Patients" value={String(patients.length)} icon={Users} accent="accent" />
                <StatCard
                  label="With Orders"
                  value={String(patients.filter((p) => (p._count?.orders ?? 0) > 0).length)}
                  icon={Calendar}
                  accent="blue"
                />
              </div>
            )}

            {/* Empty */}
            {patients.length === 0 && (
              <EmptyState
                icon={Users}
                title={search ? "No patients found" : "No patients yet"}
                hint={search ? "Try a different search term" : "Register your first patient to get started"}
                action={
                  !search ? (
                    <Link
                      to="/patients/new"
                      className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                    >
                      <Plus className="size-3.5" />
                      Add Patient
                    </Link>
                  ) : undefined
                }
              />
            )}

            {/* Patient List */}
            {patients.length > 0 && (
              <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-raised">
                <div className="divide-y divide-line-200">
                  {patients.map((patient) => (
                    <Link
                      key={patient.id}
                      to={`/patients/${patient.id}`}
                      className="group flex items-center justify-between px-5 py-4 transition-colors duration-fast hover:bg-surface-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex size-10 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-700">
                          {patient.firstName[0]}
                          {patient.lastName[0]}
                        </div>
                        <div>
                          <div className="font-medium text-ink-950">
                            {patient.firstName} {patient.lastName}
                          </div>
                          <div className="mt-0.5 flex items-center gap-3">
                            {patient.phone && (
                              <span className="flex items-center gap-1 text-xs text-ink-400">
                                <Phone className="size-3" />
                                {patient.phone}
                              </span>
                            )}
                            {patient.gender && (
                              <span className="flex items-center gap-1 text-xs text-ink-400">
                                {patient.gender === "male" ? "♂" : "♀"}{" "}
                                {patient.gender}
                              </span>
                            )}
                            {patient.patientId && (
                              <span className="data-mono text-xs text-ink-400">
                                ID: {patient.patientId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {patient._count && patient._count.orders > 0 && (
                          <span className="rounded-full bg-accent-100 px-2.5 py-1 text-xs font-medium text-accent-700">
                            {patient._count.orders} orders
                          </span>
                        )}
                        <ChevronRight className="size-4 text-line-300 transition-colors duration-fast group-hover:text-accent-500" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
