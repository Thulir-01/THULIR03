import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Stethoscope,
  Phone,
  Mail,
  Building2,
  Loader2,
  Award,
} from "lucide-react";
import {
  getReferrers,
  deleteReferrer,
  type Referrer,
} from "../lib/api-client";

export default function ReferrersPage() {
  const navigate = useNavigate();
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      getReferrers(search || undefined)
        .then(setReferrers)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Referring Doctors
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage referrers and track referral patterns
              </p>
            </div>
            <button
              onClick={() => navigate("/referrers/new")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-semibold hover:from-teal-700 hover:to-cyan-700 transition-all shadow-lg shadow-teal-200/50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Referrer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, specialty, or clinic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
            <span className="ml-3 text-sm text-gray-500">
              Loading referrers...
            </span>
          </div>
        )}

        {/* Empty */}
        {!loading && referrers.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-50 flex items-center justify-center">
              <Stethoscope className="w-8 h-8 text-teal-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {search ? "No referrers found" : "No referrers yet"}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {search
                ? "Try a different search term"
                : "Add referring doctors to track referral sources"}
            </p>
            {!search && (
              <button
                onClick={() => navigate("/referrers/new")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Referrer</span>
              </button>
            )}
          </div>
        )}

        {/* Referrer Cards */}
        {!loading && referrers.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {referrers.map((referrer) => (
              <div
                key={referrer.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:border-teal-100 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center text-sm font-semibold text-teal-700">
                      {referrer.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {referrer.name}
                      </h3>
                      {referrer.specialty && (
                        <span className="text-xs text-teal-600 flex items-center gap-1 mt-0.5">
                          <Award className="w-3 h-3" />
                          {referrer.specialty}
                        </span>
                      )}
                    </div>
                  </div>
                  {!referrer.isActive && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-sm text-gray-500 mb-4">
                  {referrer.clinicName && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      <span>{referrer.clinicName}</span>
                    </div>
                  )}
                  {referrer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <span>{referrer.phone}</span>
                    </div>
                  )}
                  {referrer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{referrer.email}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  {referrer._count && (
                    <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-medium">
                      {referrer._count.orders} referrals
                    </span>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() => navigate(`/referrers/${referrer.id}/edit`)}
                      className="text-xs text-gray-400 hover:text-teal-600 font-medium transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(referrer.id, referrer.name)}
                      className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors"
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
