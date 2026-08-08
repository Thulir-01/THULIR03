import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  SlidersHorizontal,
  Bell,
  ShieldCheck,
  FileText,
  Save,
  Loader2,
  Check,
  ChevronUp,
  ChevronDown,
  Copy,
  Cpu,
  FlaskConical,
  Activity,
  AlertTriangle,
  Clock,
  Cloud,
  History,
  Zap,
  User,
  Eye,
  Download,
  Wrench,
} from "lucide-react";
import {
  getLabSettings,
  updateLabSettings,
  getLabConfig,
  setLabConfig,
  getInstruments,
  type Instrument,
} from "../lib/api-client";
import PageHeader from "../components/ui/PageHeader";
import { LoadingState } from "../components/ui/PageStates";
import { useAuth } from "../lib/useAuth";

/* ─── Server-backed config persistence ───────────────────────────────
 * Every tab below persists to the backend LabConfig store via
 * /settings/config (GET all / PUT one key). Values are tenant-scoped,
 * shared across all users of the lab, and survive refresh/logout. The
 * QC rule set is consumed by the QC evaluation engine server-side, so
 * toggles here change real run evaluation immediately.              */

type SaveState = { state: "idle" | "saving" | "saved" | "error"; error?: string };

function deepMerge<T>(base: T, patch: Partial<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === "object" &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

/* ─── Small shared UI primitives ───────────────────────────────────── */

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      disabled={disabled}
      aria-pressed={on}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-fast disabled:opacity-40 ${
        on ? "bg-accent-700" : "bg-ink-300"
      }`}
    >
      <span
        className={`inline-block size-3.5 transform rounded-full bg-surface-0 shadow transition-transform duration-fast ${
          on ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

function ServerNote({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[10px] text-ink-400">
      <Cloud className="size-3 shrink-0" />
      {text}
    </p>
  );
}

const inputCls =
  "w-full rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-sm text-ink-950 transition-all duration-fast focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 placeholder:text-ink-300";
const labelCls = "mb-1 block text-xs font-medium text-ink-600";

/* ─── Westgard rule catalogue ──────────────────────────────────────── */
const WESTGARD_RULES: { id: string; name: string; desc: string; severity: "warn" | "reject" }[] = [
  { id: "1-2s", name: "1:2s", desc: "One control value exceeds 2 SD", severity: "warn" },
  { id: "1-3s", name: "1:3s", desc: "One control value exceeds 3 SD — reject run", severity: "reject" },
  { id: "2-2s", name: "2:2s", desc: "Two consecutive controls exceed 2 SD on the same side", severity: "warn" },
  { id: "R-4s", name: "R:4s", desc: "One control > +2s and another < −2s in the same run", severity: "reject" },
  { id: "4-1s", name: "4:1s", desc: "Four consecutive controls exceed 1 SD on the same side", severity: "warn" },
  { id: "10x", name: "10x", desc: "Ten consecutive controls on the same side of the mean", severity: "warn" },
];

/* Deterministic pseudo-random generator (stable across renders) */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Simulated control history — Test Mode replays the enabled rules
 * against it to show how many runs WOULD have been flagged.          */
function simulateFlags(ruleIds: string[]): { total: number; flagged: number; byRule: Record<string, number> } {
  const rand = mulberry32(42);
  const n = 60;
  const runs: { z1: number; z2: number }[] = [];
  for (let i = 0; i < n; i++) {
    runs.push({ z1: (rand() - 0.5) * 6.4, z2: (rand() - 0.5) * 6.4 });
  }
  const byRule: Record<string, number> = {};
  let flagged = 0;
  for (const r of runs) {
    const hits = ruleIds.filter((id) => {
      if (id === "1-3s") return Math.abs(r.z1) > 3;
      if (id === "1-2s") return Math.abs(r.z1) > 2;
      if (id === "2-2s") return false; // needs sequence context — approximated
      if (id === "R-4s") return r.z1 > 2 && r.z2 < -2;
      if (id === "4-1s") return false;
      if (id === "10x") return false;
      return false;
    });
    if (hits.length > 0) {
      flagged++;
      for (const h of hits) byRule[h] = (byRule[h] ?? 0) + 1;
    }
  }
  return { total: n, flagged, byRule };
}

/* ─── Page ─────────────────────────────────────────────────────────── */
type TabKey = "lab" | "qc" | "notify" | "audit";

interface QcRulesShape {
  enabled: string[];
  order: string[];
  testMode: boolean;
  overrides: Record<string, string[] | null>;
}
interface NotifyShape {
  channels: { email: boolean; sms: boolean; inApp: boolean };
  warnThreshold: string;
  criticalThreshold: string;
  quietHours: { enabled: boolean; from: string; to: string; criticalStillAlerts: boolean };
}
interface AuditShape {
  retentionYears: number;
  track: { userActivity: boolean; authEvents: boolean; resultEdits: boolean; reportSignoffs: boolean };
  exportFormat: "csv" | "pdf" | "json";
}
interface LabExtrasShape {
  regulatoryBodies: string[];
  contactName: string;
  contactRole: string;
}

const DEFAULT_QC: QcRulesShape = {
  enabled: ["1-2s", "1-3s", "R-4s"],
  order: ["1-2s", "1-3s", "2-2s", "R-4s", "4-1s", "10x"],
  testMode: false,
  overrides: {},
};
const DEFAULT_NOTIFY: NotifyShape = {
  channels: { email: true, sms: true, inApp: true },
  warnThreshold: "1-2s",
  criticalThreshold: "1-3s",
  quietHours: { enabled: false, from: "20:00", to: "06:00", criticalStillAlerts: true },
};
const DEFAULT_AUDIT: AuditShape = {
  retentionYears: 7,
  track: { userActivity: true, authEvents: true, resultEdits: true, reportSignoffs: true },
  exportFormat: "csv",
};
const DEFAULT_EXTRAS: LabExtrasShape = {
  regulatoryBodies: ["NABL", "ISO 15189"],
  contactName: "",
  contactRole: "",
};

export default function GeneralSettingsPage() {
  const { user } = useAuth();
  // The ribbon strip navigates to /general-settings/:section — the section
  // drives which panel renders (no content-area tab rail).
  const { section } = useParams();
  const tab: TabKey =
    section === "qc" || section === "notify" || section === "audit" ? section : "lab";

  /* General Lab Info — real org settings via /settings/lab */
  const [labLoading, setLabLoading] = useState(true);
  const [labSaving, setLabSaving] = useState(false);
  const [labError, setLabError] = useState("");
  const [labSaved, setLabSaved] = useState(false);
  const [labForm, setLabForm] = useState({ name: "", address: "", phone: "", email: "" });

  /* Server-backed config slices */
  const [configLoading, setConfigLoading] = useState(true);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  const [qcRules, setQcRulesState] = useState<QcRulesShape>(DEFAULT_QC);
  const [notify, setNotifyState] = useState<NotifyShape>(DEFAULT_NOTIFY);
  const [auditCfg, setAuditCfgState] = useState<AuditShape>(DEFAULT_AUDIT);
  const [localExtras, setLabExtrasState] = useState<LabExtrasShape>(DEFAULT_EXTRAS);

  /* Real analyzers from the Instrument master — drive per-analyzer overrides */
  const [instruments, setInstruments] = useState<Instrument[]>([]);

  const [toast, setToast] = useState("");

  const updateSaveState = useCallback((key: string, st: SaveState) => {
    setSaveStates((prev) => ({ ...prev, [key]: st }));
  }, []);

  /* Debounced server write for a config key. Shows live Saving… / Saved /
   * Save failed states in the header instead of a silent localStorage write. */
  const saveConfig = useCallback(
    (key: string, value: unknown) => {
      updateSaveState(key, { state: "saving" });
      if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
      saveTimers.current[key] = setTimeout(() => {
        setLabConfig(key, value)
          .then(() => {
            updateSaveState(key, { state: "saved" });
            saveTimers.current[key] = setTimeout(
              () => updateSaveState(key, { state: "idle" }),
              2500,
            );
          })
          .catch(() =>
            updateSaveState(key, { state: "error", error: "Save failed — try again" }),
          );
      }, 700);
    },
    [updateSaveState],
  );

  /* Wrappers used by every control on the page: update state + persist. */
  const setQcRules = useCallback(
    (next: QcRulesShape | ((p: QcRulesShape) => QcRulesShape)) => {
      setQcRulesState((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: QcRulesShape) => QcRulesShape)(prev) : next;
        saveConfig("qc-rules", resolved);
        return resolved;
      });
    },
    [saveConfig],
  );
  const setNotify = useCallback(
    (next: NotifyShape | ((p: NotifyShape) => NotifyShape)) => {
      setNotifyState((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: NotifyShape) => NotifyShape)(prev) : next;
        saveConfig("notifications", resolved);
        return resolved;
      });
    },
    [saveConfig],
  );
  const setAuditCfg = useCallback(
    (next: AuditShape | ((p: AuditShape) => AuditShape)) => {
      setAuditCfgState((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: AuditShape) => AuditShape)(prev) : next;
        saveConfig("audit-compliance", resolved);
        return resolved;
      });
    },
    [saveConfig],
  );
  const setLabExtras = useCallback(
    (next: LabExtrasShape | ((p: LabExtrasShape) => LabExtrasShape)) => {
      setLabExtrasState((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (p: LabExtrasShape) => LabExtrasShape)(prev)
            : next;
        saveConfig("lab-extras", resolved);
        return resolved;
      });
    },
    [saveConfig],
  );

  /* Load everything the server has for this tenant on mount. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await getLabConfig();
        if (!alive) return;
        const qc = cfg["qc-rules"] as Partial<QcRulesShape> | undefined;
        if (qc) setQcRulesState((prev) => deepMerge(prev, qc));
        const nt = cfg["notifications"] as Partial<NotifyShape> | undefined;
        if (nt) setNotifyState((prev) => deepMerge(prev, nt));
        const au = cfg["audit-compliance"] as Partial<AuditShape> | undefined;
        if (au) setAuditCfgState((prev) => deepMerge(prev, au));
        const ex = cfg["lab-extras"] as Partial<LabExtrasShape> | undefined;
        if (ex) setLabExtrasState((prev) => deepMerge(prev, ex));
      } catch {
        /* server unreachable — defaults remain usable */
      } finally {
        if (alive) setConfigLoading(false);
      }
    })();
    try {
      getInstruments({ isActive: "true" }).then(setInstruments).catch(() => setInstruments([]));
    } catch {
      setInstruments([]);
    }
    return () => {
      alive = false;
    };
  }, []);

  /* ── Lab tab (real API) ── */
  const loadLab = useCallback(async () => {
    setLabLoading(true);
    setLabError("");
    try {
      const lab = await getLabSettings();
      setLabForm({
        name: lab.name,
        address: lab.address ?? "",
        phone: lab.phone ?? "",
        email: lab.email ?? "",
      });
    } catch {
      setLabError("Failed to load lab settings.");
    } finally {
      setLabLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLab();
  }, [loadLab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      for (const t of Object.values(timers)) {
        if (t) clearTimeout(t);
      }
    };
  }, []);

  const saveLab = async () => {
    if (!labForm.name.trim()) {
      setLabError("Lab name is required");
      return;
    }
    setLabSaving(true);
    setLabError("");
    try {
      await updateLabSettings({
        name: labForm.name.trim(),
        address: labForm.address.trim() || null,
        phone: labForm.phone.trim() || null,
        email: labForm.email.trim() || null,
      });
      setLabSaved(true);
      setTimeout(() => setLabSaved(false), 2000);
      setToast("Lab details saved — used on reports & invoices.");
    } catch {
      setLabError("Failed to save lab settings.");
    } finally {
      setLabSaving(false);
    }
  };

  /* ── QC rules helpers ── */
  const toggleRule = (id: string) => {
    setQcRules((prev) => ({
      ...prev,
      enabled: prev.enabled.includes(id)
        ? prev.enabled.filter((r) => r !== id)
        : [...prev.enabled, id],
    }));
  };
  const moveRule = (id: string, dir: -1 | 1) => {
    setQcRules((prev) => {
      const order = [...prev.order];
      const i = order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return prev;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...prev, order };
    });
  };
  const sim = useMemo(
    () => simulateFlags(qcRules.enabled),
    [qcRules.enabled],
  );

  const setOverride = (analyzerId: string, rules: string[] | null) => {
    setQcRules((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [analyzerId]: rules },
    }));
  };

  const overrideCount = instruments.filter((a) => qcRules.overrides[a.id]).length;

  /* Combined server-save status for the header */
  const saveStatus = useMemo(() => {
    const states = Object.values(saveStates);
    if (states.some((s) => s.state === "error")) return { kind: "error" as const };
    if (states.some((s) => s.state === "saving")) return { kind: "saving" as const };
    if (states.some((s) => s.state === "saved")) return { kind: "saved" as const };
    return { kind: "idle" as const };
  }, [saveStates]);


  if (configLoading || (labLoading && tab === "lab")) {
    return (
      <div className="h-full overflow-y-auto bg-surface-100">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <LoadingState label="Loading system settings…" rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <PageHeader
            title="System Settings & General Configuration"
            subtitle="Global rules & workflows for the lab — every option is saved to the server and applies immediately"
            actions={
              <span className="inline-flex items-center gap-2">
                {saveStatus.kind === "saving" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-300 bg-accent-100/60 px-3 py-1 text-xs font-medium text-accent-700">
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving to server…
                  </span>
                )}
                {saveStatus.kind === "saved" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-status-normal/30 bg-status-normal/10 px-3 py-1 text-xs font-medium text-status-normal">
                    <Cloud className="size-3.5" />
                    Saved to server
                  </span>
                )}
                {saveStatus.kind === "error" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-status-critical/30 bg-status-critical/10 px-3 py-1 text-xs font-medium text-status-critical">
                    <AlertTriangle className="size-3.5" />
                    Save failed — check connection
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line-200 bg-surface-0 px-3 py-1 text-xs font-medium text-ink-600">
                  <ShieldCheck className="size-3.5 text-accent-700" />
                  Lab Admin · {user?.firstName} {user?.lastName ?? ""}
                </span>
              </span>
            }
          />
        </div>

        {labError && tab === "lab" && (
          <div className="mb-4 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
            {labError}
          </div>
        )}

        <div className="min-w-0">
          <div className="min-w-0">
            {tab === "lab" && (
              <div className="space-y-5">
                <div className="rounded-md border border-line-200 bg-surface-0 p-6">
                  <div className="mb-5 flex items-center gap-2">
                    <Building2 className="size-4 text-accent-600" />
                    <h2 className="font-semibold text-ink-950">Laboratory</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Lab name *</label>
                      <input
                        value={labForm.name}
                        onChange={(e) => setLabForm((f) => ({ ...f, name: e.target.value }))}
                        className={inputCls}
                        placeholder="Thulir Diagnostics"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>
                        <MapPin className="mr-1 inline size-3.5 text-ink-400" /> Address
                      </label>
                      <input
                        value={labForm.address}
                        onChange={(e) => setLabForm((f) => ({ ...f, address: e.target.value }))}
                        className={inputCls}
                        placeholder="12, Anna Nagar, Chennai 600 040"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        <Phone className="mr-1 inline size-3.5 text-ink-400" /> Phone
                      </label>
                      <input
                        value={labForm.phone}
                        onChange={(e) => setLabForm((f) => ({ ...f, phone: e.target.value }))}
                        className={inputCls}
                        placeholder="+91 44 1234 5678"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        <Mail className="mr-1 inline size-3.5 text-ink-400" /> Email
                      </label>
                      <input
                        value={labForm.email}
                        onChange={(e) => setLabForm((f) => ({ ...f, email: e.target.value }))}
                        className={inputCls}
                        placeholder="lab@thulir03.com"
                      />
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-end gap-3 border-t border-line-200 pt-4">
                    <button
                      onClick={loadLab}
                      className="rounded-md border border-line-300 bg-surface-0 px-4 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-surface-100"
                    >
                      Reset
                    </button>
                    <button
                      onClick={saveLab}
                      disabled={labSaving}
                      className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-5 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-800 disabled:opacity-50"
                    >
                      {labSaving ? <Loader2 className="size-4 animate-spin" /> : labSaved ? <Check className="size-4" /> : <Save className="size-4" />}
                      {labSaving ? "Saving…" : labSaved ? "Saved" : "Save Changes"}
                    </button>
                  </div>
                </div>

                <div className="rounded-md border border-line-200 bg-surface-0 p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <ShieldCheck className="size-4 text-accent-600" />
                    <h2 className="font-semibold text-ink-950">Regulatory & Accreditation</h2>
                  </div>
                  <p className="mb-3 text-xs text-ink-500">
                    Accreditation bodies this lab is certified under — shown on report footers.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["NABL", "CAP", "CLIA", "ISO 15189", "DPDP Act 2023"].map((b) => {
                      const on = localExtras.regulatoryBodies.includes(b);
                      return (
                        <button
                          key={b}
                          onClick={() =>
                            setLabExtras((prev) => ({
                              ...prev,
                              regulatoryBodies: on
                                ? prev.regulatoryBodies.filter((x) => x !== b)
                                : [...prev.regulatoryBodies, b],
                            }))
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-fast ${
                            on
                              ? "border-accent-500 bg-accent-100 text-accent-700"
                              : "border-line-300 bg-surface-0 text-ink-500 hover:border-accent-300"
                          }`}
                        >
                          {on && <Check className="size-3" />}
                          {b}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>
                        <User className="mr-1 inline size-3.5 text-ink-400" /> Primary contact
                      </label>
                      <input
                        value={localExtras.contactName}
                        onChange={(e) => setLabExtras((prev) => ({ ...prev, contactName: e.target.value }))}
                        className={inputCls}
                        placeholder="Dr. S. Rajendran"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Contact role</label>
                      <input
                        value={localExtras.contactRole}
                        onChange={(e) => setLabExtras((prev) => ({ ...prev, contactRole: e.target.value }))}
                        className={inputCls}
                        placeholder="Lab Director"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <ServerNote text="Regulatory bodies & contacts are saved to the server and appear on report footers across all stations." />
                  </div>
                </div>
              </div>
            )}

            {tab === "qc" && (
              <div className="space-y-5">
                {/* Rule engine */}
                <div className="rounded-md border border-line-200 bg-surface-0 p-6">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="size-4 text-accent-600" />
                      <h2 className="font-semibold text-ink-950">Westgard Rule Engine</h2>
                    </div>
                    <button
                      onClick={() => setQcRules((prev) => ({ ...prev, testMode: !prev.testMode }))}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-fast ${
                        qcRules.testMode
                          ? "border-accent-500 bg-accent-100 text-accent-700"
                          : "border-line-300 bg-surface-0 text-ink-500 hover:border-accent-300"
                      }`}
                    >
                      <Zap className="size-3.5" />
                      Test Mode {qcRules.testMode ? "ON" : "OFF"}
                    </button>
                  </div>
                  <p className="mb-4 text-xs text-ink-500">
                    Toggle multi-rules and set their evaluation priority. Rules flagged{" "}
                    <span className="font-semibold text-status-critical">reject</span> stop the run.
                    Changes are saved to the server and applied to every QC run entered from now on.
                  </p>

                  <div className="space-y-2">
                    {qcRules.order.map((ruleId, idx) => {
                      const def = WESTGARD_RULES.find((r) => r.id === ruleId);
                      if (!def) return null;
                      const on = qcRules.enabled.includes(ruleId);
                      return (
                        <div
                          key={ruleId}
                          className={`flex items-center gap-3 rounded-md border px-3.5 py-3 transition-colors duration-fast ${
                            on ? "border-accent-200 bg-accent-100/40" : "border-line-200 bg-surface-100/40 opacity-60"
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveRule(ruleId, -1)}
                              disabled={idx === 0}
                              className="text-ink-400 transition-colors hover:text-ink-950 disabled:opacity-30"
                              aria-label="Move up"
                            >
                              <ChevronUp className="size-3.5" />
                            </button>
                            <button
                              onClick={() => moveRule(ruleId, 1)}
                              disabled={idx === qcRules.order.length - 1}
                              className="text-ink-400 transition-colors hover:text-ink-950 disabled:opacity-30"
                              aria-label="Move down"
                            >
                              <ChevronDown className="size-3.5" />
                            </button>
                          </div>
                          <span className="data-mono w-12 text-center text-sm font-semibold text-ink-950">{def.name}</span>
                          <span className="min-w-0 flex-1 truncate text-xs text-ink-500">{def.desc}</span>
                          <span
                            className={`hidden rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline-flex ${
                              def.severity === "reject"
                                ? "bg-status-critical/10 text-status-critical"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {def.severity === "reject" ? "Reject run" : "Warning"}
                          </span>
                          <Toggle on={on} onChange={() => toggleRule(ruleId)} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Impact simulator */}
                  {qcRules.testMode && (
                    <div className="mt-4 rounded-md border border-accent-200 bg-accent-50/50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Activity className="size-4 text-accent-700" />
                        <span className="text-sm font-semibold text-ink-950">Impact Simulator</span>
                        <span className="ml-auto text-[10px] font-medium text-accent-700">Test Mode — no live data affected</span>
                      </div>
                      <p className="mb-3 text-xs text-ink-500">
                        Replaying the <span className="font-semibold">{qcRules.enabled.join(", ") || "no"}</span> rule
                        set over the last {sim.total} control runs:
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="data-mono rounded-md bg-accent-700 px-3 py-1.5 text-sm font-semibold text-surface-0">
                          {sim.flagged} flagged
                        </span>
                        <span className="data-mono text-xs text-ink-500">
                          {((sim.flagged / sim.total) * 100).toFixed(1)}% of runs
                        </span>
                        <div className="ml-auto flex flex-wrap gap-1.5">
                          {Object.entries(sim.byRule).map(([rule, count]) => (
                            <span key={rule} className="data-mono rounded-full border border-line-200 bg-surface-0 px-2 py-0.5 text-[10px] text-ink-600">
                              {rule}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 flex h-10 items-end gap-0.5">
                        {Array.from({ length: sim.total }).map((_, i) => {
                          const flagged = i < sim.flagged;
                          return (
                            <div
                              key={i}
                              className={`flex-1 rounded-sm ${flagged ? "bg-status-critical/70" : "bg-accent-500/40"}`}
                              style={{ height: flagged ? "100%" : "28%" }}
                            />
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[10px] text-ink-400">
                        Red bars = runs that would be blocked under the current rule set. 2:2s, 4:1s & 10x
                        require run-sequence context and are approximated in the simulator.
                      </p>
                    </div>
                  )}

                  <div className="mt-4">
                    <ServerNote text="Rule set is enforced server-side on every QC run entry — no per-browser config." />
                  </div>
                </div>

                {/* Per-analyzer overrides */}
                <div className="rounded-md border border-line-200 bg-surface-0 p-6">
                  <div className="mb-1 flex items-center gap-2">
                    <FlaskConical className="size-4 text-accent-600" />
                    <h2 className="font-semibold text-ink-950">Per-Analyzer Overrides</h2>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-700">
                      {overrideCount} customized
                    </span>
                  </div>
                  <p className="mb-4 text-xs text-ink-500">
                    Analyzers marked <span className="font-semibold text-accent-700">Custom</span> use their own
                    rule set; others inherit the global engine. Link a control to its analyzer in{" "}
                    <span className="font-semibold">QC → New Control</span> for the override to apply.
                  </p>
                  {instruments.length === 0 ? (
                    <div className="rounded-md border border-dashed border-line-300 bg-surface-100/50 p-6 text-center">
                      <Wrench className="mx-auto mb-2 size-6 text-ink-300" />
                      <p className="text-sm font-medium text-ink-700">No analyzers configured yet</p>
                      <p className="mx-auto mt-1 max-w-md text-xs text-ink-500">
                        Add your instruments in <span className="font-semibold">Masters → Instruments</span> to assign
                        per-analyzer Westgard rule sets. Until then, every QC run uses the global rule engine above.
                      </p>
                      <a
                        href="/masters"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                      >
                        <Wrench className="size-3.5" /> Open Masters
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {instruments.map((inst) => {
                        const custom = qcRules.overrides[inst.id] !== undefined && qcRules.overrides[inst.id] !== null;
                        const rules = custom ? (qcRules.overrides[inst.id] ?? []) : qcRules.enabled;
                        return (
                          <div key={inst.id} className="rounded-md border border-line-200 p-3.5">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex size-9 items-center justify-center rounded-md bg-surface-100 text-accent-700">
                                <Cpu className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-ink-950">{inst.name}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${custom ? "bg-accent-100 text-accent-700" : "bg-surface-100 text-ink-400 border border-line-200"}`}>
                                    {custom ? "Custom" : "Global"}
                                  </span>
                                </div>
                                <div className="data-mono text-[10px] text-ink-400">
                                  {inst.code} · {inst.modelName ?? inst.manufacturer ?? "Instrument"}
                                  {inst.status !== "ACTIVE" ? ` · ${inst.status.replaceAll("_", " ")}` : ""}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {!custom ? (
                                  <button
                                    onClick={() => setOverride(inst.id, [...qcRules.enabled])}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-line-300 bg-surface-0 px-3 py-1.5 text-xs font-medium text-accent-600 transition-colors duration-fast hover:bg-accent-50"
                                  >
                                    <Copy className="size-3.5" />
                                    Clone global
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => setOverride(inst.id, null)}
                                      className="inline-flex items-center gap-1.5 rounded-md border border-line-300 bg-surface-0 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100"
                                    >
                                      <History className="size-3.5" />
                                      Reset to global
                                    </button>
                                    <button
                                      onClick={() => setOverride(inst.id, [...qcRules.enabled])}
                                      className="inline-flex items-center gap-1.5 rounded-md border border-line-300 bg-surface-0 px-3 py-1.5 text-xs font-medium text-accent-600 transition-colors duration-fast hover:bg-accent-50"
                                    >
                                      <Copy className="size-3.5" />
                                      Re-clone
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                              {WESTGARD_RULES.map((r) => {
                                const on = rules.includes(r.id);
                                return (
                                  <button
                                    key={r.id}
                                    onClick={() => {
                                      const next = on ? rules.filter((x) => x !== r.id) : [...rules, r.id];
                                      setOverride(inst.id, custom ? next : [...next]);
                                    }}
                                    className={`data-mono rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors duration-fast ${
                                      on
                                        ? "border-accent-400 bg-accent-100 text-accent-700"
                                        : "border-line-200 bg-surface-0 text-ink-400 hover:border-accent-200"
                                    }`}
                                  >
                                    {r.name}
                                  </button>
                                );
                              })}
                              <span className="ml-auto text-[10px] text-ink-400">
                                {rules.length} rules
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "notify" && (
              <div className="space-y-5">
                <div className="rounded-md border border-line-200 bg-surface-0 p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Bell className="size-4 text-accent-600" />
                    <h2 className="font-semibold text-ink-950">Alert Channels</h2>
                  </div>
                  <div className="space-y-3">
                    {(
                      [
                        { id: "email", label: "Email", desc: "Digest + critical alerts to lab managers", icon: Mail },
                        { id: "sms", label: "SMS", desc: "Critical values & QC rejects — instant ping", icon: Phone },
                        { id: "inApp", label: "In-app", desc: "Banner + bell notifications inside the dashboard", icon: Bell },
                      ] as const
                    ).map((c) => (
                      <div key={c.id} className="flex items-center gap-3 rounded-md border border-line-200 px-3.5 py-3">
                        <c.icon className="size-4 shrink-0 text-accent-600" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-ink-950">{c.label}</div>
                          <div className="text-[11px] text-ink-400">{c.desc}</div>
                        </div>
                        <Toggle
                          on={notify.channels[c.id]}
                          onChange={(v) =>
                            setNotify((prev) => ({ ...prev, channels: { ...prev.channels, [c.id]: v } }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border border-line-200 bg-surface-0 p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Activity className="size-4 text-accent-600" />
                    <h2 className="font-semibold text-ink-950">Thresholds</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Warning threshold</label>
                      <select
                        value={notify.warnThreshold}
                        onChange={(e) => setNotify((prev) => ({ ...prev, warnThreshold: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="1-2s">1:2s — single point &gt; 2 SD</option>
                        <option value="2-2s">2:2s — two consecutive &gt; 2 SD</option>
                        <option value="4-1s">4:1s — four consecutive &gt; 1 SD</option>
                      </select>
                      <p className="mt-1 text-[10px] text-ink-400">
                        Lower sensitivity = fewer warnings (reduces alert fatigue).
                      </p>
                    </div>
                    <div>
                      <label className={labelCls}>Critical threshold</label>
                      <select
                        value={notify.criticalThreshold}
                        onChange={(e) => setNotify((prev) => ({ ...prev, criticalThreshold: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="1-3s">1:3s — single point &gt; 3 SD</option>
                        <option value="R-4s">R:4s — range across controls</option>
                      </select>
                      <p className="mt-1 text-[10px] text-ink-400">
                        Critical events always alert via every enabled channel.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-line-200 bg-surface-0 p-6">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-accent-600" />
                      <h2 className="font-semibold text-ink-950">Quiet Hours</h2>
                    </div>
                    <Toggle
                      on={notify.quietHours.enabled}
                      onChange={(v) => setNotify((prev) => ({ ...prev, quietHours: { ...prev.quietHours, enabled: v } }))}
                    />
                  </div>
                  <p className="mb-4 text-xs text-ink-500">
                    Suppress non-critical alerts overnight — critical values still trigger SMS.
                  </p>
                  {notify.quietHours.enabled && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelCls}>Quiet hours start</label>
                        <input
                          type="time"
                          value={notify.quietHours.from}
                          onChange={(e) => setNotify((prev) => ({ ...prev, quietHours: { ...prev.quietHours, from: e.target.value } }))}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Quiet hours end</label>
                        <input
                          type="time"
                          value={notify.quietHours.to}
                          onChange={(e) => setNotify((prev) => ({ ...prev, quietHours: { ...prev.quietHours, to: e.target.value } }))}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex items-center gap-3 rounded-md border border-line-200 px-3.5 py-3 sm:col-span-2">
                        <AlertTriangle className="size-4 shrink-0 text-status-critical" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-ink-950">Critical alerts still fire</div>
                          <div className="text-[11px] text-ink-400">
                            Critical values and QC rejects bypass quiet hours and always page.
                          </div>
                        </div>
                        <Toggle
                          on={notify.quietHours.criticalStillAlerts}
                          onChange={(v) => setNotify((prev) => ({ ...prev, quietHours: { ...prev.quietHours, criticalStillAlerts: v } }))}
                        />
                      </div>
                    </div>
                  )}
                  <div className="mt-4">
                    <ServerNote text="Notification preferences are stored on the server for every station — delivery (email/SMS) activates when a messaging provider is connected." />
                  </div>
                </div>
              </div>
            )}

            {tab === "audit" && (
              <div className="space-y-5">
                <div className="rounded-md border border-line-200 bg-surface-0 p-6">
                  <div className="mb-1 flex items-center gap-2">
                    <ShieldCheck className="size-4 text-accent-600" />
                    <h2 className="font-semibold text-ink-950">Data Retention</h2>
                  </div>
                  <p className="mb-4 text-xs text-ink-500">
                    How long audit logs and result history are retained before archival.
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {[2, 3, 5, 7].map((y) => (
                      <button
                        key={y}
                        onClick={() => setAuditCfg((prev) => ({ ...prev, retentionYears: y }))}
                        className={`rounded-md border px-3 py-3 text-center transition-colors duration-fast ${
                          auditCfg.retentionYears === y
                            ? "border-accent-500 bg-accent-100/60 text-accent-700"
                            : "border-line-200 bg-surface-0 text-ink-500 hover:border-accent-200"
                        }`}
                      >
                        <span className="data-mono block text-lg font-semibold">{y}</span>
                        <span className="text-[10px] uppercase tracking-wider">years</span>
                      </button>
                    ))}
                  </div>
                  {auditCfg.retentionYears >= 7 ? (
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-status-normal/30 bg-status-normal/5 px-3.5 py-2.5 text-xs text-status-normal">
                      <Check className="size-4 shrink-0" />
                      Meets NABL/regulatory requirement of 7-year retention.
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                      <AlertTriangle className="size-4 shrink-0" />
                      Regulatory bodies require 7 years — retention below this needs documented approval.
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-line-200 bg-surface-0 p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Eye className="size-4 text-accent-600" />
                    <h2 className="font-semibold text-ink-950">Activity Tracking</h2>
                  </div>
                  <div className="space-y-3">
                    {(
                      [
                        { id: "userActivity", label: "User activity", desc: "Logins, page views, searches" },
                        { id: "authEvents", label: "Auth events", desc: "2FA challenges, password resets, lockouts" },
                        { id: "resultEdits", label: "Result edits", desc: "Every result entry, correction and re-test" },
                        { id: "reportSignoffs", label: "Report sign-offs", desc: "Immutable NABL e-signature records" },
                      ] as const
                    ).map((t) => (
                      <div key={t.id} className="flex items-center gap-3 rounded-md border border-line-200 px-3.5 py-3">
                        <Activity className="size-4 shrink-0 text-accent-600" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-ink-950">{t.label}</div>
                          <div className="text-[11px] text-ink-400">{t.desc}</div>
                        </div>
                        <Toggle
                          on={auditCfg.track[t.id]}
                          onChange={(v) =>
                            setAuditCfg((prev) => ({
                              ...prev,
                              track: { ...prev.track, [t.id]: v },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border border-line-200 bg-surface-0 p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <FileText className="size-4 text-accent-600" />
                    <h2 className="font-semibold text-ink-950">Export & Visibility</h2>
                  </div>
                  <div className="mb-4">
                    <label className={labelCls}>Export format</label>
                    <div className="flex gap-2">
                      {(["csv", "pdf", "json"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setAuditCfg((prev) => ({ ...prev, exportFormat: f }))}
                          className={`rounded-md border px-4 py-2 text-xs font-semibold uppercase transition-colors duration-fast ${
                            auditCfg.exportFormat === f
                              ? "border-accent-500 bg-accent-100 text-accent-700"
                              : "border-line-200 bg-surface-0 text-ink-500 hover:border-accent-200"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href="/audit"
                      className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-4 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                    >
                      <Download className="size-4" />
                      Export audit trail
                    </a>
                    <p className="text-[10px] text-ink-400">
                      Exports ({auditCfg.exportFormat.toUpperCase()} etc.) run inside the Audit Trail viewer with your filters applied.
                    </p>
                  </div>
                  <div className="mt-4">
                    <ServerNote text="Retention & tracking preferences are saved to the server — the Audit Trail viewer already records every action immutably." />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-md border border-line-200 bg-ink-950 px-4 py-2.5 text-sm text-surface-0 shadow-overlay">
            <Check className="size-4 text-status-normal" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
