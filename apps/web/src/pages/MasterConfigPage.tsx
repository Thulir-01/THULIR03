import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Wand2,
  X,
} from "lucide-react";
import type {
  MasterConfig,
  MasterField,
  MasterSetting,
  SettingKind,
} from "./masterConfigs";

// ─── Helpers ────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (v == null ? "" : String(v));

function getPath(row: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, row);
}

/** Draft → API body (numbers trimmed, arrays passed through, client → commercial). */
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

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ─── Small controls ─────────────────────────────────────────────────────────

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
    "w-full rounded-md border bg-surface-0 px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 transition-colors duration-fast";
  const cls = `${base} ${
    error
      ? "border-status-critical bg-red-50/40"
      : "border-line-200"
  }`;
  if (field.kind === "select") {
    return (
      <div>
        <select className={cls} value={str(value)} onChange={(e) => onChange(e.target.value)}>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {error && <p className="mt-0.5 text-[10px] text-status-critical">{error}</p>}
      </div>
    );
  }
  if (field.kind === "textarea") {
    return (
      <div>
        <textarea
          className={`${cls} min-h-16 resize-y`}
          value={str(value)}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {error && <p className="mt-0.5 text-[10px] text-status-critical">{error}</p>}
      </div>
    );
  }
  if (field.kind === "color") {
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            className="size-7 shrink-0 cursor-pointer rounded-md border border-line-200 bg-surface-0 p-0.5"
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
        {error && <p className="mt-0.5 text-[10px] text-status-critical">{error}</p>}
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
      {error && <p className="mt-0.5 text-[10px] text-status-critical">{error}</p>}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
  title,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  title?: string;
}) {
  return (
    <label
      title={title}
      className="flex cursor-pointer select-none items-center gap-2 py-0.5"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 shrink-0 accent-accent-700"
      />
      <span className="text-[13px] leading-snug text-ink-800">{label}</span>
    </label>
  );
}

/** Left-panel row: right-aligned label beside a control, sized by field.width. */
function FieldLabelRow({
  field,
  value,
  error,
  onChange,
  codeAction,
}: {
  field: MasterField;
  value: unknown;
  error?: string;
  onChange: (v: string) => void;
  codeAction?: () => void;
}) {
  const widthCls =
    field.width === "third"
      ? "col-span-12 sm:col-span-4"
      : field.width === "half" || field.half
        ? "col-span-12 sm:col-span-6"
        : "col-span-12";
  return (
    <div className={widthCls}>
      <div className="flex items-center gap-2">
        <label className="w-28 shrink-0 text-right text-[12px] font-medium text-ink-600">
          {field.label}
          {field.required && <span className="text-status-critical"> *</span>}
        </label>
        <div className="min-w-0 flex-1">
          {field.key === "code" && codeAction ? (
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <FieldInput field={field} value={value} error={error} onChange={onChange} />
              </div>
              <button
                type="button"
                onClick={codeAction}
                title="Generate code"
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-line-200 px-2 text-[11px] font-medium text-accent-700 transition-colors duration-fast hover:bg-accent-50"
              >
                <Wand2 className="size-3.5" /> Auto
              </button>
            </div>
          ) : (
            <FieldInput field={field} value={value} error={error} onChange={onChange} />
          )}
        </div>
      </div>
      {field.hint && !error && (
        <p className="mt-0.5 pl-28 text-[10px] leading-snug text-ink-400">{field.hint}</p>
      )}
    </div>
  );
}

