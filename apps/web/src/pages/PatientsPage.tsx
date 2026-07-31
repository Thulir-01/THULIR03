import { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  Search,
  Plus,
  Users,
  Phone,
  Calendar,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { getPatients, type Patient } from "../lib/api-client";

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      getPatients(search || undefined)
        .then(setPatients)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage patient records and registrations
              </p>
            </div>
            <Link
              to="/patients/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-semibold hover:from-teal-700 hover:to-cyan-700 transition-all shadow-lg shadow-teal-200/50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Patient</span>
            </Link>
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
            placeholder="Search by name, phone, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
          />
        </div>

        {/* Stats */}
        {!loading && patients.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Patients", value: patients.length, icon: Users },
              {
                label: "With Orders",
                value: patients.filter((p) => (p._count?.orders ?? 0) > 0).length,
                icon: Calendar,
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="bg-white rounded-xl border border-gray-100 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-teal-600" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {stat.value}
                      </div>
                      <div className="text-xs text-gray-500">{stat.label}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
            <span className="ml-3 text-sm text-gray-500">Loading patients...</span>
          </div>
        )}

        {/* Empty */}
        {!loading && patients.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-50 flex items-center justify-center">
              <Users className="w-8 h-8 text-teal-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {search ? "No patients found" : "No patients yet"}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {search
                ? "Try a different search term"
                : "Register your first patient to get started"}
            </p>
            {!search && (
              <Link
                to="/patients/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Patient</span>
              </Link>
            )}
          </div>
        )}

        {/* Patient List */}
        {!loading && patients.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {patients.map((patient) => (
                <Link
                  key={patient.id}
                  to={`/patients/${patient.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-teal-50/30 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center text-sm font-semibold text-teal-700">
                      {patient.firstName[0]}
                      {patient.lastName[0]}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {patient.firstName} {patient.lastName}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {patient.phone && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Phone className="w-3 h-3" />
                            {patient.phone}
                          </span>
                        )}
                        {patient.gender && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            {patient.gender === "male" ? "♂" : "♀"}{" "}
                            {patient.gender}
                          </span>
                        )}
                        {patient.patientId && (
                          <span className="text-xs text-gray-400">
                            ID: {patient.patientId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {patient._count && patient._count.orders > 0 && (
                      <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-medium">
                        {patient._count.orders} orders
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-teal-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
