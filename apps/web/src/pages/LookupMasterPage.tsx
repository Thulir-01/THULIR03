import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  Search,
  Wand2,
  Check,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  getLookupMasters,
  createLookupMaster,
  updateLookupMaster,
  deleteLookupMaster,
  setLookupMasterStatus,
  generateLookupMasterCode,
  type LookupMaster,
  type LookupMasterType,
  type CreateLookupData,
} from "../lib/api-client";

// ─── Per-type column config ─────────────────────────────────────────────────
// One generic page renders every lookup type; the only difference between
// tabs is this config object (which metadata fields to show/edit). Adding a
// ninth type later = one config entry + one enum value, no new page.

export interface LookupMetaField {
  key: string;
  label: string;
  kind: "color" | "percent" | "number" | "text";
  placeholder?: string;
  suffix?: string;
}

export interface LookupMasterConfig {
  type: LookupMasterType;
  title: string;
  description: string;
  codeHint?: string;
  metaFields: LookupMetaField[];
}

export const LOOKUP_CONFIGS: Record<LookupMasterType, LookupMasterConfig> = {
  sample_type: {
    type: "sample_type",
    title: "Sample Types",
    description: "Specimen types used on sample labels and requisitions",
    codeHint: "e.g. BLOOD, SERUM, URINE",
    metaFields: [],
  },
  container_type: {
    type: "container_type",
    title: "Container Types",
    description: "Tubes / containers used for each sample (colour-coded)",
    codeHint: "e.g. EDTA, PLAIN, CLOT",
    metaFields: [
      {
        key: "colorHex",
        label: "Colour",
        kind: "color",
        placeholder: "#8B5CF6",
      },
    ],
  },
  unit: {
    type: "unit",
    title: "Units",
    description: "Measurement units used across the test catalogue",
    codeHint: "e.g. mg/dL, g/dL, IU/L",
    metaFields: [],
  },
  method: {
    type: "method",
    title: "Methods",
    description: "Analytical methods used by the lab's instruments",
    codeHint: "e.g. PHOTOMETRY, CLIA, ESR-WESTERGREN",
    metaFields: [],
  },
  payment_mode: {
    type: "payment_mode",
    title: "Payment Modes",
    description: "How patients / corporates pay at billing",
    codeHint: "e.g. CASH, UPI, CARD, CREDIT",
    metaFields: [],
  },
  rejection_reason: {
    type: "rejection_reason",
    title: "Rejection Reasons",
    description: "Why a sample was rejected (used on sample status)",
    codeHint: "e.g. HAEMOLYSED, CLOTTED, QNS",
    metaFields: [],
  },
  discount_scheme: {
    type: "discount_scheme",
    title: "Discount Schemes",
    description: "Named patient-level discount schemes for billing",
    codeHint: "e.g. SENIOR, STAFF",
    metaFields: [
      {
        key: "percent",
        label: "Discount %",
        kind: "percent",
        suffix: "%",
      },
    ],
  },
  tax_rate: {
    type: "tax_rate",
    title: "Tax Rates",
    description: "GST / service tax rates applied at invoicing",
    codeHint: "e.g. GST5, GST12, GST18",
    metaFields: [
      {
        key: "percent",
        label: "Rate %",
        kind: "percent",
        suffix: "%",
      },
    ],
  },
};

// ─── Page ───────────────────────────────────────────────────────────────────

type Row = LookupMaster & { _saving?: boolean };

