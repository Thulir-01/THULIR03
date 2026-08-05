import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  RefreshCw,
  Download,
  FileJson,
  Printer,
  ShieldCheck,
  Activity,
  Plus,
  PenLine,
  Trash2,
  X,
  ChevronDown,
  User,
  Globe,
  MonitorSmartphone,
  Fingerprint,
  Copy,
  Check,
  AlertTriangle,
  Info,
  Clock,
  Eye,
} from "lucide-react";
import { getAuditLogs, type AuditLogEntry } from "../lib/api-client";
import PageHeader from "../components/ui/PageHeader";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";

// ─── Severity derivation ────────────────────────────────────────────────
// The AuditLog row has no severity column — it is derived here from the
// action + entity so destructive/sensitive writes surface in amber/red.
const SENSITIVE_ENTITIES = new Set([
  "users",
  "roles",
  "permissions",
  "settings",
  "staff",
  "pricing",
  "inventory",
  "masters",
]);

type Severity = "critical" | "warning" | "info";

function severityOf(log: AuditLogEntry): Severity {
  if (log.action === "DELETE") return "critical";
  if ((log.action === "PATCH" || log.action === "PUT") && SENSITIVE_ENTITIES.has(log.entity)) {
    return "warning";
  }
  return "info";
}

const SEVERITY_META: Record<
  Severity,
  { label: string; chip: string; row: string; accent: string }
> = {
  critical: {
    label: "Critical",
    chip: "bg-red-50 text-red-700 border-red-200",
    row: "bg-red-50/45 hover:bg-red-50",
    accent: "border-l-status-critical",
  },
  warning: {
    label: "Warning",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    row: "bg-amber-50/35 hover:bg-amber-50",
    accent: "border-l-amber-400",
  },
  info: {
    label: "Info",
    chip: "bg-slate-50 text-slate-600 border-line-200",
    row: "hover:bg-surface-100",
    accent: "border-l-transparent",
  },
};

const ACTION_BADGES: Record<string, string> = {
  POST: "bg-green-50 text-green-700 border-green-200",
  PATCH: "bg-blue-50 text-blue-700 border-blue-200",
  PUT: "bg-indigo-50 text-indigo-700 border-indigo-200",
  DELETE: "bg-red-50 text-red-700 border-red-200",
};

function actionIcon(action: string) {
  if (action === "DELETE") return <Trash2 className="size-3.5" />;
  if (action === "POST") return <Plus className="size-3.5" />;
  return <PenLine className="size-3.5" />;
}

const ACTION_LABELS: Record<string, string> = {
  POST: "Created",
  PATCH: "Updated",
  PUT: "Updated",
  DELETE: "Deleted",
};

const ROLE_CHIP: Record<string, string> = {
  admin: "bg-accent-700/10 text-accent-700 border-accent-200",
  pathologist: "bg-violet-50 text-violet-700 border-violet-200",
  technician: "bg-sky-50 text-sky-700 border-sky-200",
  manager: "bg-amber-50 text-amber-700 border-amber-200",
  receptionist: "bg-teal-50 text-teal-700 border-teal-200",
};

