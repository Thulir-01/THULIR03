import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Loader2,
  Package,
  X,
  Save,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  getMastersPackages,
  getMastersParameters,
  createMastersPackage,
  updateMastersPackage,
  type TestPackage,
  type TestParameter,
} from "../lib/api-client";

interface PkgForm {
  code: string;
  name: string;
  description: string;
  pricingMode: "sum" | "fixed";
  fixedPrice: string;
  parameterIds: string[];
}

const EMPTY_FORM: PkgForm = {
  code: "",
  name: "",
  description: "",
  pricingMode: "sum",
  fixedPrice: "",
  parameterIds: [],
};

/** PackagesPanel — the Test Packages masters screen (embedded in Masters). */
export default function PackagesPanel() {
  const [packages, setPackages] = useState<TestPackage[]>([]);
  const [parameters, setParameters] = useState<TestParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<PkgForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([getMastersPackages(), getMastersParameters()])
      .then(([pkgs, params]) => {
        setPackages(pkgs);
        setParameters(params.filter((p) => p.isActive));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const paramById = useMemo(
    () => new Map(parameters.map((p) => [p.id, p])),
    [parameters]
  );

  const sumOfParts = useMemo(
    () =>
      form.parameterIds.reduce(
        (s, id) => s + (paramById.get(id)?.defaultPrice ?? 0),
        0
      ),
    [form.parameterIds, paramById]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
    );
  }, [packages, search]);

  const toggleParam = (id: string) =>
    setForm((f) => ({
      ...f,
      parameterIds: f.parameterIds.includes(id)
        ? f.parameterIds.filter((x) => x !== id)
        : [...f.parameterIds, id],
    }));

  const startCreate = () => {
    setForm(EMPTY_FORM);
    setCreating(true);
    setEditingId(null);
    setError("");
  };

  const startEdit = (p: TestPackage) => {
    setEditingId(p.id);
    setExpanded((s) => new Set(s).add(p.id));
    setForm({
      code: p.code,
      name: p.name,
      description: p.description ?? "",
      pricingMode: p.pricingMode,
      fixedPrice: p.fixedPrice != null ? String(p.fixedPrice) : "",
      parameterIds: p.items.map((i) => i.parameterId),
    });
    setError("");
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError("Code and name are required");
      return;
    }
    if (form.pricingMode === "fixed" && !form.fixedPrice) {
      setError("Fixed pricing mode requires a fixed price");
      return;
    }
    if (form.parameterIds.length === 0) {
      setError("Select at least one parameter");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description || undefined,
        pricingMode: form.pricingMode,
        fixedPrice:
          form.pricingMode === "fixed"
            ? parseFloat(form.fixedPrice)
            : null,
        parameterIds: form.parameterIds,
      };
      if (editingId) {
        await updateMastersPackage(editingId, body);
      } else {
        await createMastersPackage(body);
      }
      setCreating(false);
      setEditingId(null);
      await load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        "Failed to save package. Check for duplicate code.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const pkgSum = (p: TestPackage) =>
    p.items.reduce((s, i) => s + (i.parameter?.defaultPrice ?? 0), 0);

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
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search packages…"
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
            Add Package
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
            {error}
          </div>
        )}

        {/* Create/edit form */}
        {(creating || editingId) && (
          <div className="rounded-md border border-accent-200 bg-surface-0 p-5 shadow-overlay">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ink-950 flex items-center gap-2">
                <Package className="size-4 text-accent-600" />
                {editingId ? "Edit Package" : "New Test Package"}
              </h2>
              <button
                onClick={() => {
                  setCreating(false);
                  setEditingId(null);
                }}
                className="text-ink-400 hover:text-ink-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">
                  Code <span className="text-status-critical">*</span>
                </label>
                <input
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="FEVER-PANEL"
                  className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">
                  Name <span className="text-status-critical">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Fever Panel"
                  className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-600 mb-1">
                  Description
                </label>
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="What this panel covers…"
                  className="w-full px-3 py-2 rounded-sm border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
                />
              </div>
            </div>

            {/* Pricing mode */}
            <div className="mt-5">
              <label className="block text-xs font-medium text-ink-600 mb-2">
                Pricing Mode
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setForm((f) => ({ ...f, pricingMode: "sum" }))
                  }
                  className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors duration-fast ${
                    form.pricingMode === "sum"
                      ? "bg-accent-700 text-surface-0 border-accent-700"
                      : "border-line-200 text-ink-600 hover:bg-surface-100"
                  }`}
                >
                  Sum of parts
                </button>
                <button
                  onClick={() =>
                    setForm((f) => ({ ...f, pricingMode: "fixed" }))
                  }
                  className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors duration-fast ${
                    form.pricingMode === "fixed"
                      ? "bg-accent-700 text-surface-0 border-accent-700"
                      : "border-line-200 text-ink-600 hover:bg-surface-100"
                  }`}
                >
                  Fixed price
                </button>
              </div>
              <p className="text-[11px] text-ink-400 mt-1.5">
                {form.pricingMode === "sum"
                  ? "Patient pays the total of the included parameters (referrer overrides still apply per line item)."
                  : "Patient pays one flat rate regardless of the included parameters."}
              </p>
            </div>

            {/* Running totals */}
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-md border border-line-200 bg-surface-100/60 px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-ink-400">
                  Sum of parts
                </div>
                <div className="text-lg font-semibold text-ink-950 font-mono">
                  ₹{sumOfParts.toFixed(2)}
                </div>
              </div>
              <div className="rounded-md border border-line-200 bg-surface-100/60 px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-ink-400">
                  Fixed price
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={form.pricingMode !== "fixed"}
                  value={form.fixedPrice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fixedPrice: e.target.value }))
                  }
                  placeholder="0.00"
                  className="w-full bg-transparent text-lg font-semibold text-ink-950 font-mono focus:outline-none disabled:opacity-40"
                />
              </div>
            </div>

            {/* Parameter picker */}
            <div className="mt-5">
              <label className="block text-xs font-medium text-ink-600 mb-2">
                Included Parameters ({form.parameterIds.length} selected)
              </label>
              <div className="max-h-56 overflow-y-auto rounded-md border border-line-200 divide-y divide-line-200">
                {parameters.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-ink-400">
                    No active parameters yet — add them on the Parameters tab
                    first.
                  </div>
                )}
                {parameters.map((p) => {
                  const checked = form.parameterIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors duration-fast ${
                        checked ? "bg-accent-100/60" : "hover:bg-surface-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleParam(p.id)}
                        className="size-4 accent-accent-700"
                      />
                      <span className="font-mono text-xs text-ink-400 w-14 shrink-0">
                        {p.code}
                      </span>
                      <span className="text-sm text-ink-950 flex-1 truncate">
                        {p.name}
                      </span>
                      <span className="text-sm text-ink-500 font-mono">
                        ₹{p.defaultPrice}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setCreating(false);
                  setEditingId(null);
                }}
                className="px-4 py-2 rounded-md border border-line-200 text-sm font-medium text-ink-600 hover:bg-surface-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-700 text-surface-0 text-sm font-semibold hover:bg-accent-800 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save Package
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 text-accent-600 animate-spin" />
            <span className="ml-3 text-sm text-ink-400">
              Loading packages…
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-md bg-accent-100 flex items-center justify-center">
              <Package className="size-8 text-accent-500" />
            </div>
            <h3 className="text-lg font-semibold text-ink-950 mb-2">
              {search ? "No packages match" : "No packages yet"}
            </h3>
            <p className="text-sm text-ink-400 mb-6">
              {search
                ? "Try a different search term"
                : "Bundle related tests into packages for faster billing"}
            </p>
            {!search && (
              <button
                onClick={startCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-700 text-surface-0 text-sm font-medium hover:bg-accent-800"
              >
                <Plus className="size-4" /> Add Package
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="rounded-md border border-line-200 bg-surface-0 overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-100/60 transition-colors duration-fast">
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
                  <span className="font-mono text-xs text-ink-400 w-24 shrink-0">
                    {p.code}
                  </span>
                  <span className="text-sm font-medium text-ink-950 flex-1 truncate">
                    {p.name}
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      p.pricingMode === "fixed"
                        ? "bg-status-info/10 text-status-info"
                        : "bg-surface-100 border border-line-200 text-ink-500"
                    }`}
                  >
                    {p.pricingMode === "fixed" ? "Fixed" : "Sum"}
                  </span>
                  <span className="text-sm text-ink-950 font-mono">
                    {p.pricingMode === "fixed"
                      ? `₹${p.fixedPrice}`
                      : `₹${pkgSum(p).toFixed(2)}`}
                  </span>
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
                  <div className="px-4 pb-4 pl-12 border-t border-line-200 pt-3">
                    {p.description && (
                      <p className="text-sm text-ink-500 mb-3">
                        {p.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="size-3.5 text-accent-600" />
                      <span className="text-[11px] uppercase tracking-wider text-ink-400">
                        {p.items.length} included parameters
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.items.map((i) => (
                        <span
                          key={i.id}
                          className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-sm bg-surface-100 border border-line-200 text-ink-600"
                        >
                          <span className="font-mono text-ink-400">
                            {i.parameter?.code}
                          </span>
                          {i.parameter?.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