export default function LookupMasterPage({
  config,
}: {
  config: LookupMasterConfig;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Add / edit form state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LookupMaster | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [metaValues, setMetaValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getLookupMasters(config.type, {
        search: search || undefined,
      });
      setRows(data);
    } catch {
      setError("Failed to load values. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [config.type, search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setCode("");
    setName("");
    setSortOrder("0");
    setMetaValues({});
    setFormOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setCode(row.code);
    setName(row.name);
    setSortOrder(String(row.sortOrder ?? 0));
    const meta: Record<string, string> = {};
    for (const f of config.metaFields) {
      const v = (row.metadata as Record<string, unknown> | null)?.[f.key];
      meta[f.key] = v != null ? String(v) : "";
    }
    setMetaValues(meta);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setError("");
  };

  const applyCode = async () => {
    try {
      const suggested = await generateLookupMasterCode(config.type);
      setCode(suggested);
    } catch {
      setError("Could not generate a code right now.");
    }
  };

  const submit = async () => {
    if (!code.trim() || !name.trim()) {
      setError("Code and name are required.");
      return;
    }
    setSaving(true);
    setError("");
    const metadata: Record<string, unknown> = {};
    for (const f of config.metaFields) {
      const raw = metaValues[f.key]?.trim() ?? "";
      if (!raw) continue;
      if (f.kind === "percent" || f.kind === "number") {
        const n = parseFloat(raw);
        if (!Number.isNaN(n)) metadata[f.key] = n;
      } else {
        metadata[f.key] = raw;
      }
    }
    const body: CreateLookupData = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      sortOrder: parseInt(sortOrder || "0", 10) || 0,
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    };
    try {
      if (editing) {
        const updated = await updateLookupMaster(config.type, editing.id, body);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await createLookupMaster(config.type, body);
        setRows((prev) => [...prev, created]);
      }
      closeForm();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Failed to save. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: Row) => {
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, _saving: true } : r)),
    );
    try {
      const updated = await setLookupMasterStatus(
        config.type,
        row.id,
        !row.isActive,
      );
      setRows((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
    } catch {
      setError("Failed to update status.");
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, _saving: false } : r,
        ),
      );
    }
  };

  const remove = async (row: Row) => {
    if (!confirm(`Deactivate "${row.name}"? It can be re-enabled later.`))
      return;
    try {
      const updated = await deleteLookupMaster(config.type, row.id);
      setRows((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
    } catch {
      setError("Failed to deactivate value.");
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    setRows((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const [a, b] = [next[index], next[target]];
      next[index] = { ...b, sortOrder: a.sortOrder };
      next[target] = { ...a, sortOrder: b.sortOrder };
      // Persist the swapped order in the background
      void updateLookupMaster(config.type, a.id, {
        sortOrder: b.sortOrder,
      }).catch(() => {});
      void updateLookupMaster(config.type, b.id, {
        sortOrder: a.sortOrder,
      }).catch(() => {});
      return next;
    });
  };

  const metaValue = (row: Row, key: string): string => {
    const v = (row.metadata as Record<string, unknown> | null)?.[key];
    return v != null ? String(v) : "";
  };

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [rows],
  );

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-ink-950">{config.title}</h2>
            <p className="text-sm text-ink-400 mt-0.5">{config.description}</p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-700 text-surface-0 text-sm font-semibold hover:bg-accent-800 transition-colors duration-fast"
          >
            <Plus className="size-4" />
            Add {config.title.replace(/s$/, "")}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-300" />
          <input
            type="text"
            placeholder="Search by code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-line-200 bg-surface-0 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 transition-all"
          />
        </div>

        {/* Table */}
        <div className="rounded-md border border-line-200 bg-surface-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 text-accent-600 animate-spin" />
              <span className="ml-3 text-sm text-ink-400">Loading…</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-ink-400">
                {search
                  ? "No values match your search."
                  : "No values yet — add your first one."}
              </p>
              {!search && (
                <button
                  onClick={openAdd}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-700 text-surface-0 text-sm font-medium hover:bg-accent-800 transition-colors"
                >
                  <Plus className="size-4" />
                  Add {config.title.replace(/s$/, "")}
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-100/60 border-b border-line-200 text-left text-[11px] uppercase tracking-wider text-ink-400">
                  <th className="px-4 py-2.5 font-medium w-10">#</th>
                  <th className="px-3 py-2.5 font-medium">Code</th>
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  {config.metaFields.map((f) => (
                    <th key={f.key} className="px-3 py-2.5 font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-200">
                {sorted.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-surface-100/40 transition-colors duration-fast ${
                      !row.isActive ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-ink-300">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          className="text-ink-300 hover:text-accent-600 disabled:opacity-30 transition-colors"
                          title="Move up"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          onClick={() => move(i, 1)}
                          disabled={i === sorted.length - 1}
                          className="text-ink-300 hover:text-accent-600 disabled:opacity-30 transition-colors"
                          title="Move down"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-ink-500">
                      {row.code}
                    </td>
                    <td className="px-3 py-2.5 text-ink-950 font-medium">
                      {row.name}
                    </td>
                    {config.metaFields.map((f) => (
                      <td key={f.key} className="px-3 py-2.5">
                        {f.kind === "color" && metaValue(row, f.key) ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="size-3.5 rounded-full border border-line-200"
                              style={{
                                backgroundColor: metaValue(row, f.key),
                              }}
                            />
                            <span className="text-xs text-ink-500 font-mono">
                              {metaValue(row, f.key)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-ink-500">
                            {metaValue(row, f.key)}
                            {metaValue(row, f.key) && f.suffix}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => toggleStatus(row)}
                        disabled={row._saving}
                        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-fast disabled:opacity-50 ${
                          row.isActive
                            ? "bg-status-normal/10 text-status-normal hover:bg-status-normal/20"
                            : "bg-gray-100 text-ink-500 hover:bg-gray-200"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            row.isActive
                              ? "bg-status-normal"
                              : "bg-ink-300"
                          }`}
                        />
                        {row.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(row)}
                          className="text-xs font-medium text-accent-600 hover:text-accent-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(row)}
                          className="text-xs text-ink-400 hover:text-status-critical font-medium transition-colors"
                        >
                          Disable
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-surface-0 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-ink-950">
                {editing ? `Edit ${name || config.title.replace(/s$/, "")}` : `Add ${config.title.replace(/s$/, "")}`}
              </h3>
              <button
                onClick={closeForm}
                className="text-ink-400 hover:text-ink-600 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">
                  Code *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder={config.codeHint}
                    className="flex-1 px-3 py-2 rounded-md border border-line-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
                  />
                  <button
                    type="button"
                    onClick={applyCode}
                    title="Auto-generate code"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-line-200 text-xs font-medium text-ink-600 hover:border-accent-300 hover:text-accent-700 transition-colors"
                  >
                    <Wand2 className="size-3.5" />
                    Auto
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Display name"
                  className="w-full px-3 py-2 rounded-md border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
                />
              </div>

              {config.metaFields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-ink-600 mb-1">
                    {f.label}
                  </label>
                  {f.kind === "color" ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={
                          /^#[0-9a-fA-F]{6}$/.test(metaValues[f.key] ?? "")
                            ? metaValues[f.key]!
                            : "#8B5CF6"
                        }
                        onChange={(e) =>
                          setMetaValues((m) => ({
                            ...m,
                            [f.key]: e.target.value,
                          }))
                        }
                        className="size-9 rounded-md border border-line-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={metaValues[f.key] ?? ""}
                        onChange={(e) =>
                          setMetaValues((m) => ({
                            ...m,
                            [f.key]: e.target.value,
                          }))
                        }
                        placeholder={f.placeholder}
                        className="flex-1 px-3 py-2 rounded-md border border-line-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type={f.kind === "percent" ? "number" : "text"}
                        value={metaValues[f.key] ?? ""}
                        onChange={(e) =>
                          setMetaValues((m) => ({
                            ...m,
                            [f.key]: e.target.value,
                          }))
                        }
                        placeholder={f.placeholder}
                        className={`w-full px-3 py-2 rounded-md border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 ${
                          f.suffix ? "pr-8" : ""
                        }`}
                      />
                      {f.suffix && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">
                          {f.suffix}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">
                  Sort order
                </label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-28 px-3 py-2 rounded-md border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
                />
              </div>

              {error && (
                <div className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-xs text-status-critical">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={closeForm}
                  className="px-4 py-2 rounded-md text-sm font-medium text-ink-500 hover:bg-surface-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-700 text-surface-0 text-sm font-semibold hover:bg-accent-800 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {editing ? "Save Changes" : "Add Value"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
