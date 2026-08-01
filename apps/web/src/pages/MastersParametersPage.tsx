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
  Wand2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  getMastersCategories,
  getMastersParameters,
  createMastersCategory,
  updateMastersCategory,
  createMastersParameter,
  updateMastersParameter,
  setMastersParameterStatus,
  bulkSetMastersParameterStatus,
  generateMastersParameterCode,
  type TestCategory,
  type TestParameter,
} from "../lib/api-client";

interface ParamForm {
  code: string;
  name: string;
  categoryName: string;
  sampleType: string;
  unit: string;
  refLow: string;
  refHigh: string;
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
  refLow: "",
  refHigh: "",
  methodology: "",
  turnaroundHours: "",
  defaultPrice: "",
  sortOrder: "0",
};

/**
 * ParametersPanel — the Test Parameters masters screen.
 *
 * Category is a TYPEABLE input (with suggestions): typing a name that isn't
 * a category yet auto-creates it on save. Picking an existing category also
 * auto-generates a suggested code (HEM-001 style) and pre-fills the
 * category's sample-type / turnaround defaults. Rows have a one-click
 * enable/disable toggle, a bulk-disable bar, and sort arrows.
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Category editor (prefix + defaults) keyed by category id
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({
    codePrefix: "",
    defaultSampleType: "",
    defaultTurnaroundHours: "",
  });

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
        (p.sampleType ?? "").toLowerCase().includes(q) ||
        (p.unit ?? "").toLowerCase().includes(q)
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
      refLow: p.refLow != null ? String(p.refLow) : "",
      refHigh: p.refHigh != null ? String(p.refHigh) : "",
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

  /** When the category changes, pre-fill the suggested code + category defaults
   *  — but never overwrite a code the user has already started typing. */
  const onCategoryChange = (value: string) => {
    set("categoryName", value);
    const cat = categories.find(
      (c) => c.name.toLowerCase() === value.trim().toLowerCase()
    );
    if (!cat) return;
    if (!form.code.trim()) {
      generateMastersParameterCode(cat.id)
        .then((code) => {
          setForm((f) => (f.code.trim() ? f : { ...f, code }));
        })
        .catch(() => {
          // suggestion is best-effort; the user can still type a code
        });
    }
    setForm((f) => ({
      ...f,
      categoryName: value,
      sampleType: cat.defaultSampleType || f.sampleType,
      turnaroundHours:
        cat.defaultTurnaroundHours != null
          ? String(cat.defaultTurnaroundHours)
          : f.turnaroundHours,
    }));
  };

  const generateCodeNow = () => {
    const cat = categories.find(
      (c) => c.name.toLowerCase() === form.categoryName.trim().toLowerCase()
    );
    if (!cat) {
      setError("Pick an existing category to generate a code");
      return;
    }
    generateMastersParameterCode(cat.id)
      .then((code) => set("code", code))
      .catch(() => setError("Could not generate code"));
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
        refLow: form.refLow ? parseFloat(form.refLow) : undefined,
        refHigh: form.refHigh ? parseFloat(form.refHigh) : undefined,
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

  // ── Quick enable/disable (optimistic) ─────────────────────────────────────
  const toggleStatus = async (p: TestParameter) => {
    const next = !p.isActive;
    setParameters((list) =>
      list.map((x) => (x.id === p.id ? { ...x, isActive: next } : x))
    );
    try {
      await setMastersParameterStatus(p.id, next);
    } catch {
      setParameters((list) =>
        list.map((x) => (x.id === p.id ? { ...x, isActive: p.isActive } : x))
      );
    }
  };

  // ── Bulk disable bar ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const disableSelected = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      await bulkSetMastersParameterStatus([...selected], false);
      setSelected(new Set());
      await load();
    } catch {
      setError("Failed to disable selected parameters");
    } finally {
      setBulkBusy(false);
    }
  };

  // ── Sort arrows (swap sortOrder with neighbour within the same category) ──
  const moveParam = async (p: TestParameter, dir: -1 | 1) => {
    const siblings = parameters
      .filter((x) => x.categoryId === p.categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const idx = siblings.findIndex((x) => x.id === p.id);
    const other = siblings[idx + dir];
    if (!other) return;
    const aOrder = p.sortOrder;
    const bOrder = other.sortOrder;
    setParameters((list) =>
      list.map((x) =>
        x.id === p.id
          ? { ...x, sortOrder: bOrder }
          : x.id === other.id
            ? { ...x, sortOrder: aOrder }
            : x
      )
    );
    try {
      await Promise.all([
        updateMastersParameter(p.id, { sortOrder: bOrder }),
        updateMastersParameter(other.id, { sortOrder: aOrder }),
      ]);
      await load();
    } catch {
      await load(); // roll back to server truth
    }
  };

  // ── Category editor (code prefix + defaults) ──────────────────────────────
  const openCatEditor = (cat: TestCategory) => {
    setEditingCat(cat.id);
    setCatForm({
      codePrefix: cat.codePrefix ?? "",
      defaultSampleType: cat.defaultSampleType ?? "",
      defaultTurnaroundHours:
        cat.defaultTurnaroundHours != null
          ? String(cat.defaultTurnaroundHours)
          : "",
    });
  };

  const saveCat = async () => {
    if (!editingCat) return;
    try {
      await updateMastersCategory(editingCat, {
        codePrefix: catForm.codePrefix.trim(),
        defaultSampleType: catForm.defaultSampleType || null,
        defaultTurnaroundHours: catForm.defaultTurnaroundHours
          ? parseInt(catForm.defaultTurnaroundHours, 10)
          : null,
      });
      setEditingCat(null);
      await load();
    } catch {
      setError("Failed to save category");
    }
  };

  const selectedCount = selected.size;

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Toolbar: search + add */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search by code, name, unit or sample type…"
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

        {/* Bulk disable bar */}
        {selectedCount > 0 && (
          <div className="flex items-center justify-between rounded-md border border-status-critical/30 bg-status-critical/5 px-4 py-2.5">
            <span className="text-sm font-medium text-ink-800">
              {selectedCount} selected
            </span>
            <button
              onClick={disableSelected}
              disabled={bulkBusy}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-status-critical text-surface-0 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {bulkBusy && <Loader2 className="size-3.5 animate-spin" />}
              Disable selected
            </button>
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
              onCategoryChange={onCategoryChange}
              onGenerateCode={generateCodeNow}
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
          grouped.map(([catId, params]) => {
            const cat = categories.find((c) => c.id === catId);
            return (
              <div
                key={catId}
                className="rounded-md border border-line-200 bg-surface-0 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2.5 bg-surface-100/60 border-b border-line-200">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 flex items-center gap-2">
                    <Layers className="size-3.5 text-accent-600" />
                    {catName(catId)}
                    {cat?.codePrefix ? (
                      <span className="normal-case font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-accent-100 text-accent-700">
                        {cat.codePrefix}
                      </span>
                    ) : null}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-ink-400">
                      {params.length} parameter{params.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => cat && openCatEditor(cat)}
                      className="text-[11px] font-medium text-accent-600 hover:text-accent-800"
                    >
                      Edit prefix
                    </button>
                  </div>
                </div>

                {editingCat === catId && cat && (
                  <div className="px-4 py-3 border-b border-line-200 bg-accent-50/40">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-ink-600 mb-1">
                          Code prefix (e.g. HEM)
                        </label>
                        <input
                          value={catForm.codePrefix}
                          onChange={(e) =>
                            setCatForm((f) => ({
                              ...f,
                              codePrefix: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-1.5 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-ink-600 mb-1">
                          Default sample type
                        </label>
                        <input
                          value={catForm.defaultSampleType}
                          onChange={(e) =>
                            setCatForm((f) => ({
                              ...f,
                              defaultSampleType: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-1.5 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-ink-600 mb-1">
                          Default turnaround (hrs)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={catForm.defaultTurnaroundHours}
                          onChange={(e) =>
                            setCatForm((f) => ({
                              ...f,
                              defaultTurnaroundHours: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-1.5 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        onClick={() => setEditingCat(null)}
                        className="text-xs font-medium text-ink-500 hover:text-ink-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveCat}
                        className="px-3 py-1.5 rounded-md bg-accent-700 text-surface-0 text-xs font-semibold hover:bg-accent-800"
                      >
                        Save category
                      </button>
                    </div>
                  </div>
                )}

                {params.map((p) => (
                  <div key={p.id} className="border-b border-line-200 last:border-b-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-100/60 transition-colors duration-fast">
                      {/* Bulk-select checkbox */}
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="size-4 accent-accent-700 shrink-0"
                        title="Select for bulk disable"
                      />
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
                      {p.unit && (
                        <span className="hidden md:inline text-[11px] text-ink-400">
                          {p.unit}
                        </span>
                      )}
                      <span className="text-sm text-ink-500 font-mono">
                        ₹{p.defaultPrice}
                      </span>
                      {p.sampleType && (
                        <span className="hidden sm:inline text-[11px] text-ink-400 px-2 py-0.5 rounded-sm bg-surface-100 border border-line-200">
                          {p.sampleType}
                        </span>
                      )}
                      {/* Quick enable/disable toggle */}
                      <button
                        onClick={() => toggleStatus(p)}
                        title={p.isActive ? "Click to deactivate" : "Click to activate"}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-fast shrink-0 ${
                          p.isActive
                            ? "bg-status-success"
                            : "bg-ink-300"
                        }`}
                      >
                        <span
                          className={`inline-block size-3.5 transform rounded-full bg-surface-0 shadow transition-transform duration-fast ${
                            p.isActive ? "translate-x-[18px]" : "translate-x-[3px]"
                          }`}
                        />
                      </button>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          p.isActive
                            ? "bg-status-success/10 text-status-success"
                            : "bg-ink-400/10 text-ink-400"
                        }`}
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                      {/* Sort arrows */}
                      <span className="flex flex-col shrink-0">
                        <button
                          onClick={() => moveParam(p, -1)}
                          title="Move up"
                          className="text-ink-300 hover:text-accent-600 -mb-1"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          onClick={() => moveParam(p, 1)}
                          title="Move down"
                          className="text-ink-300 hover:text-accent-600 -mt-1"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </span>
                      <button
                        onClick={() => startEdit(p)}
                        className="text-xs font-medium text-accent-600 hover:text-accent-800 shrink-0"
                      >
                        Edit
                      </button>
                    </div>

                    {expanded.has(p.id) && (
                      <div className="px-4 pb-4 pl-14 border-t border-line-200 pt-4">
                        {editId === p.id ? (
                          <>
                            <ParamFormFields
                              form={form}
                              set={set}
                              categories={categories}
                              onCategoryChange={onCategoryChange}
                              onGenerateCode={generateCodeNow}
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
                          <div className="grid sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-0.5">
                                Unit
                              </div>
                              <div className="text-ink-950">{p.unit || "—"}</div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-0.5">
                                Ref Range
                              </div>
                              <div className="text-ink-950">
                                {p.refLow != null || p.refHigh != null
                                  ? `${p.refLow ?? "—"} – ${p.refHigh ?? "—"}`
                                  : "—"}
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
                            {typeof p.usageCount === "number" &&
                              p.usageCount > 0 && (
                                <div className="sm:col-span-4">
                                  <span className="text-[11px] text-status-warning font-medium">
                                    Used in {p.usageCount} order
                                    {p.usageCount !== 1 ? "s" : ""} — disabling
                                    stops it appearing in new orders
                                  </span>
                                </div>
                              )}
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
            );
          })
        )}
      </div>
    </div>
  );
}

function ParamFormFields({
  form,
  set,
  categories,
  onCategoryChange,
  onGenerateCode,
}: {
  form: ParamForm;
  set: (f: keyof ParamForm, v: string) => void;
  categories: TestCategory[];
  onCategoryChange: (v: string) => void;
  onGenerateCode: () => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">
          Code <span className="text-status-critical">*</span>
        </label>
        <div className="flex gap-2">
          <input
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder="HEM-001"
            className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
          />
          <button
            onClick={onGenerateCode}
            type="button"
            title="Generate code"
            className="inline-flex items-center gap-1 px-2.5 rounded-sm border border-line-200 text-xs font-medium text-accent-600 hover:bg-surface-100 shrink-0"
          >
            <Wand2 className="size-3.5" /> Auto
          </button>
        </div>
        <p className="text-[11px] text-ink-400 mt-1">
          Auto-fills when you pick a category — editable anytime.
        </p>
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
            onChange={(e) => onCategoryChange(e.target.value)}
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
          New names auto-create on save; picking one auto-fills code + defaults.
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
          Ref Low
        </label>
        <input
          type="number"
          step="any"
          value={form.refLow}
          onChange={(e) => set("refLow", e.target.value)}
          placeholder="70"
          className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">
          Ref High
        </label>
        <input
          type="number"
          step="any"
          value={form.refHigh}
          onChange={(e) => set("refHigh", e.target.value)}
          placeholder="110"
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
