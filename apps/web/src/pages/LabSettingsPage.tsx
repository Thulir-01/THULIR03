import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Save,
  Loader2,
  Check,
  Printer,
} from "lucide-react";
import { getLabSettings, updateLabSettings } from "../lib/api-client";
import PageHeader from "../components/ui/PageHeader";
import { LoadingState } from "../components/ui/PageStates";

export default function LabSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const lab = await getLabSettings();
      setForm({
        name: lab.name,
        address: lab.address ?? "",
        phone: lab.phone ?? "",
        email: lab.email ?? "",
      });
    } catch {
      setError("Failed to load lab settings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError("Lab name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateLabSettings({
        name: form.name,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save lab settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-3.5 py-2.5 rounded-md border border-line-300 bg-surface-0 text-sm text-ink-950 transition-all duration-fast focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 placeholder:text-ink-300";
  const labelCls = "block text-sm font-medium text-ink-700 mb-1.5";

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-surface-100">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <LoadingState label="Loading lab settings…" rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <PageHeader
            title="Lab Settings"
            subtitle="Your lab name and contact details print on clinical reports and invoices"
            actions={
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line-200 bg-surface-0 px-3 py-1 text-xs font-medium text-ink-600">
                <Printer className="size-3.5" /> Used on reports
              </span>
            }
          />
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Lab identity */}
          <div className="rounded-md border border-line-200 bg-surface-0 p-6">
            <div className="mb-5 flex items-center gap-2">
              <Building2 className="size-4 text-accent-600" />
              <h2 className="font-semibold text-ink-950">Laboratory</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>
                  Lab Name <span className="text-status-critical">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={inputCls}
                  placeholder="e.g., THULIR03 Diagnostics"
                  required
                />
                <p className="mt-1 text-[11px] text-ink-400">
                  Shown in the letterhead of every printed report.
                </p>
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
                  placeholder="Street, city, state, PIN"
                />
              </div>
              <div>
                <label className={labelCls}>
                  <Phone className="mr-1 inline size-3.5 text-ink-400" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className={inputCls}
                  placeholder="+91 44 1234 5678"
                />
              </div>
              <div>
                <label className={labelCls}>
                  <Mail className="mr-1 inline size-3.5 text-ink-400" />
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={inputCls}
                  placeholder="lab@thulir03.com"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => load()}
              className="rounded-md border border-line-300 bg-surface-0 px-6 py-2.5 text-sm font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-6 py-2.5 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-800 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saved ? (
                <Check className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {saving ? "Saving..." : saved ? "Saved" : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