function roleChipClass(role: string | null) {
  if (!role) return "bg-surface-100 text-ink-400 border-line-200";
  const slug = role.toLowerCase();
  for (const key of Object.keys(ROLE_CHIP)) {
    if (slug.includes(key)) return ROLE_CHIP[key];
  }
  return "bg-surface-100 text-ink-600 border-line-200";
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

function fmtTimeShort(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Keys whose value changed between before/after, rendered as `k: a → b`. */
function diffSummary(before: unknown, after: unknown): string[] {
  if (!before && !after) return [];
  if (!before) return ["record created"];
  if (!after) return ["record deleted"];
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const changes: string[] = [];
  for (const k of keys) {
    const bv = b[k];
    const av = a[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      const fmt = (v: unknown) =>
        v === undefined || v === null
          ? "—"
          : typeof v === "object"
            ? JSON.stringify(v)
            : String(v);
      changes.push(`${k}: ${fmt(bv)} → ${fmt(av)}`);
    }
  }
  return changes;
}

function shortId(id: string | null) {
  if (!id) return null;
  return id.length > 13 ? `${id.slice(0, 13)}…` : id;
}

function deviceOf(ua: string | null): string {
  if (!ua) return "—";
  if (/ipad/i.test(ua)) return "Tablet (iPad)";
  if (/iphone/i.test(ua)) return "Mobile (iPhone)";
  if (/android/i.test(ua)) return "Mobile (Android)";
  if (/mobile/i.test(ua)) return "Mobile device";
  if (/edg/i.test(ua)) return "Desktop (Edge)";
  if (/firefox/i.test(ua)) return "Desktop (Firefox)";
  if (/safari/i.test(ua)) return "Desktop (Safari)";
  if (/chrome/i.test(ua)) return "Desktop (Chrome)";
  return "Desktop";
}

function csvEscape(v: string | number | null | undefined) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ─── Filters ─────────────────────────────────────────────────────────────

interface Filters {
  user: string;
  action: string;
  entity: string;
  severity: string;
  objectId: string;
  preset: string; // "" | "24h" | "7d" | "30d" | "custom"
  from: string; // yyyy-mm-dd
  to: string;
}

const EMPTY_FILTERS: Filters = {
  user: "",
  action: "",
  entity: "",
  severity: "",
  objectId: "",
  preset: "",
  from: "",
  to: "",
};

const PRESET_LABELS: Record<string, string> = {
  "": "Any time",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  custom: "Custom range",
};

function presetRange(preset: string, from: string, to: string) {
  const now = Date.now();
  if (preset === "24h") return { from: new Date(now - 24 * 3600e3).toISOString(), to: undefined };
  if (preset === "7d") return { from: new Date(now - 7 * 24 * 3600e3).toISOString(), to: undefined };
  if (preset === "30d") return { from: new Date(now - 30 * 24 * 3600e3).toISOString(), to: undefined };
  if (preset === "custom") {
    return {
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    };
  }
  return { from: undefined, to: undefined };
}

// ─── Export ──────────────────────────────────────────────────────────────

function exportRows(rows: AuditLogEntry[]) {
  const header = [
    "Timestamp",
    "User",
    "Role",
    "Action",
    "Entity",
    "Entity ID",
    "Object",
    "IP Address",
    "Device",
    "User Agent",
    "Change Details",
  ];
  const lines = rows.map((l) =>
    [
      fmtTime(l.createdAt),
      l.actorName ?? "system",
      l.actorRole ?? "",
      `${l.action} ${ACTION_LABELS[l.action] ?? ""}`.trim(),
      l.entity,
      l.entityId ?? "",
      l.entityId ?? "",
      l.ipAddress ?? "",
      deviceOf(l.userAgent),
      l.userAgent ?? "",
      diffSummary(l.before, l.after).join("; "),
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.map(csvEscape).join(","), ...lines].join("\n");
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportCSV(rows: AuditLogEntry[]) {
  downloadBlob(
    exportRows(rows),
    "text/csv",
    `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

function exportXML(rows: AuditLogEntry[]) {
  const esc = (s: string | null | undefined) =>
    (s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const body = rows
    .map(
      (l) => `  <entry id="${esc(l.id)}" createdAt="${esc(l.createdAt)}">
    <actor>${esc(l.actorName ?? "system")}</actor>
    <actorRole>${esc(l.actorRole ?? "")}</actorRole>
    <action>${esc(l.action)}</action>
    <entity>${esc(l.entity)}</entity>
    <entityId>${esc(l.entityId ?? "")}</entityId>
    <ipAddress>${esc(l.ipAddress ?? "")}</ipAddress>
    <userAgent>${esc(l.userAgent ?? "")}</userAgent>
  </entry>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<auditLog exportDate="${esc(new Date().toISOString())}" count="${rows.length}">\n${body}\n</auditLog>\n`;
  downloadBlob(xml, "application/xml", `audit-log-${new Date().toISOString().slice(0, 10)}.xml`);
}

function exportPDF(rows: AuditLogEntry[]) {
  const esc = (s: string | null | undefined) =>
    (s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const body = rows
    .map(
      (l) => `<tr>
        <td>${esc(fmtTime(l.createdAt))}</td>
        <td>${esc(l.actorName ?? "system")}</td>
        <td>${esc(l.actorRole ?? "")}</td>
        <td>${esc(l.action)} ${esc(l.entity)}</td>
        <td>${esc(shortId(l.entityId) ?? "")}</td>
        <td>${esc(l.ipAddress ?? "")}</td>
      </tr>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Audit Log Export</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#15181a;padding:24px;}
  h1{font-size:18px;margin:0 0 4px;} p{color:#5c6570;font-size:11px;margin:0 0 16px;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th{text-align:left;background:#f2f5f6;padding:6px 8px;border:1px solid #d8e0e2;text-transform:uppercase;font-size:10px;letter-spacing:.03em;}
  td{padding:6px 8px;border:1px solid #e3e9eb;}
  tr:nth-child(even) td{background:#fafbfc;}
</style></head><body>
<h1>Audit Log Export</h1>
<p>Exported ${new Date().toLocaleString("en-IN")} · ${rows.length} entries</p>
<table><thead><tr><th>Timestamp</th><th>User</th><th>Role</th><th>Action</th><th>Object</th><th>IP</th></tr></thead><tbody>${body}</tbody></table>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`;
  const w = window.open("", "_blank", "width=960,height=720");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// ─── JSON block (slide-over) ─────────────────────────────────────────────

function JsonBlock({ label, value, tone }: { label: string; value: unknown; tone: "before" | "after" }) {
  let text = "";
  try {
    text = value === null || value === undefined ? "" : JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  if (text.length > 8000) text = `${text.slice(0, 8000)}\n… (truncated)`;
  if (!text) return null;
  return (
    <div>
      <p className={`field-label mb-1 ${tone === "after" ? "text-accent-700" : ""}`}>{label}</p>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md border border-line-200 bg-surface-100 p-2.5 font-mono text-[11px] leading-relaxed text-ink-600">
        {text}
      </pre>
    </div>
  );
}

// ─── Slide-over detail panel ─────────────────────────────────────────────

function DetailPanel({
  log,
  onClose,
}: {
  log: AuditLogEntry;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const sev = severityOf(log);
  const meta = SEVERITY_META[sev];

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          { ...log, before: log.before ?? undefined, after: log.after ?? undefined },
          null,
          2,
        ),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close detail panel"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/30 backdrop-blur-[2px]"
      />
      <aside className="relative flex h-full w-full max-w-[560px] flex-col overflow-hidden border-l border-line-200 bg-surface-0 shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line-200 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ACTION_BADGES[log.action] ?? "bg-surface-100 text-ink-600 border-line-200"}`}
              >
                {actionIcon(log.action)} {log.action}
              </span>
              <span className="font-medium capitalize text-ink-950">{log.entity}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}>
                {meta.label}
              </span>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-400">
              <Clock className="size-3.5" />
              {fmtTime(log.createdAt)} · Entry {shortId(log.id)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-400 transition-colors duration-fast hover:bg-surface-100 hover:text-ink-950"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Actor */}
          <section className="rounded-md border border-line-200 p-3.5">
            <p className="field-label mb-2 flex items-center gap-1.5">
              <User className="size-3.5 text-ink-400" /> Actor
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink-950">
                {log.actorName ?? "System"}
              </span>
              {log.actorRole && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleChipClass(log.actorRole)}`}
                >
                  {log.actorRole}
                </span>
              )}
            </div>
            {log.actorId && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-400">
                <Fingerprint className="size-3.5" />
                Actor ID <span className="data-mono">{log.actorId}</span>
              </p>
            )}
          </section>

          {/* Target */}
          <section className="mt-3 rounded-md border border-line-200 p-3.5">
            <p className="field-label mb-2">Target Object</p>
            <p className="text-sm text-ink-950">
              <span className="capitalize">{log.entity}</span>
              {log.entityId ? (
                <span className="ml-2 rounded border border-line-200 bg-surface-100 px-1.5 py-0.5 data-mono text-[11px] text-ink-600">
                  {log.entityId}
                </span>
              ) : null}
            </p>
          </section>

          {/* Origin */}
          <section className="mt-3 rounded-md border border-line-200 p-3.5">
            <p className="field-label mb-2">Origin & Device</p>
            <div className="grid grid-cols-1 gap-2 text-xs text-ink-600 sm:grid-cols-2">
              <div className="flex items-center gap-1.5">
                <Globe className="size-3.5 text-ink-400" />
                {log.ipAddress ?? "—"}
              </div>
              <div className="flex items-center gap-1.5">
                <MonitorSmartphone className="size-3.5 text-ink-400" />
                {deviceOf(log.userAgent)}
              </div>
            </div>
            {log.userAgent && (
              <p className="mt-2 break-all rounded bg-surface-100 px-2 py-1.5 font-mono text-[10px] text-ink-400">
                {log.userAgent}
              </p>
            )}
            <p className="mt-2.5 flex items-center gap-1.5 border-t border-line-200 pt-2.5 text-[11px] text-ink-400">
              <Fingerprint className="size-3.5" />
              Session link: actor <span className="data-mono">{log.actorId ?? "—"}</span>
              <span className="mx-1 text-line-300">·</span>
              tenant <span className="data-mono">{shortId(log.tenantId) ?? "—"}</span>
            </p>
          </section>

          {/* Before / After */}
          <section className="mt-3">
            <p className="field-label mb-2">Change Details</p>
            {diffSummary(log.before, log.after).length > 0 ? (
              <div className="mb-2.5 space-y-1 rounded-md border border-line-200 bg-surface-100 p-3">
                {diffSummary(log.before, log.after).slice(0, 6).map((c) => (
                  <p key={c} className="font-mono text-[11px] leading-relaxed text-ink-600">
                    {c}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              <JsonBlock label="Before" value={log.before} tone="before" />
              <JsonBlock label="After" value={log.after} tone="after" />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-2 border-t border-line-200 px-5 py-3">
          <button
            onClick={copyJson}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100"
          >
            {copied ? <Check className="size-3.5 text-status-normal" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy JSON"}
          </button>
          <button
            onClick={() => exportCSV([log])}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-1.5 text-xs font-medium text-surface-0 transition-colors duration-fast hover:bg-accent-500"
          >
            <Download className="size-3.5" /> Export entry (CSV)
          </button>
        </div>
      </aside>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

const KNOWN_ENTITIES = [
  "users",
  "patients",
  "referrers",
  "parties",
  "orders",
  "samples",
  "masters",
  "pricing",
  "inventory",
  "settings",
  "staff",
  "reports",
  "portals",
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const entities = useMemo(
    () => [...new Set([...KNOWN_ENTITIES, ...logs.map((l) => l.entity)])].sort(),
    [logs],
  );

  const fetchLogs = useCallback(async (f: Filters) => {
    setLoading(true);
    setError("");
    try {
      const range = presetRange(f.preset, f.from, f.to);
      const data = await getAuditLogs({
        action: f.action || undefined,
        entity: f.entity || undefined,
        from: range.from,
        to: range.to,
        limit: 200,
      });
      setLogs(data);
    } catch {
      setLogs([]);
      setError("Failed to load the audit trail. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs(applied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  const applyFilters = () => setApplied({ ...draft });
  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  };

  // Client-side filtering: quick search + user + severity + object ID run
  // instantly over the server-filtered page.
  const visibleLogs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return logs.filter((l) => {
      if (draft.user.trim()) {
        const u = draft.user.trim().toLowerCase();
        if (!l.actorName?.toLowerCase().includes(u) && !l.actorId?.toLowerCase().includes(u)) {
          return false;
        }
      }
      if (draft.severity && severityOf(l) !== draft.severity) return false;
      if (draft.objectId.trim() && !l.entityId?.toLowerCase().includes(draft.objectId.trim().toLowerCase())) {
        return false;
      }
      if (needle) {
        const hay = [
          l.action,
          l.entity,
          l.entityId ?? "",
          l.actorName ?? "",
          l.ipAddress ?? "",
          JSON.stringify(l.before ?? ""),
          JSON.stringify(l.after ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [logs, q, draft]);

  const stats = useMemo(() => {
    const creates = visibleLogs.filter((l) => l.action === "POST").length;
    const updates = visibleLogs.filter((l) => l.action === "PATCH" || l.action === "PUT").length;
    const deletes = visibleLogs.filter((l) => l.action === "DELETE").length;
    const criticals = visibleLogs.filter((l) => severityOf(l) === "critical").length;
    return { total: visibleLogs.length, creates, updates, deletes, criticals };
  }, [visibleLogs]);

  const setDraftKey = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const filterActive =
    applied.action || applied.entity || applied.preset || applied.from || applied.to;

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-surface-100 p-3">
      <PageHeader
        title="Audit Log"
        subtitle="Immutable, append-only record of every write — for ISO 15189, CAP & CLIA audits"
      />

      {/* TOOLBAR: quick search + filters + export */}
      <div className="flex shrink-0 flex-col gap-2.5 rounded-md border border-line-200 bg-surface-0 p-3 shadow-raised">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='Quick search — e.g. "orders", "Westgard", or an object ID…'
              className="w-full rounded-md border border-line-200 bg-surface-0 py-2 pl-8 pr-3 text-xs text-ink-950 placeholder:text-ink-400 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-accent-100"
            />
          </div>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors duration-fast ${
              showFilters || filterActive
                ? "border-accent-200 bg-accent-700/10 text-accent-700"
                : "border-line-200 bg-surface-0 text-ink-600 hover:bg-surface-100"
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {filterActive && <span className="size-1.5 rounded-full bg-accent-700" />}
          </button>
          <button
            onClick={() => void fetchLogs(applied)}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-2 text-xs font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100"
            title="Refresh"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </button>
          <span className="mx-1 hidden h-6 w-px bg-line-200 sm:block" />
          <button
            onClick={() => exportCSV(visibleLogs)}
            disabled={visibleLogs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-2 text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="size-3.5" /> CSV
          </button>
          <button
            onClick={() => exportXML(visibleLogs)}
            disabled={visibleLogs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-2 text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileJson className="size-3.5" /> XML
          </button>
          <button
            onClick={() => exportPDF(visibleLogs)}
            disabled={visibleLogs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3 py-2 text-xs font-medium text-ink-700 transition-colors duration-fast hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Printer className="size-3.5" /> PDF
          </button>
        </div>

        {/* COLLAPSIBLE ADVANCED FILTERS */}
        {showFilters && (
          <div className="grid grid-cols-1 gap-2.5 border-t border-line-200 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="field-label mb-1 block">User</span>
              <input
                value={draft.user}
                onChange={(e) => setDraftKey("user", e.target.value)}
                placeholder="Name or actor ID"
                className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-accent-100"
              />
            </label>
            <label className="block">
              <span className="field-label mb-1 block">Action type</span>
              <select
                value={draft.action}
                onChange={(e) => setDraftKey("action", e.target.value)}
                className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 focus:outline-none focus:ring-2 focus:ring-accent-100"
              >
                <option value="">All actions</option>
                <option value="POST">POST — created</option>
                <option value="PATCH">PATCH — updated</option>
                <option value="PUT">PUT — updated</option>
                <option value="DELETE">DELETE — removed</option>
              </select>
            </label>
            <label className="block">
              <span className="field-label mb-1 block">Object (entity)</span>
              <select
                value={draft.entity}
                onChange={(e) => setDraftKey("entity", e.target.value)}
                className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 focus:outline-none focus:ring-2 focus:ring-accent-100"
              >
                <option value="">All entities</option>
                {entities.map((entity) => (
                  <option key={entity} value={entity}>
                    {entity}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label mb-1 block">Severity</span>
              <select
                value={draft.severity}
                onChange={(e) => setDraftKey("severity", e.target.value)}
                className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 focus:outline-none focus:ring-2 focus:ring-accent-100"
              >
                <option value="">All severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </label>
            <label className="block">
              <span className="field-label mb-1 block">Object ID (exact/partial)</span>
              <input
                value={draft.objectId}
                onChange={(e) => setDraftKey("objectId", e.target.value)}
                placeholder="e.g. order UUID, lot no…"
                className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-accent-100"
              />
            </label>
            <label className="block">
              <span className="field-label mb-1 block">Date range</span>
              <select
                value={draft.preset}
                onChange={(e) => setDraftKey("preset", e.target.value)}
                className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 focus:outline-none focus:ring-2 focus:ring-accent-100"
              >
                {Object.entries(PRESET_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {draft.preset === "custom" && (
              <>
                <label className="block">
                  <span className="field-label mb-1 block">From</span>
                  <input
                    type="date"
                    value={draft.from}
                    onChange={(e) => setDraftKey("from", e.target.value)}
                    className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 focus:outline-none focus:ring-2 focus:ring-accent-100"
                  />
                </label>
                <label className="block">
                  <span className="field-label mb-1 block">To</span>
                  <input
                    type="date"
                    value={draft.to}
                    onChange={(e) => setDraftKey("to", e.target.value)}
                    className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 focus:outline-none focus:ring-2 focus:ring-accent-100"
                  />
                </label>
              </>
            )}
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <button
                onClick={applyFilters}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-1.5 text-xs font-medium text-surface-0 transition-colors duration-fast hover:bg-accent-500"
              >
                Apply filters
              </button>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-200 bg-surface-0 px-3.5 py-1.5 text-xs font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100"
              >
                Reset
              </button>
              <span className="ml-auto text-[11px] text-ink-400">
                Date & action filters run server-side; search/severity filter this page instantly.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* STATS */}
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <Activity className="size-3 text-accent-700" /> Entries
          </div>
          <div className="mt-0.5 text-2xl font-bold text-ink-950 tabular-nums">{stats.total}</div>
        </div>
        <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <Plus className="size-3 text-status-normal" /> Creates
          </div>
          <div className="mt-0.5 text-2xl font-bold text-status-normal tabular-nums">{stats.creates}</div>
        </div>
        <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <PenLine className="size-3 text-blue-600" /> Updates
          </div>
          <div className="mt-0.5 text-2xl font-bold text-blue-600 tabular-nums">{stats.updates}</div>
        </div>
        <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <Trash2 className="size-3 text-status-critical" /> Deletes
          </div>
          <div className="mt-0.5 text-2xl font-bold text-status-critical tabular-nums">{stats.deletes}</div>
        </div>
        <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <AlertTriangle className="size-3 text-amber-500" /> Critical
          </div>
          <div className="mt-0.5 text-2xl font-bold text-amber-500 tabular-nums">{stats.criticals}</div>
        </div>
      </div>

      {/* TABLE */}
      <div className="relative min-h-0 flex-1 overflow-auto rounded-md border border-line-200 bg-surface-0 shadow-raised">
        {loading ? (
          <LoadingState label="Loading audit trail…" rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void fetchLogs(applied)} />
        ) : visibleLogs.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={filterActive || q ? "No entries match these filters" : "No audit entries yet"}
            hint={
              filterActive || q
                ? "Try widening the date range or clearing the quick search."
                : "Writes to patients, orders, referrers & masters are recorded here automatically."
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-100 backdrop-blur">
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-600">
                <th className="px-3 py-2.5 font-medium">Time</th>
                <th className="px-3 py-2.5 font-medium">Action</th>
                <th className="px-3 py-2.5 font-medium">User</th>
                <th className="px-3 py-2.5 font-medium">Target Object</th>
                <th className="px-3 py-2.5 font-medium">Change Details</th>
                <th className="px-3 py-2.5 font-medium">Device / IP</th>
                <th className="px-3 py-2.5 font-medium">Severity</th>
                <th className="px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-200">
              {visibleLogs.map((log) => {
                const sev = severityOf(log);
                const meta = SEVERITY_META[sev];
                const changes = diffSummary(log.before, log.after);
                return (
                  <tr
                    key={log.id}
                    className={`group cursor-pointer transition-colors duration-fast ${meta.row}`}
                    onClick={() => setSelected(log)}
                  >
                    <td className={`whitespace-nowrap border-l-2 px-3 py-2.5 text-xs text-ink-600 ${meta.accent}`}>
                      <span className="block whitespace-nowrap">{fmtTimeShort(log.createdAt)}</span>
                      <span className="block text-[10px] text-ink-400">
                        {new Date(log.createdAt).toLocaleDateString("en-IN", { year: "numeric" })}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ACTION_BADGES[log.action] ?? "bg-surface-100 text-ink-600 border-line-200"}`}
                      >
                        {actionIcon(log.action)} {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-950">
                        <User className="size-3.5 text-ink-400" />
                        {log.actorName ?? "system"}
                      </span>
                      {log.actorRole && (
                        <span
                          className={`mt-0.5 inline-block rounded-full border px-1.5 py-px text-[10px] font-medium ${roleChipClass(log.actorRole)}`}
                        >
                          {log.actorRole}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium capitalize text-ink-950">{log.entity}</span>
                      {log.entityId ? (
                        <span className="mt-0.5 block data-mono text-[11px] text-ink-500">
                          {shortId(log.entityId)}
                        </span>
                      ) : (
                        <span className="block text-[11px] text-line-300">—</span>
                      )}
                    </td>
                    <td className="max-w-[260px] px-3 py-2.5">
                      {changes.length > 0 ? (
                        <span className="block truncate font-mono text-[11px] text-ink-600" title={changes.join("\n")}>
                          {changes[0]}
                        </span>
                      ) : (
                        <span className="text-[11px] text-line-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-xs text-ink-600">
                        <MonitorSmartphone className="size-3.5 text-ink-400" />
                        {deviceOf(log.userAgent)}
                      </span>
                      {log.ipAddress ? (
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-400">
                          <Globe className="size-3 text-ink-300" /> {log.ipAddress}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}>
                        {sev === "critical" ? (
                          <AlertTriangle className="size-3" />
                        ) : sev === "warning" ? (
                          <Info className="size-3" />
                        ) : (
                          <Activity className="size-3" />
                        )}
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 opacity-0 transition-opacity duration-fast group-hover:opacity-100">
                        <Eye className="size-3.5" /> Detail
                      </span>
                      <ChevronDown className="ml-auto size-4 text-ink-300" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {logs.length >= 200 && !loading && (
        <p className="shrink-0 text-center text-[11px] text-ink-400">
          Showing the first 200 matching entries — narrow the date range or filters to dig further.
        </p>
      )}

      {/* SLIDE-OVER DETAIL */}
      {selected && <DetailPanel log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
