import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Save, Loader2,  Stethoscope, Building2, Phone, Mail, Hash, DollarSign, Award, } from "lucide-react";
import { createReferrer } from "../lib/api-client";

export default function ReferrerFormPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    specialty: "",
    phone: "",
    email: "",
    clinicName: "",
    registration: "",
    commission: "",
    pricingMode: "default",
    discountPercent: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError("Doctor name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createReferrer({
        name: form.name,
        specialty: form.specialty || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        clinicName: form.clinicName || undefined,
        registration: form.registration || undefined,
        commission: form.commission ? parseFloat(form.commission) : undefined,
        pricingMode: form.pricingMode,
        discountPercent:
          form.pricingMode === "discount" && form.discountPercent
            ? parseFloat(form.discountPercent)
            : undefined,
      });
      navigate("/referrers");
    } catch {
      setError("Failed to create referrer. Please try again.");
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
              onClick={() => navigate("/referrers")}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add Referring Doctor</h1>
              <p className="text-sm text-gray-500 mt-1">
                Register a new referring doctor or clinic
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

          {/* Basic Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Stethoscope className="w-4 h-4 text-teal-600" />
              <h2 className="font-semibold text-gray-900">Doctor Information</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Doctor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  placeholder="Dr. Full Name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Award className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                  Specialty
                </label>
                <input
                  type="text"
                  value={form.specialty}
                  onChange={(e) => handleChange("specialty", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  placeholder="e.g., Cardiologist"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Hash className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                  Registration Number
                </label>
                <input
                  type="text"
                  value={form.registration}
                  onChange={(e) => handleChange("registration", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  placeholder="Medical council reg no."
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Phone className="w-4 h-4 text-teal-600" />
              <h2 className="font-semibold text-gray-900">Contact Details</h2>
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
                  placeholder="doctor@clinic.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Building2 className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                  Clinic / Hospital Name
                </label>
                <input
                  type="text"
                  value={form.clinicName}
                  onChange={(e) => handleChange("clinicName", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  placeholder="Clinic name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <DollarSign className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                  Commission (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.commission}
                  onChange={(e) => handleChange("commission", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Pricing Mode
                </label>
                <select
                  value={form.pricingMode}
                  onChange={(e) => handleChange("pricingMode", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                >
                  <option value="default">Default (walk-in price)</option>
                  <option value="discount">Discount %</option>
                  <option value="custom">Custom price list</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Discount (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={form.discountPercent}
                  onChange={(e) => handleChange("discountPercent", e.target.value)}
                  disabled={form.pricingMode !== "discount"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/referrers")}
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
              <span>{saving ? "Saving..." : "Add Referrer"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
