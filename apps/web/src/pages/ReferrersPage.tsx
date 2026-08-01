import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  Plus,
  Stethoscope,
  Phone,
  Mail,
  Building2,
  Award,
} from "lucide-react";
import {
  getReferrers,
  deleteReferrer,
  type Referrer,
} from "../lib/api-client";
import PageHeader from "../components/ui/PageHeader";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";

export default function ReferrersPage() {
  const navigate = useNavigate();
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = (q?: string) => {
    setLoading(true);
    setError("");
    getReferrers(q || undefined)
      .then(setReferrers)
      .catch(() => {
        setReferrers([]);
        setError("Failed to load referrers. Please try again.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete referrer "${name}"? This action cannot be undone.`))
      return;
    try {
      await deleteReferrer(id);
      setReferrers((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Failed to delete referrer. Please try again.");
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <PageHeader
            title="Referring Doctors"
            subtitle="Manage referrers and track referral patterns"
            actions={
              <button
                onClick={() => navigate("/referrers/new")}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
              >
                <Plus className="size-3.5" />
                Add Referrer
              </button>
            }
          />
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search by name, specialty, or clinic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-line-300 bg-surface-0 py-2.5 pl-10 pr-4 text-sm transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
          />
        </div>

        {loading ? (
          <LoadingState label="Loading referrers…" rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load(search)} />
        ) : referrers.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title={search ? "No referrers found" : "No referrers yet"}
            hint={search ? "Try a different search term" : "Add referring doctors to track referral sources"}
            action={
              !search ? (
                <button
                  onClick={() => navigate("/referrers/new")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                >
                  <Plus className="size-3.5" />
                  Add Referrer
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {referrers.map((referrer) => (
              <div
                key={referrer.id}
                className="group rounded-md border border-line-200 bg-surface-0 p-5 shadow-raised transition-all duration-fast hover:border-accent-500 hover:shadow-raised"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-700">
                      {referrer.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-ink-950">
                        {referrer.name}
                      </h3>
                      {referrer.specialty && (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-accent-700">
                          <Award className="size-3" />
                          {referrer.specialty}
                        </span>
                      )}
                    </div>
                  </div>
                  {!referrer.isActive && (
                    <span className="rounded-full bg-surface-100 px-2 py-0.5 text-xs text-ink-600">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="mb-4 space-y-1.5 text-sm text-ink-600">
                  {referrer.clinicName && (
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3.5 text-ink-400" />
                      <span>{referrer.clinicName}</span>
                    </div>
                  )}
                  {referrer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 text-ink-400" />
                      <span>{referrer.phone}</span>
                    </div>
                  )}
                  {referrer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="size-3.5 text-ink-400" />
                      <span className="truncate">{referrer.email}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-line-200 pt-3">
                  {referrer._count && (
                    <span className="rounded-full bg-accent-100 px-2.5 py-1 text-xs font-medium text-accent-700">
                      {referrer._count.orders} referrals
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/referrers/${referrer.id}/pricing`)}
                      className="text-xs font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500"
                    >
                      Pricing
                    </button>
                    <button
                      onClick={() => handleDelete(referrer.id, referrer.name)}
                      className="text-xs font-medium text-ink-400 transition-colors duration-fast hover:text-status-critical"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
