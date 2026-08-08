import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlaskConical,
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Activity,
  History,
  ClipboardList,
  BellRing,
  RefreshCw,
} from "lucide-react";
import {
  getQcControls,
  createQcControl,
  getQcRuns,
  enterQcRun,
  getQcSummary,
  getInstruments,
  type QcControl,
  type QcLevel,
  type QcRun,
  type QcStatus,
  type QcSummary,
  type Instrument,
} from "../lib/api-client";
import { pushExtraAlert } from "../lib/alerts-store";
import { QcPlot } from "../components/ui/QcChart";
import { useContextActions } from "../lib/context-actions";
import PageHeader from "../components/ui/PageHeader";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";

// ─── Meta ────────────────────────────────────────────────────────────────

const STATUS_META: Record<QcStatus, { label: string; chip: string; dot: string; text: string }> = {
  PASS: { label: "Pass", chip: "bg-status-normal/10 text-status-normal border-status-normal/30", dot: "bg-status-normal", text: "text-status-normal" },
  WARN: { label: "Warning", chip: "bg-amber-50 text-amber-700 border-amber-300/50", dot: "bg-amber-500", text: "text-amber-600" },
  REJECT: { label: "Reject", chip: "bg-status-critical/10 text-status-critical border-status-critical/30", dot: "bg-status-critical", text: "text-status-critical" },
};

const LEVEL_LABEL: Record<QcLevel, string> = { LOW: "Low", NORMAL: "Normal", HIGH: "High" };
const LEVEL_CHIP: Record<QcLevel, string> = {
  LOW: "bg-sky-50 text-sky-700 border-sky-200",
  NORMAL: "bg-accent-100 text-accent-700 border-accent-200",
  HIGH: "bg-violet-50 text-violet-700 border-violet-200",
};

