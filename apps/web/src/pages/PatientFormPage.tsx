import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Save,
  Loader2,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Hash,
} from "lucide-react";
import { createPatient } from "../lib/api-client";

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export default function PatientFormPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    patientId: "",
    abhaAddress: "",
    abhaNumber: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName) {
      setError("First name and last name are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createPatient({
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        patientId: form.patientId || undefined,
        abhaAddress: form.abhaAddress || undefined,
        abhaNumber: form.abhaNumber || undefined,
      });
      navigate("/patients");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to create patient. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/patients")}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Register New Patient
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Enter patient details to create a new record
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Personal Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <User className="w-4 h-4 text-teal-600" />
              <h2 className="font-semibold text-gray-900">
                Personal Information
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  placeholder="Enter first name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  placeholder="Enter last name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Gender
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => handleChange("gender", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all bg-white"
                >
                  <option value="">Select gender</option>
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Phone className="w-4 h-4 text-teal-600" />
              <h2 className="font-semibold text-gray-900">
                Contact Details
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Phone className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Mail className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  placeholder="patient@example.com"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                  Address
                </label>
                <textarea
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all resize-none"
                  placeholder="Full address"
                />
              </div>
            </div>
          </div>

          {/* Identifiers */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Hash className="w-4 h-4 text-teal-600" />
              <h2 className="font-semibold text-gray-900">
                Identifiers (Optional)
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Lab Patient ID
                </label>
                <input
                  type="text"
                  value={form.patientId}
                  onChange={(e) => handleChange("patientId", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  placeholder="e.g., LAB-2026-0001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  ABHA Address
                </label>
                <input
                  type="text"
                  value={form.abhaAddress}
                  onChange={(e) => handleChange("abhaAddress", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  placeholder="patient@abdm"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/patients")}
              className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-semibold hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 transition-all shadow-lg shadow-teal-200/50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? "Saving..." : "Create Patient"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
