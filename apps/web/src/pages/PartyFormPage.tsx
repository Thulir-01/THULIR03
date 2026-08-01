import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Loader2,
  Save,
  Building2,
  Phone,
  Mail,
  MapPin,
  Hash,
  Award,
  Stethoscope,
  BadgePercent,
  DollarSign,
  User,
} from "lucide-react";
import {
  createParty,
  updateParty,
  getParty,
  PARTY_TYPE_LABELS,
  type PartyType,
} from "../lib/api-client";

const PARTY_TYPES: PartyType[] = [
  "doctor",
  "hospital",
  "corporate",
  "insurance_tpa",
  "reference_lab",
  "consultant",
];

export default function PartyFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    partyType: "hospital" as PartyType,
    address: "",
    gstin: "",
    primaryContactName: "",
    primaryContactPhone: "",
    primaryContactEmail: "",
    // Doctor-only extension
    specialty: "",
    qualification: "",
    clinicName: "",
    registration: "",
    commission: "",
    pricingMode: "default",
    discountPercent: "",
  });

  const isDoctor = form.partyType === "doctor";

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await getParty(id);
        setForm({
          name: p.name,
          partyType: p.partyType,
          address: p.address ?? "",
          gstin: p.gstin ?? "",
          primaryContactName: p.primaryContactName ?? "",
          primaryContactPhone: p.primaryContactPhone ?? "",
          primaryContactEmail: p.primaryContactEmail ?? "",
          specialty: p.specialty ?? "",
          qualification: p.qualification ?? "",
          clinicName: p.clinicName ?? "",
          registration: p.registration ?? "",
          commission: p.commission != null ? String(p.commission) : "",
          pricingMode: p.pricingMode ?? "default",
          discountPercent:
            p.discountPercent != null ? String(p.discountPercent) : "",
        });
      } catch {
        setError("Failed to load party details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError("Party name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        name: form.name,
        partyType: form.partyType,
        address: form.address || undefined,
        gstin: form.gstin || undefined,
        primaryContactName: form.primaryContactName || undefined,
        primaryContactPhone: form.primaryContactPhone || undefined,
        primaryContactEmail: form.primaryContactEmail || undefined,
        specialty: isDoctor ? form.specialty || undefined : undefined,
        qualification: isDoctor ? form.qualification || undefined : undefined,
        clinicName: isDoctor ? form.clinicName || undefined : undefined,
        registration: isDoctor ? form.registration || undefined : undefined,
        commission:
          isDoctor && form.commission ? parseFloat(form.commission) : undefined,
        pricingMode: isDoctor ? form.pricingMode : undefined,
        discountPercent:
          isDoctor && form.pricingMode === "discount" && form.discountPercent
            ? parseFloat(form.discountPercent)
            : undefined,
      };
      if (id) {
        await updateParty(id, body);
      } else {
        await createParty(body);
      }
      navigate("/parties");
    } catch {
      setError(`Failed to ${id ? "update" : "create"} party. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-100">
        <Loader2 className="size-6 text-accent-600 animate-spin" />
        <span className="ml-3 text-sm text-ink-400">Loading…</span>
      </div>
    );
  }

  const inputCls =
    "w-full px-3.5 py-2.5 rounded-md border border-line-300 bg-surface-0 text-sm text-ink-950 transition-all duration-fast focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 placeholder:text-ink-300";
  const labelCls = "block text-sm font-medium text-ink-700 mb-1.5";

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      {/* Header */}
      <div className="border-b border-line-200 bg-surface-0">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <button
            onClick={() => navigate("/parties")}
            className="mb-4 inline-flex items-center gap-2 text-sm text-ink-400 transition-colors duration-fast hover:text-ink-600"
          >
            <ArrowLeft className="size-4" /> All parties
          </button>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-accent-100 to-accent-200 text-accent-700">
              <Building2 className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink-950">
                {isEdit ? "Edit Party" : "Add Party"}
              </h1>
              <p className="mt-0.5 text-sm text-ink-400">
                {isEdit
                  ? "Update contact details, GSTIN or doctor information"
                  : "Register a hospital, corporate, insurer, lab or consultant"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
              {error}
            </div>
          )}

          {/* Basic info */}
          <div className="rounded-md border border-line-200 bg-surface-0 p-6">
            <div className="mb-5 flex items-center gap-2">
              <Building2 className="size-4 text-accent-600" />
              <h2 className="font-semibold text-ink-950">Party Information</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>
                  Party Name <span className="text-status-critical">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={inputCls}
                  placeholder="e.g., City General Hospital"
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Party Type</label>
                <select
                  value={form.partyType}
                  disabled={isEdit}
                  onChange={(e) =>
                    handleChange("partyType", e.target.value)
                  }
                  className={`${inputCls} disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-ink-400`}
                >
                  {PARTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PARTY_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                {isEdit && (
                  <p className="mt-1 text-[11px] text-ink-400">
                    Type is fixed after creation.
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>
                  <Hash className="mr-1 inline size-3.5 text-ink-400" />
                  GSTIN
                </label>
                <input
                  type="text"
                  value={form.gstin}
                  onChange={(e) => handleChange("gstin", e.target.value)}
                  className={inputCls}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>
                  <MapPin className="mr-1 inline size-3.5 text-ink-400" />
                  Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  className={inputCls}
                  placeholder="Street, city, state"
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="rounded-md border border-line-200 bg-surface-0 p-6">
            <div className="mb-5 flex items-center gap-2">
              <User className="size-4 text-accent-600" />
              <h2 className="font-semibold text-ink-950">Primary Contact</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Contact Person</label>
                <input
                  type="text"
                  value={form.primaryContactName}
                  onChange={(e) =>
                    handleChange("primaryContactName", e.target.value)
                  }
                  className={inputCls}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className={labelCls}>
                  <Phone className="mr-1 inline size-3.5 text-ink-400" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.primaryContactPhone}
                  onChange={(e) =>
                    handleChange("primaryContactPhone", e.target.value)
                  }
                  className={inputCls}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>
                  <Mail className="mr-1 inline size-3.5 text-ink-400" />
                  Email
                </label>
                <input
                  type="email"
                  value={form.primaryContactEmail}
                  onChange={(e) =>
                    handleChange("primaryContactEmail", e.target.value)
                  }
                  className={inputCls}
                  placeholder="billing@hospital.com"
                />
              </div>
            </div>
          </div>

          {/* Doctor-only */}
          {isDoctor && (
            <div className="rounded-md border border-line-200 bg-surface-0 p-6">
              <div className="mb-5 flex items-center gap-2">
                <Stethoscope className="size-4 text-accent-600" />
                <h2 className="font-semibold text-ink-950">
                  Doctor Information
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    <Award className="mr-1 inline size-3.5 text-ink-400" />
                    Specialty
                  </label>
                  <input
                    type="text"
                    value={form.specialty}
                    onChange={(e) => handleChange("specialty", e.target.value)}
                    className={inputCls}
                    placeholder="e.g., Cardiologist"
                  />
                </div>
                <div>
                  <label className={labelCls}>Qualification</label>
                  <input
                    type="text"
                    value={form.qualification}
                    onChange={(e) =>
                      handleChange("qualification", e.target.value)
                    }
                    className={inputCls}
                    placeholder="e.g., MD, DM"
                  />
                </div>
                <div>
                  <label className={labelCls}>Clinic / Hospital</label>
                  <input
                    type="text"
                    value={form.clinicName}
                    onChange={(e) => handleChange("clinicName", e.target.value)}
                    className={inputCls}
                    placeholder="Clinic name"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <Hash className="mr-1 inline size-3.5 text-ink-400" />
                    Registration No.
                  </label>
                  <input
                    type="text"
                    value={form.registration}
                    onChange={(e) => handleChange("registration", e.target.value)}
                    className={inputCls}
                    placeholder="Medical council reg no."
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <DollarSign className="mr-1 inline size-3.5 text-ink-400" />
                    Commission (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.commission}
                    onChange={(e) => handleChange("commission", e.target.value)}
                    className={inputCls}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={labelCls}>Pricing Mode</label>
                  <select
                    value={form.pricingMode}
                    onChange={(e) => handleChange("pricingMode", e.target.value)}
                    className={inputCls}
                  >
                    <option value="default">Default (walk-in price)</option>
                    <option value="discount">Discount %</option>
                    <option value="custom">Custom price list</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    <BadgePercent className="mr-1 inline size-3.5 text-ink-400" />
                    Discount (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={form.discountPercent}
                    onChange={(e) =>
                      handleChange("discountPercent", e.target.value)
                    }
                    disabled={form.pricingMode !== "discount"}
                    className={`${inputCls} disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-ink-400`}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/parties")}
              className="rounded-md border border-line-300 bg-surface-0 px-6 py-2.5 text-sm font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-6 py-2.5 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-800 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {saving
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : "Add Party"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
