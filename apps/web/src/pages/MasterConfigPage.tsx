import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Loader2,
  Plus,
  Search,
  Wand2,
  X,
  Save,
  ChevronRight,
} from "lucide-react";
import type {
  MasterConfig,
  MasterField,
  MasterSetting,
  SettingKind,
} from "./masterConfigs";

// ─── Row value accessor (dotted paths like "commercial.billingAddress") ────

function getPath(row: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, row);
}

// ─── Draft ↔ body ──────────────────────────────────────────────────────────

const str = (v: unknown): string => (v == null ? "" : String(v));

function buildBody(
  config: MasterConfig,
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = { code: str(draft.code).trim().toUpperCase() };
  const all: MasterSetting[] = [...config.settings, ...(config.billing ?? [])];

  for (const f of config.leftFields) {
    if (f.key === "code") {
      body.code = str(draft.code).trim().toUpperCase();
      continue;
    }
    if (f.kind === "number") {
      const v = draft[f.key];
      body[f.key] = v === "" || v == null ? undefined : Number(v);
    } else {
      const v = str(draft[f.key]).trim();
      body[f.key] = v || undefined;
    }
  }
  for (const s of all) {
    if (s.kind === "toggle") {
      body[s.key] = Boolean(draft[s.key]);
    } else if (s.kind === "multicheck") {
      const arr = (draft[s.key] as string[]) ?? [];
      body[s.key] = arr.length ? arr : undefined;
    } else if (s.kind === "number") {
      const v = draft[s.key];
      body[s.key] = v === "" || v == null ? undefined : Number(v);
    } else {
      const v = str(draft[s.key]).trim();
      body[s.key] = v || undefined;
    }
  }
  for (const o of config.options) {
    body[o.key] = Boolean(draft[o.key]);
  }
  // Client master: options + settings live inside `commercial` — handled by its API.
  if (config.key === "client") {
    const commercial: Record<string, unknown> = {};
    for (const o of config.options) commercial[o.key] = Boolean(draft[o.key]);
    for (const s of config.settings) {
      commercial[s.key] =
        s.kind === "number"
          ? draft[s.key] === "" || draft[s.key] == null
            ? undefined
            : Number(draft[s.key])
          : str(draft[s.key]).trim() || undefined;
    }
    body.commercial = commercial;
    return body;
  }
  return body;
}