function GroupCard({
  title,
  fields,
  draft,
  errors,
  onChange,
  codeAction,
}: {
  title: string;
  fields: MasterField[];
  draft: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: (key: string, v: unknown) => void;
  codeAction?: () => void;
}) {
  return (
    <fieldset className="rounded-md border border-line-200 bg-surface-0 p-3">
      <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
        {title}
      </legend>
      <div className="grid grid-cols-12 gap-x-3 gap-y-2">
        {fields.map((f) => (
          <FieldLabelRow
            key={f.key}
            field={f}
            value={draft[f.key]}
            error={errors[f.key]}
            onChange={(v) => onChange(f.key, v)}
            codeAction={f.key === "code" ? codeAction : undefined}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Right-panel single setting row (label-left). */
function SettingRow({
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
    "w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 transition-colors duration-fast";
  const cls = `${base} ${error ? "border-status-critical" : "border-line-200"}`;

  if (kind === "toggle") {
    return <CheckRow label={setting.label} checked={Boolean(value)} onChange={onChange} />;
  }
  if (kind === "radio") {
    return (
      <fieldset className="rounded-md border border-line-200 bg-surface-0 p-3">
        <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
          {setting.label}
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {(setting.options ?? []).map((o) => (
            <label key={o} className="flex cursor-pointer select-none items-center gap-2">
              <input
                type="radio"
                name={`${setting.key}-group`}
                checked={str(value) === o}
                onChange={() => onChange(o)}
                className="size-3.5 accent-accent-700"
              />
              <span className="text-[13px] text-ink-800">{o}</span>
            </label>
          ))}
        </div>
        {setting.hint && <p className="mt-1.5 text-[11px] text-ink-400">{setting.hint}</p>}
      </fieldset>
    );
  }
  if (kind === "multicheck") {
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
          {setting.label}
        </span>
        {(setting.options ?? []).map((o) => {
          const arr = (value as string[]) ?? [];
          return (
            <CheckRow
              key={o}
              label={o}
              checked={arr.includes(o)}
              onChange={(on) =>
                onChange(on ? [...arr, o] : arr.filter((x) => x !== o))
              }
            />
          );
        })}
      </div>
    );
  }
  if (kind === "textarea") {
    return (
      <div>
        <label className="mb-1 block text-[12px] font-medium text-ink-600">{setting.label}</label>
        <textarea
          className={`${cls} min-h-16 resize-y`}
          value={str(value)}
          placeholder={setting.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {setting.hint && <p className="mt-0.5 text-[11px] text-ink-400">{setting.hint}</p>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <label className="w-32 shrink-0 text-right text-[12px] font-medium text-ink-600">
        {setting.label}
      </label>
      <div className="min-w-0 flex-1">
        <input
          type={kind === "number" ? "number" : kind === "date" ? "date" : "text"}
          className={cls}
          value={kind === "date" && value ? String(value).slice(0, 10) : str(value)}
          placeholder={setting.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {setting.hint && <p className="mt-0.5 text-[11px] text-ink-400">{setting.hint}</p>}
      </div>
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
      className={`rounded-t-md border border-b-0 px-4 py-1.5 text-[12px] font-bold tracking-wide transition-colors duration-fast ${
        active
          ? "border-line-200 bg-surface-100 text-accent-800"
          : "border-transparent text-ink-400 hover:text-ink-700"
      }`}
    >
      {label}
    </button>
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
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [rightTab, setRightTab] = useState<"options" | "settings" | "billing">("options");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await config.api.list();
      setRows(data);
    } catch {
      setError("Could not load records.");
    } finally {
      setLoading(false);
    }
  }, [config]);

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

  const set = (key: string, value: unknown) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const n = { ...e };
      delete n[key];
      return n;
    });
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setErrors({});
    setError("");
    setRightTab("options");
    setDraft(config.rowToDraft(row));
    setQuery(str(row.name));
    setComboboxOpen(false);
  };

  const openAdd = async () => {
    setEditing(null);
    setErrors({});
    setError("");
    setRightTab("options");
    const defaults = { ...config.newDefaults };
    if (config.api.generateCode) {
      try {
        defaults.code = await config.api.generateCode();
      } catch {
        /* best-effort */
      }
    }
    setDraft(defaults);
    setQuery("");
    setComboboxOpen(false);
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
      openEdit(saved);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Failed to save. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setEditing(null);
    setDraft({});
    setErrors({});
    setError("");
    setQuery("");
  };

  const toggleStatus = async () => {
    if (!editing) return;
    const next = !config.isActiveOf(editing);
    try {
      const updated = await config.api.setStatus(str(editing.id), next);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      openEdit(updated);
    } catch {
      setError("Failed to update status.");
    }
  };

  const remove = async () => {
    if (!editing || !config.api.remove) return;
    if (!confirm(`Deactivate "${str(editing.name)}"? History and audit trail are preserved.`))
      return;
    try {
      const updated = await config.api.remove(str(editing.id));
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      openEdit(updated);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Failed to deactivate.";
      setError(msg);
    }
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [str(r.code), str(r.name), str(r.city), str(r.mobile), str(r.modelName)]
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const groups = useMemo(() => {
    const map = new Map<string, MasterField[]>();
    for (const f of config.leftFields) {
      const g = f.group ?? "Basic Details";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return [...map.entries()];
  }, [config]);

  const visibleSettings = (config.settings as MasterSetting[]).filter((s) =>
    s.dependsOn ? Boolean(draft[s.dependsOn.field]) === s.dependsOn.value : true,
  );

  const renderCell = (row: Record<string, unknown>, key: string, kind?: string) => {
    if (kind === "pill") {
      const on = config.isActiveOf(row);
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
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
          <span className="size-3 rounded-full border border-line-200" style={{ backgroundColor: v }} />
          <span className="font-mono text-[11px] text-ink-500">{v}</span>
        </span>
      ) : (
        <span className="text-[11px] text-ink-300">—</span>
      );
    }
    const v = str(getPath(row, key));
    return v ? (
      <span className="text-[12px] text-ink-700">{v}</span>
    ) : (
      <span className="text-[12px] text-ink-300">—</span>
    );
  };

  const active = editing ? config.isActiveOf(editing) : null;

  return (
    <div className="flex h-full flex-col bg-surface-100">
      {/* ── Top bar: title · select combobox · actions ── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line-200 bg-surface-0 px-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-700">
          <config.icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-bold leading-tight text-ink-950">
            {config.singular} Master
          </h1>
          <p className="truncate text-[11px] leading-tight text-ink-400">
            {config.description}
          </p>
        </div>

        {/* Select {singular} */}
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
              if (e.key === "Enter" && matches.length > 0) openEdit(matches[0]);
              if (e.key === "Escape") setComboboxOpen(false);
            }}
            placeholder={`Select ${config.singular}…`}
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
                  matches.map((r) => {
                    const isSel = editing && r.id === editing.id;
                    return (
                      <button
                        key={str(r.id)}
                        onClick={() => openEdit(r)}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-fast hover:bg-surface-100 ${
                          isSel ? "bg-accent-50" : ""
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink-900">
                            {str(r.name) || "—"}
                          </span>
                          <span className="block truncate text-[11px] text-ink-400">
                            {[str(r.code), str(r.city)].filter(Boolean).join(" · ") || config.codeHint}
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
                active ? "bg-status-normal/10 text-status-normal" : "bg-gray-100 text-ink-500"
              }`}
            >
              <span className={`size-1.5 rounded-full ${active ? "bg-status-normal" : "bg-ink-300"}`} />
              {active ? "Active" : "Inactive"}
            </span>
          )}
          <button
            onClick={() => void openAdd()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-1.5 text-[13px] font-semibold text-ink-700 transition-colors duration-fast hover:bg-surface-100"
          >
            <Plus className="size-4" /> New {config.singular}
          </button>
          <button
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-1.5 text-[13px] font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Saving…" : "Save"}
          </button>
          {(editing || Object.keys(draft).length > 0) && (
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
          <button onClick={() => setError("")} className="text-status-critical/60 hover:text-status-critical">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* ── Body: left form · right config ── */}
      <div className="flex min-h-0 flex-1">
        {/* LEFT — data entry (grouped cards) / record picker */}
        <div className="flex w-[46%] min-w-0 shrink-0 flex-col border-r border-line-200 bg-surface-0">
          {editing ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line-200 px-4 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[11px] font-bold uppercase tracking-wide text-ink-500">
                    {str(draft.code) || "New"} — {str(draft.name) || `New ${config.singular}`}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => void toggleStatus()}
                    className="text-[11px] font-semibold text-accent-600 transition-colors duration-fast hover:text-accent-800"
                  >
                    {active ? "Disable" : "Enable"}
                  </button>
                  {config.api.remove && (
                    <button
                      onClick={() => void remove()}
                      className="text-[11px] text-ink-400 transition-colors duration-fast hover:text-status-critical"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4">
                {groups.map(([title, fields]) => (
                  <GroupCard
                    key={title}
                    title={title}
                    fields={fields}
                    draft={draft}
                    errors={errors}
                    onChange={set}
                    codeAction={applyCode}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between border-b border-line-200 px-4 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500">
                  {query ? `Matches (${matches.length})` : `All ${config.title}`}
                </span>
                <span className="text-[11px] text-ink-400">
                  {rows.length} total
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-ink-400">
                    <Loader2 className="size-4 animate-spin" /> Loading…
                  </div>
                ) : matches.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <p className="text-[13px] font-medium text-ink-700">
                      {rows.length === 0 ? "No records yet" : "No matches"}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-400">
                      {rows.length === 0
                        ? `Add your first ${config.singular.toLowerCase()} with “New”.`
                        : "Try a different search term."}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-surface-100/90 backdrop-blur-sm">
                      <tr className="border-b border-line-200">
                        {config.listColumns.map((c) => (
                          <th key={c.key} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-ink-400">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-200">
                      {matches.map((row) => (
                        <tr
                          key={str(row.id)}
                          onClick={() => openEdit(row)}
                          className={`cursor-pointer transition-colors duration-fast hover:bg-surface-100/60 ${
                            config.isActiveOf(row) ? "" : "opacity-55"
                          }`}
                        >
                          {config.listColumns.map((c) => (
                            <td key={c.key} className="px-4 py-2">
                              {c.key === "name" ? (
                                <span className="group inline-flex items-center gap-1 text-[13px] font-medium text-ink-950">
                                  {str(row.name)}
                                  <ChevronRight className="size-3 text-ink-300 transition-transform duration-fast group-hover:translate-x-0.5" />
                                </span>
                              ) : (
                                renderCell(row, c.key, c.kind)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — options / settings / source tabs */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-end gap-1 border-b border-line-200 bg-surface-0 px-4 pt-2">
            <TabBtn active={rightTab === "options"} onClick={() => setRightTab("options")} label="OPTIONS" />
            <TabBtn active={rightTab === "settings"} onClick={() => setRightTab("settings")} label="SETTINGS" />
            {config.billing && (
              <TabBtn active={rightTab === "billing"} onClick={() => setRightTab("billing")} label="SOURCE DETAILS" />
            )}
            {!editing && !Object.keys(draft).length && (
              <span className="ml-auto pb-1.5 text-[11px] text-ink-300">
                Select a {config.singular.toLowerCase()} to configure
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-surface-100 p-4">
            {rightTab === "options" && (
              <fieldset className="rounded-md border border-line-200 bg-surface-0 p-3.5">
                <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-700">
                  Options
                </legend>
                <div className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
                  {config.options.map((o) => (
                    <CheckRow
                      key={o.key}
                      label={o.label}
                      title={o.desc}
                      checked={Boolean(draft[o.key])}
                      onChange={(v) => set(o.key, v)}
                    />
                  ))}
                </div>
              </fieldset>
            )}

            {rightTab === "settings" && (
              <div className="space-y-4">
                {visibleSettings.map((s) => (
                  <SettingRow
                    key={s.key}
                    setting={s}
                    value={draft[s.key]}
                    error={errors[s.key]}
                    onChange={(v) => set(s.key, v)}
                  />
                ))}
                {visibleSettings.length === 0 && (
                  <p className="py-8 text-center text-[12px] text-ink-400">
                    No settings for this record.
                  </p>
                )}
              </div>
            )}

            {rightTab === "billing" && config.billing && (
              <div className="space-y-4">
                <fieldset className="rounded-md border border-line-200 bg-surface-0 p-3.5">
                  <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-700">
                    Billing
                  </legend>
                  <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                    {config.billing
                      .filter((s) => s.kind === "toggle")
                      .map((s) => (
                        <CheckRow
                          key={s.key}
                          label={s.label}
                          checked={Boolean(draft[s.key])}
                          onChange={(v) => set(s.key, v)}
                        />
                      ))}
                    {config.billing
                      .filter((s) => s.kind === "number")
                      .map((s) => (
                        <SettingRow
                          key={s.key}
                          setting={s}
                          value={draft[s.key]}
                          error={errors[s.key]}
                          onChange={(v) => set(s.key, v)}
                        />
                      ))}
                  </div>
                </fieldset>

                {config.billing.some((s) => s.key === "webPassword") && (
                  <fieldset className="rounded-md border border-line-200 bg-surface-0 p-3.5">
                    <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-700">
                      Online Web Password
                    </legend>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={str(draft.webPassword)}
                        onChange={(e) => set("webPassword", e.target.value)}
                        placeholder="Password"
                        className="w-52 rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-[13px] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                      />
                      <button
                        onClick={() => set("webPassword", randomPassword())}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line-200 px-2.5 py-1.5 text-[12px] font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100"
                      >
                        <RefreshCw className="size-3.5" /> Generate
                      </button>
                      <button
                        onClick={() => set("webPassword", "")}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line-200 px-2.5 py-1.5 text-[12px] font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100"
                      >
                        <RotateCcw className="size-3.5" /> Reset
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-400">
                      Generate / reset — never shown again after save.
                    </p>
                  </fieldset>
                )}

                {config.billing
                  .filter((s) => s.kind === "multicheck")
                  .map((s) => (
                    <fieldset key={s.key} className="rounded-md border border-line-200 bg-surface-0 p-3.5">
                      <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-700">
                        {s.label}
                      </legend>
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        {(s.options ?? []).map((o) => {
                          const arr = (draft[s.key] as string[]) ?? [];
                          return (
                            <CheckRow
                              key={o}
                              label={o}
                              checked={arr.includes(o)}
                              onChange={(on) =>
                                set(s.key, on ? [...arr, o] : arr.filter((x) => x !== o))
                              }
                            />
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
