import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Wand2,
  X,
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
  // Master-config: technical specs + acceptance criteria + workflow
  testCategory: string;
  detectionLimit: string;
  reportingLimit: string;
  lowerLimit: string;
  upperLimit: string;
  limitType: string;
  calculationFormula: string;
  criticalValueAlert: boolean;
  autoApprove: boolean;
  requiresApproval: boolean;
  visibleOnReport: boolean;
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
  testCategory: "Physicochemical",
  detectionLimit: "",
  reportingLimit: "",
  lowerLimit: "",
  upperLimit: "",
  limitType: "RANGE",
  calculationFormula: "",
  criticalValueAlert: false,
  autoApprove: false,
  requiresApproval: false,
  visibleOnReport: true,
};

const SAMPLE_TYPES = [
  "Blood",
  "Serum",
  "Plasma",
  "Urine",
  "Stool",
  "Swab",
  "CSF",
  "Other",
];
const TEST_CATEGORIES = [
  "Physicochemical",
  "Microbiological",
  "Heavy Metal",
  "Hematology",
  "Biochemistry",
  "Immunology",
  "Other",
];
const LIMIT_TYPES = ["RANGE", "MIN_ONLY", "MAX_ONLY", "PASS_FAIL"];

/** Parameters master — fullscreen split layout: left = identity/technical
 *  specs (grouped cards), right = acceptance criteria + workflow rules.
 *  Category is a TYPEABLE input (with suggestions): typing a name that isn't
 *  a category yet auto-creates it on save. Picking an existing category also
 *  auto-generates a suggested code (HEM-001 style) and pre-fills the
 *  category's sample-type / turnaround defaults. */
