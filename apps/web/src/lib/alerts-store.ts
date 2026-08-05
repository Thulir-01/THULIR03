// ─── Shared alert model + cross-module alert store (localStorage) ────────
// The Alerts & Notifications center is the system inbox. Other modules
// (Dashboard, Review) inject events here — e.g. a rejected result raises an
// investigation alert — creating the closed loop: Review → Alerts → Audit.

export type Severity = "critical" | "warning" | "info";
export type AlertStatus = "unread" | "in_progress" | "acknowledged" | "resolved";
export type AlertKind = "qc" | "maintenance" | "inventory" | "system" | "info";

export interface AlertComment {
  id: string;
  author: string;
  text: string;
  at: string;
}

export interface QcSeries {
  mean: number;
  sd: number;
  unit: string;
  points: number[];
  flaggedIndex: number;
}

export interface AlertItem {
  id: string;
  severity: Severity;
  kind: AlertKind;
  status: AlertStatus;
  title: string;
  detail: string;
  analyzer?: string;
  lot?: string;
  rule?: string;
  test?: string;
  createdAt: string;
  roles: string[];
  demo: boolean;
  qc?: QcSeries;
  history?: number[];
}

const EXTRA_KEY = "thulir03-alerts-extra";
const MAX_EXTRA = 60;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Alerts injected by other modules (e.g. a rejected result under investigation). */
export function loadExtraAlerts(): AlertItem[] {
  const items = loadJson<AlertItem[]>(EXTRA_KEY, []);
  return Array.isArray(items) ? items : [];
}

export function saveExtraAlerts(items: AlertItem[]) {
  saveJson(EXTRA_KEY, items);
}

export type ExtraAlertInput = Omit<AlertItem, "id" | "status" | "createdAt" | "roles" | "demo"> & {
  id?: string;
  status?: AlertStatus;
  createdAt?: string;
  roles?: string[];
  demo?: boolean;
};

/** Push a new alert into the shared inbox (upsert by id, newest first). Returns the alert. */
export function pushExtraAlert(input: ExtraAlertInput): AlertItem {
  const items = loadExtraAlerts();
  const alert: AlertItem = {
    status: "unread",
    createdAt: new Date().toISOString(),
    roles: ["technician", "pathologist", "lab_admin", "lab_manager"],
    demo: false,
    ...input,
    id: input.id ?? `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  const next = [alert, ...items.filter((a) => a.id !== alert.id)].slice(0, MAX_EXTRA);
  saveExtraAlerts(next);
  return alert;
}