function fmtClock(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function QcPage() {
  const [controls, setControls] = useState<QcControl[]>([]);
  const [runs, setRuns] = useState<QcRun[]>([]);
  const [summary, setSummary] = useState<QcSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // New control form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ testName: "", testCode: "", level: "NORMAL" as QcLevel, unit: "", assignedMean: "", assignedSd: "", instrumentId: "" });
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [saving, setSaving] = useState(false);

  // Run entry
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [entering, setEntering] = useState(false);
  const [lastEval, setLastEval] = useState<{ status: QcStatus; violations: string[]; sdDeviation: number } | null>(null);

  const loadInstruments = useCallback(async () => {
    try {
      const list = await getInstruments({ isActive: "true" });
      setInstruments(list);
    } catch {
      /* analyzer list is optional — controls work without an instrument link */
    }
  }, []);

  const loadAll = useCallback(() => {
    Promise.all([getQcControls(), getQcSummary()])
      .then(([cs, s]) => {
        setControls(cs);
        setSummary(s);
        setError("");
        if (cs.length > 0) setSelectedId((prev) => prev && cs.some((c) => c.id === prev) ? prev : cs[0].id);
      })
      .catch(() => setError("Failed to load QC controls. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const loadRuns = useCallback((controlId: string) => {
    getQcRuns(controlId, 50)
      .then(setRuns)
      .catch(() => setRuns([]));
  }, []);

  useEffect(() => {
    loadAll();
    void loadInstruments();
  }, [loadAll, loadInstruments]);

  useEffect(() => {
    if (selectedId) loadRuns(selectedId);
  }, [selectedId, loadRuns]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const selected = useMemo(() => controls.find((c) => c.id === selectedId) ?? null, [controls, selectedId]);

  // Chart series from real runs (ascending), flagging the latest run if it rejected.
  const series = useMemo(() => {
    if (!selected || runs.length === 0) return null;
    const asc = [...runs].reverse();
    const last = asc[asc.length - 1];
    return {
      mean: selected.assignedMean,
      sd: selected.assignedSd,
      unit: selected.unit ?? "",
      points: asc.map((r) => r.measuredValue),
      flaggedIndex: last.status === "REJECT" ? asc.length - 1 : -1,
    };
  }, [selected, runs]);

  const saveControl = async () => {
    const mean = parseFloat(form.assignedMean);
    const sd = parseFloat(form.assignedSd);
    if (!form.testName.trim() || !Number.isFinite(mean) || !Number.isFinite(sd) || sd <= 0) {
      setToast("Test name, assigned mean and a positive SD are required.");
      return;
    }
    setSaving(true);
    try {
      const created = await createQcControl({
        testName: form.testName.trim(),
        testCode: form.testCode.trim() || undefined,
        level: form.level,
        unit: form.unit.trim() || undefined,
        assignedMean: mean,
        assignedSd: sd,
        instrumentId: form.instrumentId || undefined,
      });
      setControls((prev) => [...prev, created]);
      setSelectedId(created.id);
      setShowForm(false);
      setForm({ testName: "", testCode: "", level: "NORMAL", unit: "", assignedMean: "", assignedSd: "", instrumentId: "" });
      setToast(`Control "${created.name}" created — ready for daily entry.`);
      setSummary((prev) => (prev ? { ...prev, controls: prev.controls + 1 } : prev));
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to create control.");
    } finally {
      setSaving(false);
    }
  };

  const submitRun = async () => {
    if (!selected) return;
    const v = parseFloat(value);
    if (!Number.isFinite(v)) {
      setToast("Enter the measured control value first.");
      return;
    }
    setEntering(true);
    try {
      const res = await enterQcRun({ controlId: selected.id, value: v, note: note.trim() || undefined });
      setLastEval(res.evaluation);
      setValue("");
      setNote("");
      await Promise.all([loadRuns(selected.id), loadAll()]);
      if (res.evaluation.status === "REJECT") {
        pushExtraAlert({
          severity: "critical",
          kind: "qc",
          title: `QC Reject: ${res.control.name}`,
          detail: `${res.control.testName} ${res.evaluation.violations.join(", ") || ""} — control value ${v}${res.control.unit ? ` ${res.control.unit}` : ""} exceeds rule limits. Run must be reviewed before patient results sign-off.`,
          rule: res.evaluation.violations[0] ?? "Westgard",
          roles: ["pathologist", "lab_admin", "lab_manager"],
        });
        setToast(`REJECT — ${res.evaluation.violations.join(", ") || "rule violation"} · investigation alert raised in Alerts Center.`);
      } else if (res.evaluation.status === "WARN") {
        setToast(`Warning — 1:2s threshold touched (${res.evaluation.sdDeviation} SD).`);
      } else {
        setToast("Pass — control within limits.");
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to save the run.");
    } finally {
      setEntering(false);
    }
  };

  // Context toolbar — refresh QC controls & instruments.
  useContextActions([
    { id: "refresh", label: "Refresh", icon: RefreshCw, onClick: () => loadAll() },
  ]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-surface-100 p-3">
      <PageHeader
        title="QC — Quality Control"
        subtitle="Manual control entry with Westgard rule evaluation · NABL-ready · instrument streaming arrives post-V1"
      />

      {/* Summary strip */}
      {loading ? (
        <div className="rounded-md border border-line-200 bg-surface-0 shadow-raised">
          <LoadingState label="Loading QC…" rows={2} />
        </div>
      ) : error ? (
        <div className="rounded-md border border-line-200 bg-surface-0 shadow-raised">
          <ErrorState message={error} onRetry={loadAll} />
        </div>
      ) : (
        <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
            <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
              <FlaskConical className="size-3 text-accent-700" /> Controls
            </div>
            <div className="mt-0.5 text-2xl font-bold text-ink-950 tabular-nums">{summary?.controls ?? 0}</div>
          </div>
          <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
            <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
              <Activity className="size-3 text-accent-700" /> Today's runs
            </div>
            <div className="mt-0.5 text-2xl font-bold text-ink-950 tabular-nums">{summary?.today.runs ?? 0}</div>
          </div>
          <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
            <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
              <CheckCircle2 className="size-3 text-status-normal" /> Pass
            </div>
            <div className="mt-0.5 text-2xl font-bold text-status-normal tabular-nums">{summary?.today.PASS ?? 0}</div>
          </div>
          <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
            <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
              <AlertTriangle className="size-3 text-amber-500" /> Warning
            </div>
            <div className="mt-0.5 text-2xl font-bold text-amber-500 tabular-nums">{summary?.today.WARN ?? 0}</div>
          </div>
          <div className="rounded-md border border-line-200 bg-surface-0 p-3.5 shadow-raised">
            <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
              <ShieldAlert className="size-3 text-status-critical" /> Reject
            </div>
            <div className={`mt-0.5 text-2xl font-bold tabular-nums ${(summary?.today.REJECT ?? 0) > 0 ? "text-status-critical" : "text-ink-950"}`}>
              {summary?.today.REJECT ?? 0}
            </div>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-5">
          {/* Controls column */}
          <aside className="flex min-h-0 flex-col rounded-md border border-line-200 bg-surface-0 shadow-raised lg:col-span-2">
            <div className="flex items-center justify-between border-b border-line-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink-950">Control Materials</h2>
              <button
                onClick={() => setShowForm((s) => !s)}
                className="inline-flex items-center gap-1 rounded-md bg-accent-700 px-2.5 py-1.5 text-[11px] font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
              >
                {showForm ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
                {showForm ? "Cancel" : "New Control"}
              </button>
            </div>

            {showForm && (
              <div className="border-b border-line-200 bg-surface-100/60 p-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <label className="field-label">Test name *</label>
                    <input
                      value={form.testName}
                      onChange={(e) => setForm((f) => ({ ...f, testName: e.target.value }))}
                      className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                      placeholder="e.g. Glucose"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="field-label">Analyzer (optional)</label>
                    <select
                      value={form.instrumentId}
                      onChange={(e) => setForm((f) => ({ ...f, instrumentId: e.target.value }))}
                      className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 focus:outline-none focus:ring-2 focus:ring-accent-100"
                    >
                      <option value="">No analyzer — uses global rule set</option>
                      {instruments.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.code} · {inst.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-ink-400">
                      Linked analyzers use their per-analyzer rule override from Settings → QC Rules.
                    </p>
                  </div>
                  <div>
                    <label className="field-label">Test code</label>
                    <input
                      value={form.testCode}
                      onChange={(e) => setForm((f) => ({ ...f, testCode: e.target.value }))}
                      className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                      placeholder="GLU"
                    />
                  </div>
                  <div>
                    <label className="field-label">Level</label>
                    <select
                      value={form.level}
                      onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as QcLevel }))}
                      className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 focus:outline-none focus:ring-2 focus:ring-accent-100"
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Unit</label>
                    <input
                      value={form.unit}
                      onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                      className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 text-xs text-ink-950 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                      placeholder="mg/dL"
                    />
                  </div>
                  <div>
                    <label className="field-label">Assigned SD *</label>
                    <input
                      value={form.assignedSd}
                      onChange={(e) => setForm((f) => ({ ...f, assignedSd: e.target.value }))}
                      className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 font-mono text-xs text-ink-950 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                      placeholder="3.2"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="field-label">Assigned Mean *</label>
                    <input
                      value={form.assignedMean}
                      onChange={(e) => setForm((f) => ({ ...f, assignedMean: e.target.value }))}
                      className="w-full rounded-md border border-line-200 bg-surface-0 px-2.5 py-1.5 font-mono text-xs text-ink-950 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                      placeholder="102.0"
                    />
                  </div>
                </div>
                <button
                  onClick={() => void saveControl()}
                  disabled={saving}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-accent-700 px-3 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  {saving ? "Creating…" : "Create control"}
                </button>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {controls.length === 0 ? (
                <EmptyState
                  icon={FlaskConical}
                  title="No controls yet"
                  hint="Create your first control material — e.g. Glucose Normal Control with the mean & SD from the reagent insert."
                />
              ) : (
                <ul className="divide-y divide-line-200">
                  {controls.map((c) => {
                    const active = c.id === selectedId;
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => setSelectedId(c.id)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-surface-100 ${
                            active ? "border-l-2 border-accent-600 bg-accent-100/40" : "border-l-2 border-transparent"
                          }`}
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-700">
                            <FlaskConical className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-950">
                              {c.testName}
                              <span className={`rounded-full border px-1.5 py-px text-[9px] font-medium ${LEVEL_CHIP[c.level]}`}>
                                {LEVEL_LABEL[c.level]}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[11px] text-ink-400">
                              Mean {c.assignedMean} ± {c.assignedSd} SD{c.unit ? ` ${c.unit}` : ""} · {c.runCount} run{c.runCount === 1 ? "" : "s"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Entry + chart column */}
          <section className="flex min-h-0 flex-col gap-3 overflow-y-auto lg:col-span-3">
            {!selected ? (
              <div className="rounded-md border border-line-200 bg-surface-0 shadow-raised">
                <EmptyState
                  icon={ClipboardList}
                  title="Select a control"
                  hint="Pick a control material (or create one) to enter today's measured value and see the Levey-Jennings chart."
                />
              </div>
            ) : (
              <>
                {/* Chart */}
                <div className="rounded-md border border-line-200 bg-surface-0 p-4 shadow-raised">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-950">{selected.name}</p>
                      <p className="text-[11px] text-ink-400">
                        Assigned mean {selected.assignedMean} · SD {selected.assignedSd}
                        {selected.unit ? ` · unit ${selected.unit}` : ""}
                      </p>
                    </div>
                    {lastEval && (
                      <span className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_META[lastEval.status].chip}`}>
                        <span className={`size-1.5 rounded-full ${STATUS_META[lastEval.status].dot}`} />
                        Last run: {STATUS_META[lastEval.status].label}
                      </span>
                    )}
                  </div>
                  {series ? (
                    <QcPlot qc={series} flagLabel={lastEval?.status === "REJECT" ? (lastEval.violations[0] ?? "flag") : "flag"} />
                  ) : (
                    <p className="py-6 text-center text-xs text-ink-400">No runs yet — enter the first measured value below.</p>
                  )}
                </div>

                {/* Entry */}
                <div className="rounded-md border border-line-200 bg-surface-0 p-4 shadow-raised">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Activity className="size-3.5 text-accent-700" />
                    <h3 className="text-sm font-semibold text-ink-950">Enter Today's Control Value</h3>
                    <span className="ml-auto rounded-full bg-surface-100 px-2 py-0.5 text-[10px] text-ink-400">Westgard: 1:2s · 1:3s · 2:2s · R:4s · 4:1s · 10x</span>
                  </div>
                  <div className="flex flex-wrap items-end gap-2.5">
                    <div>
                      <label className="field-label">Measured value *</label>
                      <input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void submitRun()}
                        inputMode="decimal"
                        autoFocus
                        className="w-36 rounded-md border border-line-200 bg-surface-0 px-3 py-2 font-mono text-sm text-ink-950 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                        placeholder={String(selected.assignedMean)}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <label className="field-label">Note (optional)</label>
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void submitRun()}
                        className="w-full rounded-md border border-line-200 bg-surface-0 px-3 py-2 text-xs text-ink-950 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-100"
                        placeholder="e.g. New reagent lot opened"
                      />
                    </div>
                    <button
                      onClick={() => void submitRun()}
                      disabled={entering || !value.trim()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {entering ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      {entering ? "Evaluating…" : "Evaluate & Save"}
                    </button>
                  </div>

                  {lastEval && (
                    <div
                      className={`mt-3 flex flex-wrap items-center gap-2 rounded-md border px-3.5 py-2.5 ${
                        lastEval.status === "REJECT"
                          ? "border-status-critical/40 bg-red-50"
                          : lastEval.status === "WARN"
                            ? "border-amber-300/50 bg-amber-50"
                            : "border-status-normal/30 bg-status-normal/5"
                      }`}
                    >
                      <span className={`size-2 shrink-0 rounded-full ${STATUS_META[lastEval.status].dot}`} />
                      <span className={`text-xs font-bold ${STATUS_META[lastEval.status].text}`}>
                        {STATUS_META[lastEval.status].label.toUpperCase()} · {lastEval.sdDeviation > 0 ? "+" : ""}{lastEval.sdDeviation} SD
                      </span>
                      {lastEval.violations.length > 0 ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          {lastEval.violations.map((v) => (
                            <span key={v} className="inline-flex items-center gap-1 rounded-sm border border-status-critical/30 bg-surface-0 px-1.5 py-0.5 font-mono text-[10px] font-bold text-status-critical">
                              <AlertTriangle className="size-3" /> {v}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-500">Within limits — no rule violation.</span>
                      )}
                      {lastEval.status === "REJECT" && (
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-status-critical">
                          <BellRing className="size-3" /> Investigation alert raised
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* History */}
                <div className="overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-raised">
                  <div className="flex items-center gap-2 border-b border-line-200 px-4 py-3">
                    <History className="size-4 text-accent-700" />
                    <h3 className="text-sm font-semibold text-ink-950">Run History</h3>
                    <span className="ml-auto text-[10px] text-ink-400">latest {runs.length}</span>
                  </div>
                  {runs.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-ink-400">No runs recorded for this control yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-line-200 bg-surface-100/60 text-[10px] uppercase tracking-wide text-ink-400">
                            <th className="px-4 py-2 font-medium">Date</th>
                            <th className="px-4 py-2 font-medium">Value</th>
                            <th className="px-4 py-2 font-medium">SD</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                            <th className="px-4 py-2 font-medium">Rules</th>
                            <th className="px-4 py-2 font-medium">Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line-200">
                          {runs.map((r) => (
                            <tr key={r.id} className="transition-colors duration-fast hover:bg-surface-100/60">
                              <td className="whitespace-nowrap px-4 py-2 text-ink-500">{fmtClock(r.runDate)}</td>
                              <td className="px-4 py-2 font-mono font-medium text-ink-950">
                                {r.measuredValue}
                                {selected.unit ? <span className="text-ink-400"> {selected.unit}</span> : null}
                              </td>
                              <td className="px-4 py-2 font-mono text-ink-500">{r.sdDeviation === null ? "—" : `${r.sdDeviation > 0 ? "+" : ""}${r.sdDeviation}`}</td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${STATUS_META[r.status].chip}`}>
                                  <span className={`size-1.5 rounded-full ${STATUS_META[r.status].dot}`} />
                                  {STATUS_META[r.status].label}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                {r.violations.length > 0 ? (
                                  <span className="flex flex-wrap gap-1">
                                    {r.violations.map((v) => (
                                      <span key={v} className="rounded-sm bg-red-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-status-critical">
                                        {v}
                                      </span>
                                    ))}
                                  </span>
                                ) : (
                                  <span className="text-ink-300">—</span>
                                )}
                              </td>
                              <td className="max-w-[180px] truncate px-4 py-2 text-ink-500">{r.note ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[55] -translate-x-1/2 rounded-md border border-line-200 bg-surface-0 px-4 py-2.5 text-xs font-medium text-ink-950 shadow-overlay">
          {toast}
        </div>
      )}
    </div>
  );
}