// ─── Small form controls ────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: MasterField;
  value: unknown;
  error?: string;
  onChange: (v: string) => void;
}) {
  const base =
    "w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 transition-colors duration-fast";
  const cls = `${base} ${
    error
      ? "border-status-critical bg-red-50/40"
      : "border-line-200 bg-surface-0"
  }`;
  if (field.kind === "select") {
    return (
      <div>
        <select
          className={cls}
          value={str(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-[11px] text-status-critical">{error}</p>}
      </div>
    );
  }
  if (field.kind === "textarea") {
    return (
      <div>
        <textarea
          className={`${cls} min-h-20 resize-y`}
          value={str(value)}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {error && <p className="mt-1 text-[11px] text-status-critical">{error}</p>}
      </div>
    );
  }
  if (field.kind === "color") {
    return (
      <div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="size-9 cursor-pointer rounded-md border border-line-200 bg-surface-0 p-0.5"
            value={/^#[0-9A-Fa-f]{6}$/.test(str(value)) ? str(value) : "#8B5CF6"}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            className={cls}
            value={str(value)}
            placeholder="#8B5CF6"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        {error && <p className="mt-1 text-[11px] text-status-critical">{error}</p>}
      </div>
    );
  }
  return (
    <div>
      <input
        type={field.kind === "number" ? "number" : "text"}
        className={cls}
        value={str(value)}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="mt-1 text-[11px] text-status-critical">{error}</p>}
    </div>
  );
}

function SettingControl({
  setting,
  value,
  error,
  onChange,
}: {
  setting: MasterSetting;
  value: unknown;
  error?: string;
  onChange: (v: string | string[] | boolean) => void;
}) {
  const kind = setting.kind as SettingKind;
  const base =
    "w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 transition-colors duration-fast";
  const cls = `${base} ${error ? "border-status-critical" : "border-line-200"}`;

  if (kind === "toggle") {
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-fast ${
          value ? "bg-status-normal" : "bg-line-300"
        }`}
        aria-pressed={Boolean(value)}
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-surface-0 shadow transition-transform duration-fast ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    );
  }
  if (kind === "multicheck") {
    return (
      <div className="flex flex-wrap gap-2">
        {(setting.options ?? []).map((o) => {
          const arr = (value as string[]) ?? [];
          const on = arr.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() =>
                onChange(on ? arr.filter((x) => x !== o) : [...arr, o])
              }
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-fast ${
                on
                  ? "border-accent-500 bg-accent-700 text-surface-0"
                  : "border-line-200 bg-surface-0 text-ink-600 hover:bg-surface-100"
              }`}
            >
              {on && <Check className="size-3" />}
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  if (kind === "select") {
    return (
      <select
        className={cls}
        value={str(value)}
        onChange={(e) => onChange(e.target.value)}
      >
        {(setting.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (kind === "textarea") {
    return (
      <textarea
        className={`${cls} min-h-16 resize-y`}
        value={str(value)}
        placeholder={setting.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      type={kind === "number" ? "number" : kind === "date" ? "date" : "text"}
      className={cls}
      value={kind === "date" && value ? String(value).slice(0, 10) : str(value)}
      placeholder={setting.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ToggleRow({
  option,
  value,
  onChange,
}: {
  option: { key: string; label: string; desc?: string };
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-line-200 bg-surface-0 px-3 py-2.5 transition-colors duration-fast hover:border-line-300">
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-950">{option.label}</p>
        {option.desc && <p className="mt-0.5 text-[11px] leading-snug text-ink-400">{option.desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-fast ${
          value ? "bg-status-normal" : "bg-line-300"
        }`}
        aria-pressed={value}
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-surface-0 shadow transition-transform duration-fast ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function MasterConfigPage({
  config,
}: {
  config: MasterConfig;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rightTab, setRightTab] = useState<"options" | "settings" | "billing">("options");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await config.api.list({
        search: search || undefined,
        isActive: activeFilter || undefined,
      });
      setRows(data);
    } catch {
      setError("Could not load records.");
    } finally {
      setLoading(false);
    }
  }, [config, search, activeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (key: string, value: unknown) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const n = { ...e };
      delete n[key];
      return n;
    });
  };

  const openAdd = async () => {
    setEditing(null);
    setErrors({});
    setError("");
    setRightTab("options");
    const defaults = { ...config.newDefaults };
    if (config.api.generateCode) {
      try {
        const code = await config.api.generateCode();
        defaults.code = code;
      } catch {
        /* best-effort */
      }
    }
    setDraft(defaults);
    setEditorOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setErrors({});
    setError("");
    setRightTab("options");
    setDraft(config.rowToDraft(row));
    setEditorOpen(true);
  };

  const applyCode = async () => {
    try {
      const code = await config.api.generateCode();
      set("code", code);
    } catch {
      setError("Could not generate a code right now.");
    }
  };

  const submit = async () => {
    const errs = config.validate ? config.validate(draft) : {};
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    setError("");
    const body = buildBody(config, draft);
    try {
      const saved = editing
        ? await config.api.update(str(editing.id), body)
        : await config.api.create(body);
      setRows((prev) =>
        editing
          ? prev.map((r) => (r.id === saved.id ? saved : r))
          : [saved, ...prev],
      );
      setEditorOpen(false);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Failed to save. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: Record<string, unknown>) => {
    const next = !config.isActiveOf(row);
    try {
      const updated = await config.api.setStatus(str(row.id), next);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      setError("Failed to update status.");
    }
  };

  const remove = async (row: Record<string, unknown>) => {
    if (!config.api.remove) return;
    if (!confirm(`Deactivate "${str(row.name)}"? History and audit trail are preserved.`))
      return;
    try {
      const updated = await config.api.remove(str(row.id));
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Failed to deactivate.";
      setError(msg);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [str(r.code), str(r.name), str(r.city), str(r.mobile), str(r.modelName)]
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const visibleSettings = (config.settings as MasterSetting[]).filter((s) =>
    s.dependsOn ? Boolean(draft[s.dependsOn.field]) === s.dependsOn.value : true,
  );

  const renderCell = (row: Record<string, unknown>, key: string, kind?: string) => {
    if (kind === "pill") {
      const on = config.isActiveOf(row);
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            on ? "bg-status-normal/10 text-status-normal" : "bg-gray-100 text-ink-500"
          }`}
        >
          <span className={`size-1.5 rounded-full ${on ? "bg-status-normal" : "bg-ink-300"}`} />
          {on ? "Active" : "Inactive"}
        </span>
      );
    }
    if (kind === "color") {
      const v = str(getPath(row, key));
      return v ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3.5 rounded-full border border-line-200" style={{ backgroundColor: v }} />
          <span className="font-mono text-xs text-ink-500">{v}</span>
        </span>
      ) : (
        <span className="text-xs text-ink-300">—</span>
      );
    }
    const v = str(getPath(row, key));
    return v ? <span className="text-xs text-ink-700">{v}</span> : <span className="text-xs text-ink-300">—</span>;
  };

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-700">
              <config.icon className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink-950">{config.title}</h2>
              <p className="text-sm text-ink-400">{config.description}</p>
            </div>
          </div>
          <button
            onClick={() => void openAdd()}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-accent-700 px-4 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-800"
          >
            <Plus className="size-4" /> Add {config.singular}
          </button>
        </div>

        {/* Search + filter */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${config.title.toLowerCase()}…`}
              className="w-full rounded-md border border-line-200 bg-surface-0 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
            />
          </div>
          <div className="flex gap-1 rounded-md border border-line-200 bg-surface-0 p-0.5">
            {[
              { v: "", label: "All" },
              { v: "true", label: "Active" },
              { v: "false", label: "Inactive" },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setActiveFilter(f.v)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors duration-fast ${
                  activeFilter === f.v
                    ? "bg-accent-700 text-surface-0"
                    : "text-ink-500 hover:bg-surface-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-raised">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-400">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-ink-700">No records yet</p>
              <p className="mt-1 text-xs text-ink-400">
                Add your first {config.singular.toLowerCase()} to get started.
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line-200 bg-surface-100/60">
                  {config.listColumns.map((c) => (
                    <th key={c.key} className="px-4 py-2.5 text-xs font-semibold text-ink-500">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-ink-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-200">
                {filtered.map((row) => (
                  <tr
                    key={str(row.id)}
                    className={`transition-colors duration-fast hover:bg-surface-100/50 ${
                      config.isActiveOf(row) ? "" : "opacity-60"
                    }`}
                  >
                    {config.listColumns.map((c) => (
                      <td key={c.key} className="px-4 py-2.5">
                        {c.key === "name" ? (
                          <button
                            onClick={() => openEdit(row)}
                            className="group inline-flex items-center gap-1 text-sm font-medium text-ink-950 hover:text-accent-700"
                          >
                            {str(row.name)}
                            <ChevronRight className="size-3.5 text-ink-300 transition-transform duration-fast group-hover:translate-x-0.5 group-hover:text-accent-500" />
                          </button>
                        ) : (
                          renderCell(row, c.key, c.kind)
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleStatus(row)}
                          className="text-xs font-medium text-accent-600 transition-colors duration-fast hover:text-accent-700"
                        >
                          {config.isActiveOf(row) ? "Disable" : "Enable"}
                        </button>
                        {config.api.remove && (
                          <button
                            onClick={() => void remove(row)}
                            className="text-xs text-ink-400 transition-colors duration-fast hover:text-status-critical"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Editor — Left: identity · Right: options/settings/billing */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm sm:p-6">
          <div className="w-full max-w-4xl rounded-lg border border-line-200 bg-surface-0 shadow-overlay">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line-200 px-5 py-3.5">
              <h3 className="text-base font-bold text-ink-950">
                {editing ? `Edit ${config.singular}` : `Add ${config.singular}`}
              </h3>
              <button
                onClick={() => setEditorOpen(false)}
                className="text-ink-400 transition-colors duration-fast hover:text-ink-600"
              >
                <X className="size-5" />
              </button>
            </div>

            {error && (
              <div className="border-b border-red-100 bg-red-50 px-5 py-2.5 text-xs font-medium text-status-critical">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
              {/* LEFT — identity & details */}
              <div className="border-b border-line-200 p-5 md:border-b-0 md:border-r">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  Who they are
                </p>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  {config.leftFields.map((f) => (
                    <div
                      key={f.key}
                      className={f.half ? "sm:col-span-1" : "sm:col-span-2"}
                    >
                      <label className="mb-1 block text-xs font-medium text-ink-600">
                        {f.label}
                        {f.required && <span className="text-status-critical"> *</span>}
                      </label>
                      {f.key === "code" ? (
                        <div className="flex gap-2">
                          <div className="min-w-0 flex-1">
                            <FieldInput
                              field={f}
                              value={draft[f.key]}
                              error={errors[f.key]}
                              onChange={(v) => set(f.key, v)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void applyCode()}
                            title="Generate code"
                            className="inline-flex items-center gap-1 rounded-md border border-line-200 px-2.5 text-xs font-medium text-accent-700 transition-colors duration-fast hover:bg-accent-50"
                          >
                            <Wand2 className="size-3.5" /> Auto
                          </button>
                        </div>
                      ) : (
                        <FieldInput
                          field={f}
                          value={draft[f.key]}
                          error={errors[f.key]}
                          onChange={(v) => set(f.key, v)}
                        />
                      )}
                      {f.hint && !errors[f.key] && (
                        <p className="mt-1 text-[11px] text-ink-400">{f.hint}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT — options / settings / billing */}
              <div className="p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  How we treat them
                </p>
                <div className="mb-4 flex gap-1 border-b border-line-200">
                  <TabBtn
                    active={rightTab === "options"}
                    onClick={() => setRightTab("options")}
                    label="Options"
                  />
                  <TabBtn
                    active={rightTab === "settings"}
                    onClick={() => setRightTab("settings")}
                    label="Settings"
                  />
                  {config.billing && (
                    <TabBtn
                      active={rightTab === "billing"}
                      onClick={() => setRightTab("billing")}
                      label="Billing"
                    />
                  )}
                </div>

                {rightTab === "options" && (
                  <div className="space-y-2">
                    {config.options.map((o) => (
                      <ToggleRow
                        key={o.key}
                        option={o}
                        value={Boolean(draft[o.key])}
                        onChange={(v) => set(o.key, v)}
                      />
                    ))}
                  </div>
                )}

                {rightTab === "settings" && (
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    {visibleSettings.map((s) => (
                      <div key={s.key} className={s.half ? "sm:col-span-1" : "sm:col-span-2"}>
                        <label className="mb-1 block text-xs font-medium text-ink-600">
                          {s.label}
                        </label>
                        <SettingControl
                          setting={s}
                          value={draft[s.key]}
                          error={errors[s.key]}
                          onChange={(v) => set(s.key, v)}
                        />
                        {s.hint && (
                          <p className="mt-1 text-[11px] text-ink-400">{s.hint}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {rightTab === "billing" && config.billing && (
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    {config.billing.map((s) => (
                      <div key={s.key} className={s.half ? "sm:col-span-1" : "sm:col-span-2"}>
                        <label className="mb-1 block text-xs font-medium text-ink-600">
                          {s.label}
                        </label>
                        <SettingControl
                          setting={s}
                          value={draft[s.key]}
                          error={errors[s.key]}
                          onChange={(v) => set(s.key, v)}
                        />
                        {s.hint && (
                          <p className="mt-1 text-[11px] text-ink-400">{s.hint}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-line-200 px-5 py-3.5">
              <div className="flex gap-2">
                <button
                  onClick={() => setEditorOpen(false)}
                  disabled={saving}
                  className="rounded-md border border-line-200 px-4 py-2 text-sm font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void submit()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-4 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-xs font-semibold transition-colors duration-fast ${
        active
          ? "border-accent-600 text-accent-700"
          : "border-transparent text-ink-400 hover:text-ink-700"
      }`}
    >
      {label}
    </button>
  );
}
