import { useState, useEffect, useMemo, Fragment } from "react";
import { useNavigate } from "react-router";
import {
  ShieldCheck,
  RefreshCw,
  Loader2,
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
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs({
        action: actionFilter || undefined,
        entity: entityFilter || undefined,
        limit: 100,
      });
      setLogs(data);
    } catch {
      setLogs([]);
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
      return <span className="text-gray-300">—</span>;
    }

    if (!beforeText) {
      return (
        <pre className="text-[11px] leading-relaxed text-gray-600 bg-gray-50 border border-gray-100 rounded-md p-2 overflow-auto max-h-52 font-mono whitespace-pre-wrap break-all">
          {afterText}
        </pre>
      );
    }

    // Show what changed: before → after side by side.
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Before</p>
          <pre className="text-[11px] leading-relaxed text-gray-500 bg-gray-50 border border-gray-100 rounded-md p-2 overflow-auto max-h-52 font-mono whitespace-pre-wrap break-all">
            {beforeText}
          </pre>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600 mb-1">After</p>
          <pre className="text-[11px] leading-relaxed text-gray-700 bg-teal-50/40 border border-teal-100 rounded-md p-2 overflow-auto max-h-52 font-mono whitespace-pre-wrap break-all">
            {afterText || "—"}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full overflow-hidden bg-gray-100 flex flex-col">
      {/* TOP BAR */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-base tracking-wide">THULIR03</span>
          <span className="text-teal-300/60">|</span>
          <span className="text-sm font-medium text-teal-50 flex items-center gap-1.5">
            <ShieldCheck className="size-4" /> Audit Trail
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xs px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white transition-colors font-medium"
          >
            Dashboard
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-3">
        <div className="h-full flex flex-col gap-3">
          {/* STATS */}
          <div className="grid grid-cols-4 gap-3 shrink-0">
            <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">Entries</div>
              <div className="text-2xl font-bold text-gray-800 mt-0.5">{stats.total}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 font-medium flex items-center gap-1">
                <Plus className="size-3 text-green-500" /> Creates
              </div>
              <div className="text-2xl font-bold text-green-600 mt-0.5">{stats.creates}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 font-medium flex items-center gap-1">
                <PenLine className="size-3 text-blue-500" /> Updates
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-0.5">{stats.updates}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 font-medium flex items-center gap-1">
                <Trash2 className="size-3 text-red-500" /> Deletes
              </div>
              <div className="text-2xl font-bold text-red-500 mt-0.5">{stats.deletes}</div>
            </div>
          </div>

          {/* FILTER BAR */}
          <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 flex items-center gap-3 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <Activity className="size-4 text-teal-600" />
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                void fetchLogs();
              }}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
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
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
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
              className="text-xs px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="size-3.5" /> Refresh
            </button>
            <span className="ml-auto text-[11px] text-gray-400">
              Latest {logs.length} entries
            </span>
          </div>

          {/* TABLE */}
          <div className="flex-1 overflow-auto bg-white rounded-lg border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-400 gap-2">
                <Loader2 className="size-5 animate-spin" /> Loading audit trail…
              </div>
            ) : logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                <ShieldCheck className="size-8 text-gray-300" />
                <span className="text-sm">No audit entries yet — writes to patients, orders &amp; referrers are recorded here automatically.</span>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50/95 backdrop-blur">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-2.5 font-medium">Time</th>
                    <th className="px-4 py-2.5 font-medium">Action</th>
                    <th className="px-4 py-2.5 font-medium">Entity</th>
                    <th className="px-4 py-2.5 font-medium">Entity ID</th>
                    <th className="px-4 py-2.5 font-medium">Actor</th>
                    <th className="px-4 py-2.5 font-medium">IP</th>
                    <th className="px-4 py-2.5 font-medium">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <Fragment key={log.id}>
                      <tr className="hover:bg-teal-50/40 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 text-xs">
                          {formatTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${ACTION_BADGES[log.action] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                            {actionIcon(log.action)} {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 capitalize text-gray-700 font-medium">
                          {log.entity}
                        </td>
                        <td className="px-4 py-2.5">
                          {log.entityId ? (
                            <span className="text-xs font-mono text-gray-500">{log.entityId.slice(0, 13)}…</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">
                          <span className="flex items-center gap-1.5 text-xs">
                            <User className="size-3.5 text-gray-400" />
                            {log.actorName ?? <span className="text-gray-300">system</span>}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {log.ipAddress ? (
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Globe className="size-3.5 text-gray-400" /> {log.ipAddress}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors"
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
                          <td colSpan={7} className="px-4 py-3 bg-gray-50/60 border-b border-gray-100">
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
      </div>
    </div>
  );
}
