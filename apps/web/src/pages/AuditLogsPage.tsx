import { useState, useEffect, useMemo, Fragment } from "react";
import {
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  User,
  Globe,
  Activity,
  Trash2,
  PenLine,
  Plus,
} from "lucide-react";
import { getAuditLogs, type AuditLogEntry } from "../lib/api-client";
import PageHeader from "../components/ui/PageHeader";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";

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

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAuditLogs({
        action: actionFilter || undefined,
        entity: entityFilter || undefined,
        limit: 100,
      });
      setLogs(data);
    } catch {
      setLogs([]);
      setError("Failed to load the audit trail. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entities = useMemo(
    () => [...new Set(logs.map((l) => l.entity))].sort(),
    [logs],
  );

  const stats = useMemo(() => {
    const creates = logs.filter((l) => l.action === "POST").length;
    const updates = logs.filter((l) => l.action === "PATCH" || l.action === "PUT").length;
    const deletes = logs.filter((l) => l.action === "DELETE").length;
    return { total: logs.length, creates, updates, deletes };
  }, [logs]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const renderPayload = (before: unknown, after: unknown) => {
    const fmt = (v: unknown) => {
      if (v === null || v === undefined) return "";
      let text: string;
      try {
        text = JSON.stringify(v, null, 2);
      } catch {
        text = String(v);
      }
      if (text.length > 4000) text = `${text.slice(0, 4000)}\n… (truncated)`;
      return text;
    };

    const beforeText = fmt(before);
    const afterText = fmt(after);

    if (!beforeText && !afterText) {
      return <span className="text-line-300">—</span>;
    }

    if (!beforeText) {
      return (
        <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-md border border-line-200 bg-surface-100 p-2 font-mono text-[11px] leading-relaxed text-ink-600">
          {afterText}
        </pre>
      );
    }

    // Show what changed: before → after side by side.
    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <p className="field-label mb-1">Before</p>
          <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-md border border-line-200 bg-surface-100 p-2 font-mono text-[11px] leading-relaxed text-ink-600">
            {beforeText}
          </pre>
        </div>
        <div>
          <p className="field-label mb-1 text-accent-700">After</p>
          <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-md border border-accent-100 bg-accent-100/40 p-2 font-mono text-[11px] leading-relaxed text-ink-950">
            {afterText || "—"}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-surface-100 p-3">
      <PageHeader
        title="Audit Trail"
        subtitle="Every write to patients, orders, referrers & masters — recorded automatically"
      />

      {/* STATS */}
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-md border border-line-200 bg-surface-0 p-4 shadow-raised">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Entries</div>
          <div className="mt-0.5 text-2xl font-bold text-ink-950 tabular-nums">{stats.total}</div>
        </div>
        <div className="rounded-md border border-line-200 bg-surface-0 p-4 shadow-raised">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <Plus className="size-3 text-status-normal" /> Creates
          </div>
          <div className="mt-0.5 text-2xl font-bold text-status-normal tabular-nums">{stats.creates}</div>
        </div>
        <div className="rounded-md border border-line-200 bg-surface-0 p-4 shadow-raised">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <PenLine className="size-3 text-blue-600" /> Updates
          </div>
          <div className="mt-0.5 text-2xl font-bold text-blue-600 tabular-nums">{stats.updates}</div>
        </div>
        <div className="rounded-md border border-line-200 bg-surface-0 p-4 shadow-raised">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <Trash2 className="size-3 text-status-critical" /> Deletes
          </div>
          <div className="mt-0.5 text-2xl font-bold text-status-critical tabular-nums">{stats.deletes}</div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-md border border-line-200 bg-surface-0 px-4 py-3 shadow-raised">
        <Activity className="size-4 text-accent-700" />
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            void fetchLogs();
          }}
          className="rounded-md border border-line-200 bg-surface-0 px-2 py-1.5 text-xs text-ink-950 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-accent-100"
        >
          <option value="">All actions</option>
          <option value="POST">POST (create)</option>
          <option value="PATCH">PATCH (update)</option>
          <option value="PUT">PUT (update)</option>
          <option value="DELETE">DELETE (remove)</option>
        </select>
        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            void fetchLogs();
          }}
          className="rounded-md border border-line-200 bg-surface-0 px-2 py-1.5 text-xs text-ink-950 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-accent-100"
        >
          <option value="">All entities</option>
          {entities.map((entity) => (
            <option key={entity} value={entity}>
              {entity}
            </option>
          ))}
        </select>
        <button
          onClick={() => void fetchLogs()}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-1.5 text-xs font-medium text-surface-0 transition-colors duration-fast hover:bg-accent-500"
        >
          <RefreshCw className="size-3.5" /> Refresh
        </button>
        <span className="ml-auto text-[11px] text-ink-400">
          Latest {logs.length} entries
        </span>
      </div>

      {/* TABLE */}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-line-200 bg-surface-0 shadow-raised">
        {loading ? (
          <LoadingState label="Loading audit trail…" rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void fetchLogs()} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No audit entries yet"
            hint="Writes to patients, orders & referrers are recorded here automatically."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-100 backdrop-blur">
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-600">
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Entity</th>
                <th className="px-4 py-2.5 font-medium">Entity ID</th>
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
                <th className="px-4 py-2.5 font-medium">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-200">
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr className="transition-colors duration-fast hover:bg-surface-100">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-600">
                      {formatTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ACTION_BADGES[log.action] ?? "bg-surface-100 text-ink-600 border-line-200"}`}>
                        {actionIcon(log.action)} {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium capitalize text-ink-950">
                      {log.entity}
                    </td>
                    <td className="px-4 py-2.5">
                      {log.entityId ? (
                        <span className="data-mono text-xs text-ink-600">{log.entityId.slice(0, 13)}…</span>
                      ) : (
                        <span className="text-line-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-950">
                      <span className="flex items-center gap-1.5 text-xs">
                        <User className="size-3.5 text-ink-400" />
                        {log.actorName ?? <span className="text-line-300">system</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {log.ipAddress ? (
                        <span className="flex items-center gap-1.5 text-xs text-ink-600">
                          <Globe className="size-3.5 text-ink-400" /> {log.ipAddress}
                        </span>
                      ) : (
                        <span className="text-line-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500"
                      >
                        <FileText className="size-3.5" />
                        {expandedId === log.id ? "Hide" : "View"}
                        {expandedId === log.id ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr>
                      <td colSpan={7} className="border-b border-line-200 bg-surface-100/60 px-4 py-3">
                        {renderPayload(log.before, log.after)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
