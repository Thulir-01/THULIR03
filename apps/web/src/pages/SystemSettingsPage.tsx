import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  ShieldCheck,
  Download,
  Plus,
  Loader2,
  Search,
  X,
  Check,
  Lock,
  KeyRound,
  Activity,
  UserPlus,
  AlertTriangle,
  Fingerprint,
  Clock,
  History,
  BadgeCheck,
  UserX,
  ShieldAlert,
  CheckCircle2,
  Pencil,
  Ban,
  Trash2,
  Info,
  Mail,
  IdCard,
  Building2,
  ChevronRight,
} from "lucide-react";
import {
  listUsers,
  listRoles,
  listPermissions,
  setRolePermissions,
  seedDefaultPermissions,
  createUser,
  updateUser,
  deactivateUser,
  getAuditLogs,
  type AdminUser,
  type Role,
  type Permission,
  type AuditLogEntry,
  type UpdateUserData,
} from "../lib/api-client";
import PageHeader from "../components/ui/PageHeader";
import { LoadingState } from "../components/ui/PageStates";
import StatCard from "../components/ui/StatCard";

/* ─── Role colour coding (conventional, never decorative) ─────────── */
const ROLE_STYLES: Record<string, string> = {
  lab_admin: "bg-accent-100 text-accent-700 border-accent-200",
  lab_manager: "bg-blue-50 text-blue-700 border-blue-200",
  pathologist: "bg-purple-50 text-purple-700 border-purple-200",
  technician: "bg-amber-50 text-amber-700 border-amber-200",
  receptionist: "bg-green-50 text-green-700 border-green-200",
  patient: "bg-gray-100 text-gray-600 border-gray-200",
  referrer: "bg-gray-100 text-gray-600 border-gray-200",
};

function roleLabel(slug: string | null | undefined) {
  if (!slug) return "Unassigned";
  const map: Record<string, string> = {
    lab_admin: "Lab Admin",
    lab_manager: "Lab Manager",
    pathologist: "Pathologist",
    technician: "Technician",
    receptionist: "Receptionist",
    patient: "Patient",
    referrer: "Referrer",
  };
  return map[slug] ?? slug;
}

