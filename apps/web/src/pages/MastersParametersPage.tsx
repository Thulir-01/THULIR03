import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Loader2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Tag,
  Layers,
  X,
  Save,
} from "lucide-react";
import {
  getMastersCategories,
  getMastersParameters,
  createMastersCategory,
  createMastersParameter,
  updateMastersParameter,
  type TestCategory,
  type TestParameter,
} from "../lib/api-client";

interface ParamForm {
  code: string;
  name: string;
  categoryName: string;
  sampleType: string;
  unit: string;
  methodology: string;
  turnaroundHours: string;
  defaultPrice: string;
  sortOrder: string;
}

const EMPTY_FORM: ParamForm = {
  code: "",
  name: "",
  categoryName: "",
  sampleType: "Blood",
  unit: "",
  methodology: "",
  turnaroundHours: "",
  defaultPrice: "",
  sortOrder: "0",
};

/**
 * ParametersPanel — the Test Parameters masters screen.
 *
 * Category is a TYPEABLE input (with suggestions): typing a name that isn't
 * a category yet auto-creates it on save, so a parameter can be registered
 * in one pass without a separate "add category" flow.
 */
export default function ParametersPanel() {
  const [categories, setCategories] = useState<TestCategory[]>([]);
  const [parameters, setParameters] = useState<TestParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<ParamForm>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([getMastersCategories(), getMastersParameters()])
      .then(([cats, params]) => {
        setCategories(cats);
        setParameters(params);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const catName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = parameters.filter((p) => {
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.sampleType ?? "").toLowerCase().includes(q)
      );
    });
    const byCat = new Map<string, TestParameter[]>();
    for (const p of visible) {
      const list = byCat.get(p.categoryId) ?? [];
      list.push(p);
      byCat.set(p.categoryId, list);
    }
    return [...byCat.entries()].sort((a, b) =>
      catName(a[0]).localeCompare(catName(b[0]))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameters, search, categories]);

  const set = (field: keyof ParamForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const startCreate = () => {
    setForm({ ...EMPTY_FORM, categoryName: categories[0]?.name ?? "" });
    setCreating(true);
    setEditId(null);
    setError("");
  };

  const startEdit = (p: TestParameter) => {
    setEditId(p.id);
    setExpanded((s) => {
      const n = new Set(s);
      n.add(p.id);
      return n;
    });
    setForm({
      code: p.code,
      name: p.name,
      categoryName: catName(p.categoryId),
      sampleType: p.sampleType ?? "Blood",
      unit: p.unit ?? "",
      methodology: p.methodology ?? "",
      turnaroundHours: p.turnaroundHours != null ? String(p.turnaroundHours) : "",
      defaultPrice: String(p.defaultPrice),
      sortOrder: String(p.sortOrder),
    });
    setError("");
  };

  /** Resolve the typed category name to an id — creating it if new. */
  const resolveCategory = async (name: string): Promise<string> => {
    const trimmed = name.trim();
    const existing = categories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return existing.id;
    const cat = await createMastersCategory({ name: trimmed });
    await load(); // refresh so the new category appears immediately
    return cat.id;
  };

  const handleSave = async (id: string | null) => {
    if (!form.code.trim() || !form.name.trim() || !form.categoryName.trim()) {
      setError("Code, name and category are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const categoryId = await resolveCategory(form.categoryName);
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        categoryId,
        sampleType: form.sampleType || undefined,
        unit: form.unit || undefined,
        methodology: form.methodology || undefined,
        turnaroundHours: form.turnaroundHours
          ? parseInt(form.turnaroundHours, 10)
          : undefined,
        defaultPrice: parseFloat(form.defaultPrice || "0"),
        sortOrder: parseInt(form.sortOrder || "0", 10),
      };
      if (id) {
        await updateMastersParameter(id, body);
      } else {
        await createMastersParameter(body);
      }
      setCreating(false);
      setEditId(null);
      await load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        "Failed to save parameter. Check for duplicate code.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Toolbar: search + add */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search by code, name or sample type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-line-200 bg-surface-0 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
            />
          </div>
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-700 text-surface-0 text-sm font-semibold hover:bg-accent-800 transition-colors duration-fast shadow-overlay"
          >
            <Plus className="size-4" />
            Add Parameter
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
            {error}
          </div>
        )}

        {/* Create form */}
        {creating && (
          <div className="rounded-md border border-accent-200 bg-surface-0 p-5 shadow-overlay">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ink-950 flex items-center gap-2">
                <Tag className="size-4 text-accent-600" /> New Test Parameter
              </h2>
              <button
                onClick={() => setCreating(false)}
                className="text-ink-400 hover:text-ink-600"
              >
                <X className="size-4" />
              </button>
            </div>
            <ParamFormFields
              form={form}
              set={set}
              categories={categories}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setCreating(false)}
                className="px-4 py-2 rounded-md border border-line-200 text-sm font-medium text-ink-600 hover:bg-surface-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(null)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-700 text-surface-0 text-sm font-semibold hover:bg-accent-800 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save Parameter
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 text-accent-600 animate-spin" />
            <span className="ml-3 text-sm text-ink-400">
              Loading catalogue…
            </span>
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-md bg-accent-100 flex items-center justify-center">
              <FlaskConical className="size-8 text-accent-500" />
            </div>
            <h3 className="text-lg font-semibold text-ink-950 mb-2">
              {search ? "No parameters match" : "No parameters yet"}
            </h3>
            <p className="text-sm text-ink-400 mb-6">
              {search
                ? "Try a different search term"
                : "Add your first test parameter — type a category name right in the form and it will be created for you"}
            </p>
            {!search && (
              <button
                onClick={startCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-700 text-surface-0 text-sm font-medium hover:bg-accent-800"
              >
                <Plus className="size-4" /> Add Parameter
              </button>
            )}
          </div>
        ) : (
          grouped.map(([catId, params]) => (
            <div key={catId} className="rounded-md border border-line-200 bg-surface-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-surface-100/60 border-b border-line-200">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 flex items-center gap-2">
                  <Layers className="size-3.5 text-accent-600" />
                  {catName(catId)}
                </h3>
                <span className="text-[11px] text-ink-400">
                  {params.length} parameter{params.length !== 1 ? "s" : ""}
                </span>
              </div>

              {params.map((p) => (
                <div key={p.id} className="border-b border-line-200 last:border-b-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-100/60 transition-colors duration-fast">
                    <button
                      onClick={() => toggleExpand(p.id)}
                      className="text-ink-400 hover:text-ink-600"
                    >
                      {expanded.has(p.id) ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>
                    <span className="font-mono text-xs text-ink-400 w-16 shrink-0">
                      {p.code}
                    </span>
                    <span className="text-sm font-medium text-ink-950 flex-1 truncate">
                      {p.name}
                    </span>
                    <span className="text-sm text-ink-500 font-mono">
                      ₹{p.defaultPrice}
                    </span>
                    {p.sampleType && (
                      <span className="hidden sm:inline text-[11px] text-ink-400 px-2 py-0.5 rounded-sm bg-surface-100 border border-line-200">
                        {p.sampleType}
                      </span>
                    )}
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        p.isActive
                          ? "bg-status-success/10 text-status-success"
                          : "bg-ink-400/10 text-ink-400"
                      }`}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() => startEdit(p)}
                      className="text-xs font-medium text-accent-600 hover:text-accent-800"
                    >
                      Edit
                    </button>
                  </div>

                  {expanded.has(p.id) && (
                    <div className="px-4 pb-4 pl-12 border-t border-line-200 pt-4">
                      {editId === p.id ? (
                        <>
                          <ParamFormFields
                            form={form}
                            set={set}
                            categories={categories}
                          />
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              onClick={() => setEditId(null)}
                              className="px-4 py-2 rounded-md border border-line-200 text-sm font-medium text-ink-600 hover:bg-surface-100"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSave(p.id)}
                              disabled={saving}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-700 text-surface-0 text-sm font-semibold hover:bg-accent-800 disabled:opacity-50"
                            >
                              {saving ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Save className="size-4" />
                              )}
                              Save Changes
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="grid sm:grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-0.5">
                              Unit
                            </div>
                            <div className="text-ink-950">
                              {p.unit || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-0.5">
                              Methodology
                            </div>
                            <div className="text-ink-950">
                              {p.methodology || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-0.5">
                              Turnaround
                            </div>
                            <div className="text-ink-950">
                              {p.turnaroundHours != null
                                ? `${p.turnaroundHours} h`
                                : "—"}
                            </div>
                          </div>
                          <button
                            onClick={() => startEdit(p)}
                            className="justify-self-start text-xs font-medium text-accent-600 hover:text-accent-800"
                          >
                            Edit details →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ParamFormFields({
  form,
  set,
  categories,
}: {
  form: ParamForm;
  set: (f: keyof ParamForm, v: string) => void;
  categories: TestCategory[];
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">
          Code <span className="text-status-critical">*</span>
        </label>
        <input
          value={form.code}
          onChange={(e) => set("code", e.target.value)}
          placeholder="CBC"
          className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">
          Name <span className="text-status-critical">*</span>
        </label>
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Complete Blood Count"
          className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">
          Category <span className="text-status-critical">*</span>
        </label>
        <div className="relative">
          <input
            list="category-options"
            value={form.categoryName}
            onChange={(e) => set("categoryName", e.target.value)}
            placeholder="Type or pick a category…"
            className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
          />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <p className="text-[11px] text-ink-400 mt-1">
          New names are created automatically on save.
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">
          Sample Type
        </label>
        <select
          value={form.sampleType}
          onChange={(e) => set("sampleType", e.target.value)}
          className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm bg-surface-0 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
        >
          {["Blood", "Serum", "Plasma", "Urine", "Stool", "Swab", "CSF", "Other"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            )
          )}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">
          Unit
        </label>
        <input
          value={form.unit}
          onChange={(e) => set("unit", e.target.value)}
          placeholder="mg/dL"
          className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">
          Methodology
        </label>
        <input
          value={form.methodology}
          onChange={(e) => set("methodology", e.target.value)}
          placeholder="e.g. Enzymatic"
          className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">
          Turnaround (hours)
        </label>
        <input
          type="number"
          min="0"
          value={form.turnaroundHours}
          onChange={(e) => set("turnaroundHours", e.target.value)}
          placeholder="24"
          className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">
          Default Price (₹)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.defaultPrice}
          onChange={(e) => set("defaultPrice", e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">
          Sort Order
        </label>
        <input
          type="number"
          value={form.sortOrder}
          onChange={(e) => set("sortOrder", e.target.value)}
          className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
        />
      </div>
    </div>
  );
}