export default function ParametersPanel() {
  const [categories, setCategories] = useState<TestCategory[]>([]);
  const [parameters, setParameters] = useState<TestParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState<TestParameter | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<ParamForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rightTab, setRightTab] = useState<"acceptance" | "workflow">("acceptance");

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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
        return params;
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setComboboxOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const catName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parameters;
    return parameters.filter((p) => {
      return (
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.sampleType ?? "").toLowerCase().includes(q) ||
        (p.unit ?? "").toLowerCase().includes(q)
      );
    });
  }, [parameters, query]);

  const set = (field: keyof ParamForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));
  const toggleParam = (field: keyof ParamForm) =>
    setForm((f) => ({ ...f, [field]: !f[field] }));

  const formToParam = (p: TestParameter): ParamForm => ({
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
    testCategory: p.testCategory ?? "Physicochemical",
    detectionLimit: p.detectionLimit != null ? String(p.detectionLimit) : "",
    reportingLimit: p.reportingLimit != null ? String(p.reportingLimit) : "",
    lowerLimit: p.lowerLimit != null ? String(p.lowerLimit) : "",
    upperLimit: p.upperLimit != null ? String(p.upperLimit) : "",
    limitType: p.limitType ?? "RANGE",
    calculationFormula: p.calculationFormula ?? "",
    criticalValueAlert: p.criticalValueAlert,
    autoApprove: p.autoApprove,
    requiresApproval: p.requiresApproval,
    visibleOnReport: p.visibleOnReport,
  });

  const startCreate = () => {
    setForm({ ...EMPTY_FORM, categoryName: categories[0]?.name ?? "" });
    setIsNew(true);
    setEditing(null);
    setError("");
    setQuery("");
    setComboboxOpen(false);
    setRightTab("acceptance");
  };

  const startEdit = (p: TestParameter) => {
    setEditing(p);
    setIsNew(false);
    setForm(formToParam(p));
    setError("");
    setQuery(p.name);
    setComboboxOpen(false);
    setRightTab("acceptance");
  };

  const discard = () => {
    setEditing(null);
    setIsNew(false);
    setForm(EMPTY_FORM);
    setError("");
    setQuery("");
  };

  /** Resolve the typed category name to an id — creating it if new. */
  const resolveCategory = async (name: string): Promise<string> => {
    const trimmed = name.trim();
    const existing = categories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing.id;
    const cat = await createMastersCategory({ name: trimmed });
    await load(); // refresh so the new category appears immediately
    return cat.id;
  };

  /** When the category changes, pre-fill the suggested code + category
   *  defaults — but never overwrite a code the user has already typed. */
  const onCategoryChange = (value: string) => {
    set("categoryName", value);
    const cat = categories.find(
      (c) => c.name.toLowerCase() === value.trim().toLowerCase(),
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
      (c) => c.name.toLowerCase() === form.categoryName.trim().toLowerCase(),
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
        testCategory: form.testCategory || undefined,
        detectionLimit: form.detectionLimit
          ? parseFloat(form.detectionLimit)
          : undefined,
        reportingLimit: form.reportingLimit
          ? parseFloat(form.reportingLimit)
          : undefined,
        lowerLimit: form.lowerLimit ? parseFloat(form.lowerLimit) : undefined,
        upperLimit: form.upperLimit ? parseFloat(form.upperLimit) : undefined,
        limitType: form.limitType || undefined,
        calculationFormula: form.calculationFormula || undefined,
        criticalValueAlert: form.criticalValueAlert,
        autoApprove: form.autoApprove,
        requiresApproval: form.requiresApproval,
        visibleOnReport: form.visibleOnReport,
      };
      const saved = id
        ? await updateMastersParameter(id, body)
        : await createMastersParameter(body);
      await load();
      setEditing(saved);
      setIsNew(false);
      setForm(formToParam(saved));
      setError("");
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
      list.map((x) => (x.id === p.id ? { ...x, isActive: next } : x)),
    );
    try {
      await setMastersParameterStatus(p.id, next);
    } catch {
      setParameters((list) =>
        list.map((x) => (x.id === p.id ? { ...x, isActive: p.isActive } : x)),
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
            : x,
      ),
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

  // ── Grouped list (left panel, picker mode) ────────────────────────────────
  const grouped = useMemo(() => {
    const byCat = new Map<string, TestParameter[]>();
    for (const p of matches) {
      const list = byCat.get(p.categoryId) ?? [];
      list.push(p);
      byCat.set(p.categoryId, list);
    }
    return [...byCat.entries()].sort((a, b) =>
      catName(a[0]).localeCompare(catName(b[0])),
    );
  }, [matches, categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = editing ? editing.isActive : null;

  return (
    <div className="flex h-full flex-col bg-surface-100">
      {/* ── Top bar: title · select combobox · actions ── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line-200 bg-surface-0 px-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-700">
          <FlaskConical className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-bold leading-tight text-ink-950">
            Parameter Master
          </h1>
          <p className="truncate text-[11px] leading-tight text-ink-400">
            Test definitions — units, reference ranges, acceptance rules &amp; workflow
          </p>
        </div>

        {/* Select parameter */}
        <div ref={comboboxRef} className="relative ml-4 w-80 shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setComboboxOpen(true);
            }}
            onFocus={() => setComboboxOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches.length > 0) startEdit(matches[0]);
              if (e.key === "Escape") setComboboxOpen(false);
            }}
            placeholder="Select Parameter…"
            className="w-full rounded-md border border-line-200 bg-surface-0 py-1.5 pl-8 pr-7 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 transition-colors duration-fast hover:text-ink-600"
            >
              <X className="size-3.5" />
            </button>
          )}
          {comboboxOpen && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-overlay">
              <div className="max-h-64 overflow-y-auto py-1">
                {matches.length === 0 ? (
                  <p className="px-3 py-3 text-center text-[12px] text-ink-400">
                    {loading ? "Loading…" : "No matches"}
                  </p>
                ) : (
                  matches.map((p) => {
                    const isSel = editing && p.id === editing.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => startEdit(p)}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-fast hover:bg-surface-100 ${
                          isSel ? "bg-accent-50" : ""
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink-900">
                            {p.name}
                          </span>
                          <span className="block truncate text-[11px] text-ink-400">
                            {`${p.code} · ${catName(p.categoryId)}`}
                          </span>
                        </span>
                        {isSel && <Check className="size-3.5 shrink-0 text-accent-700" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {active != null && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                active
                  ? "bg-status-success/10 text-status-success"
                  : "bg-gray-100 text-ink-500"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${active ? "bg-status-success" : "bg-ink-300"}`}
              />
              {active ? "Active" : "Inactive"}
            </span>
          )}
          <button
            onClick={startCreate}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-1.5 text-[13px] font-semibold text-ink-700 transition-colors duration-fast hover:bg-surface-100"
          >
            <Plus className="size-4" /> New Parameter
          </button>
          <button
            onClick={() => void handleSave(editing?.id ?? null)}
            disabled={saving || (!editing && !isNew)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-1.5 text-[13px] font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Saving…" : "Save"}
          </button>
          {(editing || isNew) && (
            <button
              onClick={discard}
              title="Discard changes / close record"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] text-ink-500 transition-colors duration-fast hover:bg-surface-100 hover:text-ink-700"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="flex shrink-0 items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-1.5 text-[12px] font-medium text-status-critical">
          <span className="min-w-0 flex-1 truncate">{error}</span>
          <button
            onClick={() => setError("")}
            className="text-status-critical/60 hover:text-status-critical"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* ── Body: left identity/specs · right rules/workflow ── */}
      <div className="flex min-h-0 flex-1">
        {/* LEFT — form cards / grouped picker */}
        <div className="flex w-[46%] min-w-0 shrink-0 flex-col border-r border-line-200 bg-surface-0">
          {editing || isNew ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line-200 px-4 py-2">
                <span className="truncate text-[11px] font-bold uppercase tracking-wide text-ink-500">
                  {form.code || "New"} — {form.name || "New Parameter"}
                </span>
                <span className="shrink-0 text-[11px] text-ink-400">
                  {isNew ? "Creating…" : "Editing"}
                </span>
              </div>
              <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4">
                {/* Basic Details */}
                <fieldset className="rounded-md border border-line-200 bg-surface-0 p-3">
                  <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                    Basic Details
                  </legend>
                  <div className="grid grid-cols-12 gap-x-3 gap-y-2">
                    <div className="col-span-12">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Code <span className="text-status-critical">*</span>
                        </label>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              value={form.code}
                              onChange={(e) => set("code", e.target.value)}
                              placeholder="HEM-001"
                              className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                            />
                            <button
                              onClick={generateCodeNow}
                              type="button"
                              title="Generate code"
                              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-line-200 px-2 text-[11px] font-medium text-accent-700 transition-colors duration-fast hover:bg-accent-50"
                            >
                              <Wand2 className="size-3.5" /> Auto
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Name <span className="text-status-critical">*</span>
                        </label>
                        <div className="min-w-0 flex-1">
                          <input
                            value={form.name}
                            onChange={(e) => set("name", e.target.value)}
                            placeholder="Complete Blood Count"
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Category <span className="text-status-critical">*</span>
                        </label>
                        <div className="min-w-0 flex-1">
                          <input
                            list="category-options"
                            value={form.categoryName}
                            onChange={(e) => onCategoryChange(e.target.value)}
                            placeholder="Type or pick a category…"
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                          <datalist id="category-options">
                            {categories.map((c) => (
                              <option key={c.id} value={c.name} />
                            ))}
                          </datalist>
                          <p className="mt-0.5 pl-32 text-[10px] leading-snug text-ink-400">
                            New names auto-create on save; picking one auto-fills code + defaults.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Sort Order
                        </label>
                        <div className="min-w-0 flex-1">
                          <input
                            type="number"
                            value={form.sortOrder}
                            onChange={(e) => set("sortOrder", e.target.value)}
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </fieldset>

                {/* Testing */}
                <fieldset className="rounded-md border border-line-200 bg-surface-0 p-3">
                  <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                    Testing
                  </legend>
                  <div className="grid grid-cols-12 gap-x-3 gap-y-2">
                    <div className="col-span-12 sm:col-span-6">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Sample Type
                        </label>
                        <div className="min-w-0 flex-1">
                          <select
                            value={form.sampleType}
                            onChange={(e) => set("sampleType", e.target.value)}
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          >
                            {SAMPLE_TYPES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Unit
                        </label>
                        <div className="min-w-0 flex-1">
                          <input
                            value={form.unit}
                            onChange={(e) => set("unit", e.target.value)}
                            placeholder="mg/dL"
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Ref Low
                        </label>
                        <div className="min-w-0 flex-1">
                          <input
                            type="number"
                            step="any"
                            value={form.refLow}
                            onChange={(e) => set("refLow", e.target.value)}
                            placeholder="70"
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Ref High
                        </label>
                        <div className="min-w-0 flex-1">
                          <input
                            type="number"
                            step="any"
                            value={form.refHigh}
                            onChange={(e) => set("refHigh", e.target.value)}
                            placeholder="110"
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Methodology
                        </label>
                        <div className="min-w-0 flex-1">
                          <input
                            value={form.methodology}
                            onChange={(e) => set("methodology", e.target.value)}
                            placeholder="e.g. Enzymatic"
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Turnaround (hrs)
                        </label>
                        <div className="min-w-0 flex-1">
                          <input
                            type="number"
                            min="0"
                            value={form.turnaroundHours}
                            onChange={(e) => set("turnaroundHours", e.target.value)}
                            placeholder="24"
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Default Price (₹)
                        </label>
                        <div className="min-w-0 flex-1">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.defaultPrice}
                            onChange={(e) => set("defaultPrice", e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </fieldset>

                {/* Technical Specs */}
                <fieldset className="rounded-md border border-line-200 bg-surface-0 p-3">
                  <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                    Technical Specs
                  </legend>
                  <div className="grid grid-cols-12 gap-x-3 gap-y-2">
                    <div className="col-span-12 sm:col-span-6">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Test Category
                        </label>
                        <div className="min-w-0 flex-1">
                          <select
                            value={form.testCategory}
                            onChange={(e) => set("testCategory", e.target.value)}
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          >
                            {TEST_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Detection Limit
                        </label>
                        <div className="min-w-0 flex-1">
                          <input
                            type="number"
                            step="any"
                            value={form.detectionLimit}
                            onChange={(e) => set("detectionLimit", e.target.value)}
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12">
                      <div className="flex items-center gap-2">
                        <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                          Reporting Limit
                        </label>
                        <div className="min-w-0 flex-1">
                          <input
                            type="number"
                            step="any"
                            value={form.reportingLimit}
                            onChange={(e) => set("reportingLimit", e.target.value)}
                            placeholder="Report as < Limit below this"
                            className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </fieldset>
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between border-b border-line-200 px-4 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500">
                  {query ? `Matches (${matches.length})` : "All Parameters"}
                </span>
                <span className="text-[11px] text-ink-400">
                  {parameters.length} total
                </span>
              </div>
              {selected.size > 0 && (
                <div className="flex shrink-0 items-center justify-between border-b border-line-200 bg-status-critical/5 px-4 py-1.5">
                  <span className="text-[12px] font-medium text-ink-800">
                    {selected.size} selected
                  </span>
                  <button
                    onClick={disableSelected}
                    disabled={bulkBusy}
                    className="inline-flex items-center gap-1.5 rounded-md bg-status-critical px-2.5 py-1 text-[11px] font-semibold text-surface-0 hover:opacity-90 disabled:opacity-50"
                  >
                    {bulkBusy && <Loader2 className="size-3 animate-spin" />}
                    Disable selected
                  </button>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-ink-400">
                    <Loader2 className="size-4 animate-spin" /> Loading catalogue…
                  </div>
                ) : matches.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-md bg-accent-100">
                      <FlaskConical className="size-6 text-accent-500" />
                    </div>
                    <p className="text-[13px] font-medium text-ink-700">
                      {parameters.length === 0
                        ? "No parameters yet"
                        : "No parameters match"}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-400">
                      {parameters.length === 0
                        ? "Add your first test parameter with “New Parameter”."
                        : "Try a different search term."}
                    </p>
                  </div>
                ) : (
                  grouped.map(([catId, params]) => {
                    const cat = categories.find((c) => c.id === catId);
                    return (
                      <div key={catId} className="border-b border-line-200 last:border-b-0">
                        <div className="flex items-center justify-between gap-2 bg-surface-100/60 px-4 py-2">
                          <h3 className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-500">
                            <Layers className="size-3.5 shrink-0 text-accent-600" />
                            <span className="truncate">{catName(catId)}</span>
                            {cat?.codePrefix ? (
                              <span className="shrink-0 rounded-sm bg-accent-100 px-1.5 py-0.5 font-mono text-[10px] normal-case text-accent-700">
                                {cat.codePrefix}
                              </span>
                            ) : null}
                            <span className="shrink-0 text-[10px] font-normal normal-case text-ink-400">
                              {params.length}
                            </span>
                          </h3>
                          <button
                            onClick={() => cat && openCatEditor(cat)}
                            className="shrink-0 text-[11px] font-medium text-accent-600 hover:text-accent-800"
                          >
                            Edit prefix
                          </button>
                        </div>

                        {editingCat === catId && cat && (
                          <div className="border-b border-line-200 bg-accent-50/40 px-4 py-2.5">
                            <div className="grid grid-cols-12 gap-x-3 gap-y-2">
                              <div className="col-span-12 sm:col-span-4">
                                <label className="mb-1 block text-[10px] font-medium text-ink-600">
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
                                  className="w-full rounded-sm border border-line-200 px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                                />
                              </div>
                              <div className="col-span-12 sm:col-span-4">
                                <label className="mb-1 block text-[10px] font-medium text-ink-600">
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
                                  className="w-full rounded-sm border border-line-200 px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                                />
                              </div>
                              <div className="col-span-12 sm:col-span-4">
                                <label className="mb-1 block text-[10px] font-medium text-ink-600">
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
                                  className="w-full rounded-sm border border-line-200 px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                                />
                              </div>
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                onClick={() => setEditingCat(null)}
                                className="text-[11px] font-medium text-ink-500 hover:text-ink-700"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={saveCat}
                                className="rounded-md bg-accent-700 px-2.5 py-1 text-[11px] font-semibold text-surface-0 hover:bg-accent-800"
                              >
                                Save category
                              </button>
                            </div>
                          </div>
                        )}

                        {params.map((p) => (
                          <div key={p.id} className="border-t border-line-200">
                            <div
                              onClick={() => startEdit(p)}
                              className="flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors duration-fast hover:bg-surface-100/60"
                            >
                              <input
                                type="checkbox"
                                checked={selected.has(p.id)}
                                onChange={() => toggleSelect(p.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="size-3.5 shrink-0 accent-accent-700"
                                title="Select for bulk disable"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpand(p.id);
                                }}
                                className="shrink-0 text-ink-400 hover:text-ink-600"
                              >
                                {expanded.has(p.id) ? (
                                  <ChevronDown className="size-3.5" />
                                ) : (
                                  <ChevronRight className="size-3.5" />
                                )}
                              </button>
                              <span className="w-16 shrink-0 font-mono text-[11px] text-ink-400">
                                {p.code}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-950">
                                {p.name}
                              </span>
                              {p.unit && (
                                <span className="hidden shrink-0 text-[11px] text-ink-400 md:inline">
                                  {p.unit}
                                </span>
                              )}
                              <span className="shrink-0 font-mono text-[12px] text-ink-500">
                                ₹{p.defaultPrice}
                              </span>
                              {p.sampleType && (
                                <span className="hidden shrink-0 rounded-sm border border-line-200 bg-surface-100 px-1.5 py-0.5 text-[10px] text-ink-400 sm:inline">
                                  {p.sampleType}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void toggleStatus(p);
                                }}
                                title={p.isActive ? "Click to deactivate" : "Click to activate"}
                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-fast ${
                                  p.isActive ? "bg-status-success" : "bg-ink-300"
                                }`}
                              >
                                <span
                                  className={`inline-block size-3.5 transform rounded-full bg-surface-0 shadow transition-transform duration-fast ${
                                    p.isActive ? "translate-x-[18px]" : "translate-x-[3px]"
                                  }`}
                                />
                              </button>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  p.isActive
                                    ? "bg-status-success/10 text-status-success"
                                    : "bg-ink-400/10 text-ink-400"
                                }`}
                              >
                                {p.isActive ? "Active" : "Inactive"}
                              </span>
                              <span className="flex shrink-0 flex-col">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void moveParam(p, -1);
                                  }}
                                  title="Move up"
                                  className="-mb-1 text-ink-300 hover:text-accent-600"
                                >
                                  <ArrowUp className="size-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void moveParam(p, 1);
                                  }}
                                  title="Move down"
                                  className="-mt-1 text-ink-300 hover:text-accent-600"
                                >
                                  <ArrowDown className="size-3" />
                                </button>
                              </span>
                            </div>

                            {expanded.has(p.id) && (
                              <div className="border-t border-line-200 px-4 py-2.5 pl-9">
                                <div className="grid grid-cols-4 gap-3 text-[12px]">
                                  <div>
                                    <div className="text-[10px] uppercase tracking-wider text-ink-400">
                                      Unit
                                    </div>
                                    <div className="text-ink-950">{p.unit || "—"}</div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] uppercase tracking-wider text-ink-400">
                                      Ref Range
                                    </div>
                                    <div className="text-ink-950">
                                      {p.refLow != null || p.refHigh != null
                                        ? `${p.refLow ?? "—"} – ${p.refHigh ?? "—"}`
                                        : "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] uppercase tracking-wider text-ink-400">
                                      Methodology
                                    </div>
                                    <div className="truncate text-ink-950">
                                      {p.methodology || "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] uppercase tracking-wider text-ink-400">
                                      Turnaround
                                    </div>
                                    <div className="text-ink-950">
                                      {p.turnaroundHours != null
                                        ? `${p.turnaroundHours} h`
                                        : "—"}
                                    </div>
                                  </div>
                                  {typeof p.usageCount === "number" && p.usageCount > 0 && (
                                    <div className="col-span-4">
                                      <span className="text-[11px] font-medium text-status-warning">
                                        Used in {p.usageCount} order
                                        {p.usageCount !== 1 ? "s" : ""} — disabling stops
                                        it appearing in new orders
                                      </span>
                                    </div>
                                  )}
                                </div>
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
          )}
        </div>

        {/* RIGHT — acceptance criteria / workflow rules */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-end gap-1 border-b border-line-200 bg-surface-0 px-4 pt-2">
            <button
              onClick={() => setRightTab("acceptance")}
              className={`rounded-t-md border border-b-0 px-4 py-1.5 text-[12px] font-bold tracking-wide transition-colors duration-fast ${
                rightTab === "acceptance"
                  ? "border-line-200 bg-surface-100 text-accent-800"
                  : "border-transparent text-ink-400 hover:text-ink-700"
              }`}
            >
              ACCEPTANCE CRITERIA
            </button>
            <button
              onClick={() => setRightTab("workflow")}
              className={`rounded-t-md border border-b-0 px-4 py-1.5 text-[12px] font-bold tracking-wide transition-colors duration-fast ${
                rightTab === "workflow"
                  ? "border-line-200 bg-surface-100 text-accent-800"
                  : "border-transparent text-ink-400 hover:text-ink-700"
              }`}
            >
              WORKFLOW
            </button>
            {!editing && !isNew && (
              <span className="ml-auto pb-1.5 text-[11px] text-ink-300">
                Select a parameter to configure
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-surface-100 p-4">
            {rightTab === "acceptance" && (
              <fieldset className="rounded-md border border-line-200 bg-surface-0 p-3.5">
                <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-700">
                  Acceptance Criteria
                </legend>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                      Lower Limit
                    </label>
                    <div className="min-w-0 flex-1">
                      <input
                        type="number"
                        step="any"
                        value={form.lowerLimit}
                        onChange={(e) => set("lowerLimit", e.target.value)}
                        className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                      Upper Limit
                    </label>
                    <div className="min-w-0 flex-1">
                      <input
                        type="number"
                        step="any"
                        value={form.upperLimit}
                        onChange={(e) => set("upperLimit", e.target.value)}
                        className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
                      Limit Type
                    </label>
                    <div className="min-w-0 flex-1">
                      <select
                        value={form.limitType}
                        onChange={(e) => set("limitType", e.target.value)}
                        className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                      >
                        {LIMIT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="pl-32 text-[11px] text-ink-400">
                    Results outside these limits auto-flag on result entry.
                  </p>
                </div>
              </fieldset>
            )}

            {rightTab === "workflow" && (
              <div className="space-y-4">
                <fieldset className="rounded-md border border-line-200 bg-surface-0 p-3.5">
                  <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-700">
                    Workflow Options
                  </legend>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-2">
                    {(
                      [
                        { key: "criticalValueAlert", label: "Critical Value Alert" },
                        { key: "autoApprove", label: "Auto-Approve in range" },
                        { key: "requiresApproval", label: "Requires Approval" },
                        { key: "visibleOnReport", label: "Visible on Report" },
                      ] as const
                    ).map((o) => (
                      <label
                        key={o.key}
                        className="flex cursor-pointer select-none items-center gap-2 py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={form[o.key]}
                          onChange={() => toggleParam(o.key)}
                          className="size-3.5 shrink-0 accent-accent-700"
                        />
                        <span className="text-[13px] leading-snug text-ink-800">{o.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="rounded-md border border-line-200 bg-surface-0 p-3.5">
                  <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-700">
                    Calculation Formula
                  </legend>
                  <input
                    value={form.calculationFormula}
                    onChange={(e) => set("calculationFormula", e.target.value)}
                    placeholder="e.g. Alkalinity = Acidity + Hardness"
                    className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                  />
                  <p className="mt-1.5 text-[11px] text-ink-400">
                    Optional — derive this value from other parameters.
                  </p>
                </fieldset>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