function RoleBadge({ slug }: { slug: string | null | undefined }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        ROLE_STYLES[slug ?? ""] ?? "bg-surface-100 text-ink-600 border-line-200"
      }`}
    >
      {roleLabel(slug)}
    </span>
  );
}

function timeAgo(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 90) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ─── Default role templates (quick-select for onboarding) ─────────── */
const ROLE_TEMPLATES: Record<string, string[]> = {
  lab_admin: [
    "patients:create", "patients:read", "patients:update", "patients:delete",
    "orders:create", "orders:read", "orders:update", "orders:delete",
    "samples:create", "samples:read", "samples:update", "samples:delete",
    "results:read", "results:update", "results:verify", "results:approve",
    "invoices:create", "invoices:read", "invoices:update",
    "users:create", "users:read", "users:update", "users:delete",
    "roles:read", "roles:update",
    "reports:read", "reports:create",
    "inventory:create", "inventory:read", "inventory:update", "inventory:delete",
    "instruments:read", "instruments:update",
  ],
  lab_manager: [
    "patients:create", "patients:read", "patients:update",
    "orders:create", "orders:read", "orders:update",
    "samples:create", "samples:read", "samples:update",
    "results:read", "results:verify",
    "invoices:create", "invoices:read", "invoices:update",
    "users:read",
    "roles:read",
    "reports:read",
    "inventory:read", "inventory:update",
    "instruments:read",
  ],
  pathologist: [
    "patients:read",
    "orders:read",
    "samples:read",
    "results:read", "results:verify", "results:approve",
    "invoices:read",
    "reports:read", "reports:create",
    "instruments:read",
  ],
  technician: [
    "patients:read",
    "orders:read", "orders:update",
    "samples:read", "samples:update",
    "results:read", "results:update", "results:verify",
    "instruments:read", "instruments:update",
  ],
  receptionist: [
    "patients:create", "patients:read", "patients:update",
    "orders:create", "orders:read",
    "samples:create", "samples:read",
    "invoices:create", "invoices:read",
  ],
};

/* ─── Role cards for the Add/Edit modal ────────────────────────────── */
const ROLE_CARDS: { slug: string; blurb: string }[] = [
  { slug: "lab_admin", blurb: "Full system control — users, roles, billing and every module" },
  { slug: "lab_manager", blurb: "Day-to-day oversight, verification and reporting" },
  { slug: "pathologist", blurb: "Verify & sign off results, produce clinical reports" },
  { slug: "technician", blurb: "Result entry and slide verification at the bench" },
  { slug: "receptionist", blurb: "Patient registration, order entry and billing desk" },
];

/* ─── Segregation-of-duties conflicts (CLIA §493.1449) ────────────── */
const CONFLICT_RULES: { a: string; b: string; message: string }[] = [
  {
    a: "results:verify",
    b: "results:approve",
    message:
      "Same person can verify and approve results — CLIA requires a second reviewer for sign-off.",
  },
  {
    a: "results:create",
    b: "results:approve",
    message:
      "Same person can enter and approve results — results should be approved by a different reviewer.",
  },
];

function findConflicts(checked: Set<string>, permissions: Permission[]): string[] {
  const keys = new Set(
    permissions.filter((p) => checked.has(p.id)).map((p) => `${p.resource}:${p.action}`),
  );
  return CONFLICT_RULES.filter((r) => keys.has(r.a) && keys.has(r.b)).map((r) => r.message);
}

function genTempPassword() {
  return `Thulir@${Math.random().toString(36).slice(2, 8)}`;
}

/* ─── Edit Permissions modal ───────────────────────────────────────── */
function PermissionsModal({
  role,
  permissions,
  onClose,
  onSaved,
}: {
  role: Role;
  permissions: Permission[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(
    () =>
      new Set(
        role.rolePermissions
          .filter((rp) => rp.isAllowed)
          .map((rp) => rp.permissionId),
      ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const list = map.get(p.resource) ?? [];
      list.push(p);
      map.set(p.resource, list);
    }
    return [...map.entries()];
  }, [permissions]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyTemplate = (slug: string) => {
    setTouched(slug);
    const keys = ROLE_TEMPLATES[slug] ?? [];
    const allowed = new Set(
      permissions.filter((p) => keys.includes(`${p.resource}:${p.action}`)).map((p) => p.id),
    );
    setChecked(allowed);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await setRolePermissions(role.id, [...checked]);
      onSaved();
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Failed to save permissions.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-surface-0 shadow-overlay">
        <div className="flex items-center justify-between border-b border-line-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-accent-100 text-accent-700">
              <ShieldCheck className="size-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-950">
                Edit Permissions — {role.name}
              </h3>
              <p className="text-xs text-ink-400">
                Granular access for the <span className="font-mono">{role.slug}</span> role
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-600 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {permissions.length === 0 ? (
            <div className="rounded-md border border-status-borderline/30 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4" />
                No permissions defined yet
              </div>
              <p className="mt-1 text-xs text-amber-700">
                Run “Seed default permissions” from the Security centre to create
                the standard permission catalogue, then configure this role.
              </p>
            </div>
          ) : (
            <>
              {/* Role templates */}
              <div className="mb-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  Apply role template
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["lab_admin", "lab_manager", "pathologist", "technician", "receptionist"] as const).map(
                    (slug) => (
                      <button
                        key={slug}
                        onClick={() => applyTemplate(slug)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors duration-fast ${
                          touched === slug
                            ? "border-accent-500 bg-accent-100 text-accent-700"
                            : "border-line-300 bg-surface-0 text-ink-600 hover:border-accent-300 hover:text-accent-700"
                        }`}
                      >
                        {roleLabel(slug)}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() => {
                      setTouched(null);
                      setChecked(new Set(permissions.map((p) => p.id)));
                    }}
                    className="rounded-full border border-line-300 bg-surface-0 px-3 py-1 text-[11px] font-semibold text-ink-600 hover:border-accent-300 hover:text-accent-700 transition-colors duration-fast"
                  >
                    Grant all
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {grouped.map(([resource, list]) => {
                  const onCount = list.filter((p) => checked.has(p.id)).length;
                  const allOn = onCount === list.length;
                  return (
                    <div
                      key={resource}
                      className="rounded-md border border-line-200 overflow-hidden"
                    >
                      <div className="flex items-center justify-between bg-surface-100/70 px-4 py-2">
                        <span className="text-xs font-semibold capitalize text-ink-950">
                          {resource}
                        </span>
                        <button
                          onClick={() =>
                            setChecked((prev) => {
                              const next = new Set(prev);
                              for (const p of list) {
                                if (allOn) next.delete(p.id);
                                else next.add(p.id);
                              }
                              return next;
                            })
                          }
                          className="text-[11px] font-medium text-accent-600 hover:text-accent-700"
                        >
                          {allOn ? "Clear all" : "Select all"}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 px-4 py-3 sm:grid-cols-3">
                        {list.map((p) => {
                          const on = checked.has(p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => toggle(p.id)}
                              className={`flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-left text-xs transition-colors duration-fast ${
                                on
                                  ? "border-accent-300 bg-accent-100/60 text-accent-700"
                                  : "border-line-200 bg-surface-0 text-ink-600 hover:border-line-300"
                              }`}
                            >
                              <span
                                className={`flex size-4 shrink-0 items-center justify-center rounded-sm border ${
                                  on
                                    ? "border-accent-500 bg-accent-700 text-surface-0"
                                    : "border-line-300 bg-surface-0"
                                }`}
                              >
                                {on && <Check className="size-3" />}
                              </span>
                              <span className="capitalize">{p.action}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line-200 px-6 py-4">
          <span className="text-[11px] text-ink-400">
            {checked.size} of {permissions.length} permissions granted
          </span>
          <div className="flex items-center gap-3">
            {error && (
              <span className="text-xs text-status-critical">{error}</span>
            )}
            <button
              onClick={onClose}
              className="rounded-md border border-line-300 bg-surface-0 px-4 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-surface-100"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-5 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save Permissions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Add / Edit User modal (tabs: Profile · Access & Role · Security) ─ */
function AddEditUserModal({
  user,
  users,
  roles,
  permissions,
  onClose,
  onSaved,
}: {
  user: AdminUser | null; // null → create mode
  users: AdminUser[];
  roles: Role[];
  permissions: Permission[];
  onClose: () => void;
  onSaved: (u: AdminUser) => void;
}) {
  const isEdit = !!user;
  const [tab, setTab] = useState<"profile" | "access" | "security">("profile");
  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    password: "",
  });
  const [roleId, setRoleId] = useState<string>(user?.role?.id ?? "");
  const [checked, setChecked] = useState<Set<string>>(() => {
    const role = roles.find((r) => r.id === user?.role?.id);
    return new Set(
      role?.rolePermissions.filter((rp) => rp.isAllowed).map((rp) => rp.permissionId) ?? [],
    );
  });
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState("");
  const [showReset, setShowReset] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  /* Duplicate detection — suggests existing users while typing an email */
  const duplicate = users.find(
    (u) =>
      u.email.toLowerCase() === form.email.trim().toLowerCase() &&
      u.id !== user?.id,
  );

  const selectedRole = roles.find((r) => r.id === roleId) ?? null;

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const list = map.get(p.resource) ?? [];
      list.push(p);
      map.set(p.resource, list);
    }
    return [...map.entries()];
  }, [permissions]);

  const conflicts = useMemo(
    () => findConflicts(checked, permissions),
    [checked, permissions],
  );

  const togglePerm = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectRole = (id: string) => {
    setRoleId(id);
    const role = roles.find((r) => r.id === id);
    setChecked(
      new Set(
        role?.rolePermissions.filter((rp) => rp.isAllowed).map((rp) => rp.permissionId) ?? [],
      ),
    );
  };

  const submit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError("Name and email are required");
      return;
    }
    if (duplicate) {
      setError("That email already belongs to another user — edit that account instead.");
      return;
    }
    if (!roleId) {
      setError("Assign a role before saving");
      return;
    }
    setSaving(true);
    setError("");
    try {
      /* Sync the selected role's permission set when the admin changed it */
      const currentAllowed = new Set(
        selectedRole?.rolePermissions.filter((rp) => rp.isAllowed).map((rp) => rp.permissionId) ??
          [],
      );
      const permChanged =
        permissions.length > 0 &&
        (checked.size !== currentAllowed.size ||
          [...checked].some((id) => !currentAllowed.has(id)));
      if (permChanged && selectedRole) {
        await setRolePermissions(selectedRole.id, [...checked]);
      }

      if (isEdit && user) {
        const body: UpdateUserData = {};
        if (form.firstName.trim() !== user.firstName) body.firstName = form.firstName.trim();
        if (form.lastName.trim() !== user.lastName) body.lastName = form.lastName.trim();
        if (form.phone.trim() !== (user.phone ?? "")) body.phone = form.phone.trim();
        if (roleId !== user.role?.id) body.roleId = roleId;
        if (form.password.trim()) body.password = form.password.trim();
        const updated = await updateUser(user.id, body);
        onSaved({
          ...user,
          ...updated,
          role: roles.find((r) => r.id === roleId) ?? user.role,
        });
      } else {
        const created = await createUser({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          password: form.password.trim() || genTempPassword(),
          roleId,
        });
        onSaved(created);
      }
      onClose();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Failed to save user.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!user) return;
    if (
      !window.confirm(
        `Deactivate ${user.firstName} ${user.lastName}? Access is revoked instantly while history and audit trail are preserved.`,
      )
    )
      return;
    setDeactivating(true);
    setError("");
    try {
      await deactivateUser(user.id);
      onSaved({ ...user, isActive: false });
      onClose();
    } catch {
      setError("Failed to deactivate user.");
    } finally {
      setDeactivating(false);
    }
  };

  const reactivate = async () => {
    if (!user) return;
    setDeactivating(true);
    setError("");
    try {
      await updateUser(user.id, { isActive: true });
      onSaved({ ...user, isActive: true });
      onClose();
    } catch {
      setError("Failed to reactivate user.");
    } finally {
      setDeactivating(false);
    }
  };

  const inputCls =
    "w-full rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-sm text-ink-950 transition-all duration-fast focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 placeholder:text-ink-300";
  const labelCls = "mb-1 block text-xs font-medium text-ink-600";

  const TABS: { key: "profile" | "access" | "security"; label: string; icon: typeof UserPlus }[] = [
    { key: "profile", label: "Profile", icon: IdCard },
    { key: "access", label: "Access & Role", icon: ShieldCheck },
    { key: "security", label: "Security", icon: Fingerprint },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-surface-0 shadow-overlay">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-accent-100 text-accent-700">
              {isEdit ? <Pencil className="size-4.5" /> : <UserPlus className="size-4.5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-950">
                {isEdit ? "Edit User" : "Add User"}
              </h3>
              <p className="text-xs text-ink-400">
                {isEdit
                  ? `${user!.firstName} ${user!.lastName} · ${user!.email}`
                  : "Onboard staff with role templates and granular permissions"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-600 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-line-200 px-6 pt-3">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors duration-fast ${
                  active
                    ? "border-accent-700 text-accent-700"
                    : "border-transparent text-ink-400 hover:text-ink-600"
                }`}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-xs text-status-critical">
              {error}
            </div>
          )}

          {/* ─── Tab: Profile ─── */}
          {tab === "profile" && (
            <div className="space-y-4">
              {duplicate && (
                <div className="flex items-start gap-2.5 rounded-md border border-amber-300/60 bg-amber-50 px-3.5 py-3 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Duplicate email detected</p>
                    <p className="mt-0.5 text-amber-700">
                      {form.email.trim()} already belongs to{" "}
                      <span className="font-medium">
                        {duplicate.firstName} {duplicate.lastName}
                      </span>{" "}
                      ({duplicate.role?.name ?? "no role"}). Edit that account instead to avoid
                      duplicate records.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    First name <span className="text-status-critical">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    className={inputCls}
                    placeholder="Priya"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Last name <span className="text-status-critical">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    className={inputCls}
                    placeholder="Rajendran"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  Email <span className="text-status-critical">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className={`${inputCls} pl-9`}
                    placeholder="priya@thulir03.com"
                  />
                </div>
                {form.email.trim().length >= 3 && !duplicate && (
                  <p className="mt-1 text-[11px] text-ink-400">
                    No existing account uses this email — safe to create.
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className={inputCls}
                  placeholder="+91 98765 43210"
                />
              </div>

              {isEdit && user && (
                <div className="grid grid-cols-2 gap-3 rounded-md border border-line-200 bg-surface-100/50 p-3.5">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-ink-400">
                      Department / Branch
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-950">
                      <Building2 className="size-3.5 text-accent-600" />
                      {user.branch?.name ?? "Not assigned"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-ink-400">
                      Employee ID
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 font-mono text-sm text-ink-600">
                      <IdCard className="size-3.5 text-ink-300" />
                      HR-{user.id.slice(0, 6).toUpperCase()}
                    </p>
                  </div>
                </div>
              )}

              <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
                <Info className="size-3.5" />
                HR employee-ID integration not configured — employee details are not auto-filled.
              </p>
            </div>
          )}

          {/* ─── Tab: Access & Role ─── */}
          {tab === "access" && (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  Role <span className="text-status-critical">*</span>
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ROLE_CARDS.map((c) => {
                    const role = roles.find((r) => r.slug === c.slug);
                    const active = roleId === role?.id;
                    const permsCount = role?.rolePermissions.filter((rp) => rp.isAllowed).length ?? 0;
                    return (
                      <button
                        key={c.slug}
                        onClick={() => role && selectRole(role.id)}
                        disabled={!role}
                        className={`relative rounded-md border p-3 text-left transition-all duration-fast ${
                          active
                            ? "border-accent-500 bg-accent-50 shadow-sm"
                            : "border-line-200 bg-surface-0 hover:border-accent-300 hover:bg-surface-100/60"
                        } ${!role ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-ink-950">
                            {roleLabel(c.slug)}
                          </span>
                          <span
                            className={`flex size-4 items-center justify-center rounded-sm border ${
                              active
                                ? "border-accent-600 bg-accent-700 text-surface-0"
                                : "border-line-300"
                            }`}
                          >
                            {active && <Check className="size-3" />}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-ink-400">
                          {c.blurb}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500 border border-line-200">
                          <ShieldCheck className="size-3" />
                          {permsCount} permissions
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {permissions.length > 0 && selectedRole && (
                <div className="rounded-md border border-line-200 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-line-200 bg-surface-100/70 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-accent-600" />
                      <span className="text-xs font-semibold text-ink-950">
                        Granular permissions — {selectedRole.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-ink-400">
                      {checked.size} / {permissions.length} granted
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto px-4 py-3">
                    <div className="space-y-3">
                      {grouped.map(([resource, list]) => {
                        const onCount = list.filter((p) => checked.has(p.id)).length;
                        const allOn = onCount === list.length;
                        return (
                          <div key={resource}>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-[11px] font-semibold capitalize text-ink-950">
                                {resource}
                              </span>
                              <button
                                onClick={() =>
                                  setChecked((prev) => {
                                    const next = new Set(prev);
                                    for (const p of list) {
                                      if (allOn) next.delete(p.id);
                                      else next.add(p.id);
                                    }
                                    return next;
                                  })
                                }
                                className="text-[10px] font-medium text-accent-600 hover:text-accent-700"
                              >
                                {allOn ? "Clear all" : "Select all"}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                              {list.map((p) => {
                                const on = checked.has(p.id);
                                return (
                                  <button
                                    key={p.id}
                                    onClick={() => togglePerm(p.id)}
                                    className={`flex items-center gap-2 rounded-sm border px-2 py-1.5 text-left text-[11px] transition-colors duration-fast ${
                                      on
                                        ? "border-accent-300 bg-accent-100/60 text-accent-700"
                                        : "border-line-200 bg-surface-0 text-ink-600 hover:border-line-300"
                                    }`}
                                  >
                                    <span
                                      className={`flex size-3.5 shrink-0 items-center justify-center rounded-sm border ${
                                        on
                                          ? "border-accent-500 bg-accent-700 text-surface-0"
                                          : "border-line-300 bg-surface-0"
                                      }`}
                                    >
                                      {on && <Check className="size-2.5" />}
                                    </span>
                                    <span className="capitalize">{p.action}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 border-t border-line-200 bg-surface-100/40 px-4 py-2.5">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-ink-300" />
                    <p className="text-[10px] leading-relaxed text-ink-400">
                      Permission changes apply to the{" "}
                      <span className="font-semibold text-ink-600">{selectedRole.name}</span> role
                      and affect everyone holding it — toggling is a role-level change, not
                      per-user.
                    </p>
                  </div>
                </div>
              )}

              {permissions.length === 0 && (
                <div className="rounded-md border border-status-borderline/30 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="size-4" />
                    No permissions defined yet
                  </div>
                  <p className="mt-1 text-[11px] text-amber-700">
                    Seed default permissions from the Security centre, then configure role access
                    here.
                  </p>
                </div>
              )}

              {conflicts.length > 0 && (
                <div className="space-y-2">
                  {conflicts.map((msg, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-md border border-amber-300/60 bg-amber-50 px-3.5 py-3 text-xs text-amber-800"
                      title="Segregation of duties risk"
                    >
                      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                      <div>
                        <p className="font-semibold">Permission conflict detected</p>
                        <p className="mt-0.5 text-amber-700">{msg}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Tab: Security ─── */}
          {tab === "security" && (
            <div className="space-y-4">
              {/* MFA */}
              <div className="rounded-md border border-line-200 overflow-hidden">
                <div className="flex items-center justify-between border-b border-line-200 bg-surface-100/50 px-4 py-2.5">
                  <span className="flex items-center gap-2 text-xs font-semibold text-ink-950">
                    <Fingerprint className="size-4 text-accent-600" />
                    Multi-Factor Authentication
                  </span>
                  {user ? (
                    user.totpEnabled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-normal/10 px-2 py-0.5 text-[10px] font-semibold text-status-normal">
                        <BadgeCheck className="size-3" />
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-critical/10 px-2 py-0.5 text-[10px] font-semibold text-status-critical">
                        <Ban className="size-3" />
                        Not enabled
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-ink-400">Set after first login</span>
                  )}
                </div>
                <div className="px-4 py-3">
                  {!user?.totpEnabled ? (
                    <div className="flex items-start gap-2.5 rounded-sm border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <p>
                        <span className="font-semibold">Compliance risk:</span> this account has no
                        second factor. {isEdit ? "The user" : "They"} must self-enrol 2FA (TOTP app)
                        from their profile before full system access is granted. 2FA cannot be
                        force-enabled by an admin without a user-verified code.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-ink-400">
                      2FA is enforced on this account — sign-in requires a one-time TOTP code.
                    </p>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="rounded-md border border-line-200 overflow-hidden">
                <div className="flex items-center justify-between border-b border-line-200 bg-surface-100/50 px-4 py-2.5">
                  <span className="flex items-center gap-2 text-xs font-semibold text-ink-950">
                    <KeyRound className="size-4 text-accent-600" />
                    {isEdit ? "Password reset" : "Temporary password"}
                  </span>
                  {isEdit && (
                    <button
                      onClick={() => setShowReset((s) => !s)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-600 hover:text-accent-700"
                    >
                      <ChevronRight className={`size-3 transition-transform duration-fast ${showReset ? "rotate-90" : ""}`} />
                      {showReset ? "Hide" : "Reset password"}
                    </button>
                  )}
                </div>
                <div className="px-4 py-3">
                  {isEdit && !showReset ? (
                    <p className="text-[11px] leading-relaxed text-ink-400">
                      Admins never view existing passwords. Use “Reset password” to assign a new
                      temporary password that the user changes on next login.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={form.password}
                          onChange={(e) => set("password", e.target.value)}
                          className={`${inputCls} font-mono`}
                          placeholder={isEdit ? "New temporary password" : "Auto-generated if left blank"}
                        />
                        <button
                          type="button"
                          onClick={() => set("password", genTempPassword())}
                          className="shrink-0 rounded-md border border-line-300 bg-surface-0 px-3 py-2 text-xs font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100"
                          title="Generate a strong temporary password"
                        >
                          Generate
                        </button>
                      </div>
                      <p className="text-[11px] text-ink-400">
                        Share securely out-of-band — the user is forced to change it on first login.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Account activity */}
              {isEdit && user && (
                <div className="rounded-md border border-line-200 overflow-hidden">
                  <div className="border-b border-line-200 bg-surface-100/50 px-4 py-2.5">
                    <span className="flex items-center gap-2 text-xs font-semibold text-ink-950">
                      <History className="size-4 text-accent-600" />
                      Account activity
                    </span>
                  </div>
                  <dl className="divide-y divide-line-200 text-[11px]">
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <dt className="text-ink-400">Last login</dt>
                      <dd className="font-mono text-ink-950">
                        {user.lastLoginAt
                          ? `${timeAgo(user.lastLoginAt)} · ${new Date(user.lastLoginAt).toLocaleString()}`
                          : "Never"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <dt className="text-ink-400">Created</dt>
                      <dd className="font-mono text-ink-950">
                        {new Date(user.createdAt).toLocaleString()}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <dt className="text-ink-400">Status</dt>
                      <dd>
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-status-normal/10 px-2 py-0.5 font-semibold text-status-normal">
                            <span className="size-1.5 rounded-full bg-status-normal" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-status-critical/10 px-2 py-0.5 font-semibold text-status-critical">
                            <span className="size-1.5 rounded-full bg-status-critical" />
                            Inactive
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* Danger zone */}
              {isEdit && user && (
                <div className="rounded-md border border-status-critical/25 overflow-hidden">
                  <div className="border-b border-status-critical/25 bg-status-critical/5 px-4 py-2.5">
                    <span className="flex items-center gap-2 text-xs font-semibold text-status-critical">
                      <ShieldAlert className="size-4" />
                      Danger zone
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="max-w-sm">
                        <p className="text-xs font-medium text-ink-950">
                          {user.isActive ? "Deactivate account" : "Reactivate account"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-400">
                          {user.isActive
                            ? "Instantly revokes access while preserving all historical data and the audit trail for legal compliance."
                            : "Restores sign-in access; history and audit trail are retained."}
                        </p>
                      </div>
                      <button
                        onClick={user.isActive ? deactivate : reactivate}
                        disabled={deactivating}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors duration-fast disabled:opacity-50 ${
                          user.isActive
                            ? "bg-status-critical/10 text-status-critical hover:bg-status-critical/20"
                            : "bg-status-normal/10 text-status-normal hover:bg-status-normal/20"
                        }`}
                      >
                        {deactivating ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : user.isActive ? (
                          <UserX className="size-3.5" />
                        ) : (
                          <CheckCircle2 className="size-3.5" />
                        )}
                        {user.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-200 pt-3">
                      <p className="text-[11px] text-ink-400">
                        Permanent deletion is not available — records are soft-deleted to preserve
                        compliance history.
                      </p>
                      <button
                        disabled
                        title="Soft-delete only — records preserved for audit compliance"
                        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-line-200 px-3 py-1.5 text-[11px] font-medium text-ink-300"
                      >
                        <Trash2 className="size-3.5" />
                        Delete permanently
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-line-200 px-6 py-4">
          <div className="text-[11px] text-ink-400">
            {tab === "access" && selectedRole ? (
              <span>
                {checked.size} permissions for{" "}
                <span className="font-semibold text-ink-600">{selectedRole.name}</span>
              </span>
            ) : (
              <span>
                {isEdit ? "Editing" : "Creating"}{" "}
                {roleId ? roleLabel(selectedRole?.slug) : "— no role selected"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-md border border-line-300 bg-surface-0 px-4 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-surface-100"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-5 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-800 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isEdit ? (
                <Check className="size-4" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────────────── */
export default function SystemSettingsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [permsRole, setPermsRole] = useState<Role | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [u, r, p, a] = await Promise.all([
        listUsers(),
        listRoles(),
        listPermissions(),
        getAuditLogs({ limit: 6 }),
      ]);
      setUsers(u);
      setRoles(r);
      setPermissions(p);
      setAudit(a);
    } catch {
      setError("Failed to load system settings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.role?.name ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

  const mfaEnabled = users.filter((u) => u.totpEnabled).length;
  const activeUsers = users.filter((u) => u.isActive);

  const inactiveThreshold = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const inactive = users.filter(
    (u) =>
      u.isActive &&
      (!u.lastLoginAt ||
        (new Date(u.lastLoginAt).getTime() < inactiveThreshold &&
          new Date(u.createdAt).getTime() < inactiveThreshold)),
  );

  const noMfa = users.filter((u) => u.isActive && !u.totpEnabled);

  const seed = async () => {
    setSeeding(true);
    setError("");
    try {
      await seedDefaultPermissions();
      const p = await listPermissions();
      setPermissions(p);
      setToast("Default permissions seeded — configure roles now.");
    } catch {
      setError("Failed to seed permissions.");
    } finally {
      setSeeding(false);
    }
  };

  const exportCsv = () => {
    const header = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Role",
      "Branch",
      "MFA",
      "Status",
      "Last Login",
      "Created",
    ];
    const rows = users.map((u) => [
      u.firstName,
      u.lastName,
      u.email,
      u.phone ?? "",
      roleLabel(u.role?.slug),
      u.branch?.name ?? "",
      u.totpEnabled ? "Enabled" : "Not enabled",
      u.isActive ? "Active" : "Inactive",
      u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : "Never",
      new Date(u.createdAt).toISOString(),
    ]);
    const csv = [header, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thulir03-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("User list exported as CSV.");
  };

  const deactivate = async (u: AdminUser) => {
    if (!confirm(`Deactivate ${u.firstName} ${u.lastName}? Access is revoked instantly while history is preserved.`)) return;
    setError("");
    try {
      await deactivateUser(u.id);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: false } : x)));
      setToast(`${u.firstName} ${u.lastName} deactivated.`);
    } catch {
      setError("Failed to deactivate user.");
    }
  };

  const reactivate = async (u: AdminUser) => {
    setError("");
    try {
      await updateUser(u.id, { isActive: true });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: true } : x)));
      setToast(`${u.firstName} ${u.lastName} reactivated.`);
    } catch {
      setError("Failed to reactivate user.");
    }
  };

  const extendAccess = async (u: AdminUser) => {
    setError("");
    try {
      await updateUser(u.id, { lastLoginAt: new Date() });
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, lastLoginAt: new Date().toISOString() } : x)),
      );
      setToast(`Access extended for ${u.firstName} ${u.lastName}.`);
    } catch {
      setError("Failed to extend access.");
    }
  };

  const auditLabel = (a: AuditLogEntry) => {
    const action = (a.action ?? "").toUpperCase();
    if (action.startsWith("DELETE")) return "removed";
    if (action.startsWith("POST")) return "created";
    if (action.startsWith("PUT") || action.startsWith("PATCH")) return "changed";
    return action.toLowerCase();
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-surface-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <LoadingState label="Loading system settings…" rows={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <PageHeader
            title="System Settings & Users"
            subtitle="Manage staff access, roles & permissions, and security compliance"
            actions={
              <>
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-2 rounded-md border border-line-300 bg-surface-0 px-3.5 py-2 text-sm font-medium text-ink-600 transition-colors duration-fast hover:bg-surface-100"
                >
                  <Download className="size-4" />
                  Export User List
                </button>
                <button
                  onClick={() => {
                    setEditUser(null);
                    setAddOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-3.5 py-2 text-sm font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-800"
                >
                  <Plus className="size-4" />
                  Add User
                </button>
              </>
            }
          />
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
            {error}
          </div>
        )}

        {/* KPI row */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Total Users"
            value={String(users.length)}
            icon={Users}
            accent="accent"
            sub={`${activeUsers.length} active · ${users.length - activeUsers.length} inactive`}
          />
          <StatCard
            label="MFA Enabled"
            value={String(mfaEnabled)}
            icon={Fingerprint}
            accent="green"
            sub={`${noMfa.length} active accounts without 2FA`}
          />
          <StatCard
            label="Dormant Accounts"
            value={String(inactive.length)}
            icon={Clock}
            accent="amber"
            sub="No login in 90+ days"
          />
          <StatCard
            label="Roles"
            value={String(roles.length)}
            icon={ShieldCheck}
            accent="blue"
            sub={`${permissions.length} permissions defined`}
          />
        </div>

        {/* Main grid: RBAC matrix + security/audit side panel */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ─── RBAC Matrix ─── */}
          <div className="lg:col-span-2">
            <div className="rounded-md border border-line-200 bg-surface-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-200 px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold text-ink-950">
                    Role-Based Access Matrix
                  </h2>
                  <p className="text-xs text-ink-400">
                    Assign roles and fine-tune granular permissions per user
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-300" />
                  <input
                    type="text"
                    placeholder="Search users, emails, roles…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-56 rounded-md border border-line-200 bg-surface-0 py-1.5 pl-8 pr-3 text-xs text-ink-950 transition-all duration-fast focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 placeholder:text-ink-300"
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-md bg-accent-100 text-accent-700">
                    <Users className="size-6" />
                  </div>
                  <p className="text-sm text-ink-400">
                    {search ? "No users match your search." : "No users found."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line-200 bg-surface-100/60 text-left text-[11px] uppercase tracking-wider text-ink-400">
                        <th className="px-5 py-2.5 font-medium">User</th>
                        <th className="px-3 py-2.5 font-medium">Role</th>
                        <th className="px-3 py-2.5 font-medium">MFA</th>
                        <th className="px-3 py-2.5 font-medium">Last Login</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-200">
                      {filtered.map((u) => {
                        const role = roles.find((r) => r.id === u.role?.id) ?? null;
                        return (
                          <tr
                            key={u.id}
                            className={`transition-colors duration-fast hover:bg-surface-100/40 ${
                              !u.isActive ? "opacity-55" : ""
                            }`}
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700 text-xs font-semibold">
                                  {u.firstName[0]}
                                  {u.lastName[0]}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-ink-950">
                                    {u.firstName} {u.lastName}
                                  </div>
                                  <div className="truncate text-xs text-ink-400">
                                    {u.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <RoleBadge slug={u.role?.slug} />
                            </td>
                            <td className="px-3 py-3">
                              {u.totpEnabled ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-normal">
                                  <BadgeCheck className="size-3.5" />
                                  On
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs text-ink-400">
                                  <KeyRound className="size-3.5" />
                                  Off
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-ink-500">
                              {u.lastLoginAt ? (
                                <span title={new Date(u.lastLoginAt).toLocaleString()}>
                                  {timeAgo(u.lastLoginAt)}
                                </span>
                              ) : (
                                <span className="text-ink-300">Never</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {u.isActive ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-normal/10 px-2 py-0.5 text-[11px] font-semibold text-status-normal">
                                  <span className="size-1.5 rounded-full bg-status-normal" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-critical/10 px-2 py-0.5 text-[11px] font-semibold text-status-critical">
                                  <span className="size-1.5 rounded-full bg-status-critical" />
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setEditUser(u)}
                                  title="Edit user — profile, role & security"
                                  className="inline-flex items-center gap-1.5 rounded-md border border-line-200 px-2.5 py-1.5 text-[11px] font-medium text-ink-600 transition-colors duration-fast hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700"
                                >
                                  <Pencil className="size-3.5" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => role && setPermsRole(role)}
                                  title="Edit permissions"
                                  className="inline-flex items-center gap-1.5 rounded-md border border-line-200 px-2.5 py-1.5 text-[11px] font-medium text-accent-600 transition-colors duration-fast hover:border-accent-300 hover:bg-accent-50"
                                >
                                  <ShieldCheck className="size-3.5" />
                                  Permissions
                                </button>
                                {u.isActive ? (
                                  <button
                                    onClick={() => deactivate(u)}
                                    title="Deactivate — revoke access now"
                                    className="inline-flex items-center gap-1 rounded-md border border-line-200 px-2.5 py-1.5 text-[11px] font-medium text-status-critical transition-colors duration-fast hover:border-status-critical/40 hover:bg-status-critical/5"
                                  >
                                    <UserX className="size-3.5" />
                                    Deactivate
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => reactivate(u)}
                                    className="inline-flex items-center gap-1 rounded-md border border-line-200 px-2.5 py-1.5 text-[11px] font-medium text-status-normal transition-colors duration-fast hover:border-status-normal/40 hover:bg-status-normal/5"
                                  >
                                    <CheckCircle2 className="size-3.5" />
                                    Reactivate
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ─── Right rail: Security centre + activity ─── */}
          <div className="space-y-6">
            {/* Security & compliance */}
            <div className="rounded-md border border-line-200 bg-surface-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-line-200 px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold text-ink-950">
                    Security & Compliance
                  </h2>
                  <p className="text-xs text-ink-400">
                    2FA status · dormant accounts
                  </p>
                </div>
                {permissions.length === 0 && (
                  <button
                    onClick={seed}
                    disabled={seeding}
                    className="inline-flex items-center gap-1.5 rounded-md border border-status-borderline/40 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 transition-colors duration-fast hover:bg-amber-100 disabled:opacity-50"
                  >
                    {seeding ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ShieldAlert className="size-3.5" />
                    )}
                    Seed Permissions
                  </button>
                )}
              </div>

              <div className="divide-y divide-line-200">
                {/* 2FA */}
                <div className="px-5 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold text-ink-950">
                      <Fingerprint className="size-4 text-accent-600" />
                      Multi-Factor Authentication
                    </span>
                    <span className="text-xs text-ink-400">
                      {mfaEnabled}/{users.length} enabled
                    </span>
                  </div>
                  {noMfa.length === 0 ? (
                    <p className="text-xs text-ink-400">
                      Every active account has 2FA enabled. ✓
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {noMfa.slice(0, 4).map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between gap-2 rounded-sm border border-line-200 bg-surface-100/50 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium text-ink-950">
                              {u.firstName} {u.lastName}
                            </div>
                            <div className="truncate text-[11px] text-ink-400">
                              {u.email}
                            </div>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-critical/10 px-2 py-0.5 text-[10px] font-semibold text-status-critical">
                            <Lock className="size-3" />
                            No 2FA
                          </span>
                        </div>
                      ))}
                      {noMfa.length > 4 && (
                        <p className="text-[11px] text-ink-400">
                          +{noMfa.length - 4} more without 2FA
                        </p>
                      )}
                      <p className="pt-1 text-[11px] leading-relaxed text-ink-400">
                        Enforce 2FA for non-compliant accounts — users self-enrol
                        from their profile with a TOTP app.
                      </p>
                    </div>
                  )}
                </div>

                {/* Inactive / dormant */}
                <div className="px-5 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold text-ink-950">
                      <Clock className="size-4 text-amber-600" />
                      Dormant accounts
                    </span>
                    <span className="text-xs text-ink-400">
                      {inactive.length} · 90+ days
                    </span>
                  </div>
                  {inactive.length === 0 ? (
                    <p className="text-xs text-ink-400">
                      No dormant accounts — all staff active.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {inactive.slice(0, 4).map((u) => (
                        <div
                          key={u.id}
                          className="rounded-sm border border-line-200 bg-surface-100/50 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-medium text-ink-950">
                                {u.firstName} {u.lastName}
                              </div>
                              <div className="truncate text-[11px] text-ink-400">
                                {u.email}
                              </div>
                            </div>
                            <span className="shrink-0 font-mono text-[10px] text-ink-400">
                              {u.lastLoginAt ? `${timeAgo(u.lastLoginAt)}` : "never"}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => extendAccess(u)}
                              className="inline-flex items-center gap-1 rounded-sm border border-line-300 bg-surface-0 px-2 py-1 text-[10px] font-semibold text-accent-600 transition-colors duration-fast hover:border-accent-300 hover:bg-accent-50"
                            >
                              <CheckCircle2 className="size-3" />
                              Extend
                            </button>
                            <button
                              onClick={() => deactivate(u)}
                              className="inline-flex items-center gap-1 rounded-sm border border-line-300 bg-surface-0 px-2 py-1 text-[10px] font-semibold text-status-critical transition-colors duration-fast hover:border-status-critical/40 hover:bg-status-critical/5"
                            >
                              <UserX className="size-3" />
                              Deactivate
                            </button>
                          </div>
                        </div>
                      ))}
                      {inactive.length > 4 && (
                        <p className="text-[11px] text-ink-400">
                          +{inactive.length - 4} more dormant accounts
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent admin activity */}
            <div className="rounded-md border border-line-200 bg-surface-0 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line-200 px-5 py-4">
                <History className="size-4 text-accent-600" />
                <div>
                  <h2 className="text-sm font-bold text-ink-950">
                    Recent Admin Activity
                  </h2>
                  <p className="text-xs text-ink-400">
                    Last {audit.length} significant actions
                  </p>
                </div>
              </div>
              <div className="px-5 py-3">
                {audit.length === 0 ? (
                  <p className="py-6 text-center text-xs text-ink-400">
                    No audit activity yet.
                  </p>
                ) : (
                  <ol className="relative space-y-4 border-l border-line-200 pl-4">
                    {audit.map((a) => (
                      <li key={a.id} className="relative">
                        <span className="absolute -left-[21px] top-1 flex size-2.5 items-center justify-center rounded-full border-2 border-surface-0 bg-accent-500" />
                        <p className="text-xs text-ink-950">
                          <span className="font-semibold">{a.actorName ?? "System"}</span>{" "}
                          <span className="text-ink-600">
                            {auditLabel(a)} {a.entity}
                          </span>
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-400">
                          <Activity className="size-3" />
                          {a.action} · {timeAgo(a.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-md border border-line-200 bg-ink-950 px-4 py-2.5 text-sm text-surface-0 shadow-overlay">
              <CheckCircle2 className="size-4 text-status-normal" />
              {toast}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {permsRole && (
        <PermissionsModal
          role={permsRole}
          permissions={permissions}
          onClose={() => setPermsRole(null)}
          onSaved={() => {
            setToast(`Permissions updated for ${permsRole.name}.`);
            listRoles().then(setRoles).catch(() => {});
          }}
        />
      )}
      {(addOpen || editUser) && (
        <AddEditUserModal
          user={editUser}
          users={users}
          roles={roles}
          permissions={permissions}
          onClose={() => {
            setAddOpen(false);
            setEditUser(null);
          }}
          onSaved={(u) => {
            setUsers((prev) => {
              const exists = prev.some((x) => x.id === u.id);
              return exists ? prev.map((x) => (x.id === u.id ? u : x)) : [u, ...prev];
            });
            setToast(
              `${u.firstName} ${u.lastName} ${editUser ? "updated" : "created — invitation ready"}.`,
            );
            setAddOpen(false);
            setEditUser(null);
          }}
        />
      )}
    </div>
  );
}
