import { useEffect, useMemo, useRef, useState, memo } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard,
  FilePlus2,
  ClipboardList,
  Beaker,
  Users,
  History,
  LogOut,
  Search,
  FlaskConical,
  ChevronsLeft,
  ChevronsRight,
  CornerDownLeft,
  User,
  Plus,
  Settings2,
  ClipboardSignature,
  ShieldCheck,
  BadgeCheck,
  Smartphone,
  TrendingUp,
  Building2,
  Settings,
  Boxes,
  UserCog,
  Bell,
} from "lucide-react";
import { useAuth } from "../lib/useAuth";

// Operations — the patient/sample journey, in the order it happens:
// Dashboard → Registration → Patients → Orders → Result Entry, then the
// role-gated Verify (technician) and Approvals (pathologist) queues.
const OPERATIONS_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/patient-registration", label: "Registration", icon: FilePlus2 },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/results", label: "Result Entry", icon: Beaker },
  { to: "/qc", label: "QC", icon: FlaskConical },
];

const QUICK_ACTIONS = [
  { to: "/patients/new", label: "Add Patient", icon: Plus },
  { to: "/parties/new", label: "Add Party", icon: Plus },
];

// Masters screens — one consolidated panel with tabs; only shown to
// lab admin / manager / pathologist roles
const MASTERS_ITEMS = [
  { to: "/masters", label: "Masters", icon: Settings2 },
];

const MASTER_ROLES = new Set(["lab_admin", "lab_manager", "pathologist"]);

// Staff (NABL sign-off details) — management screen for admin / manager
const STAFF_ITEMS = [
  { to: "/staff", label: "Staff", icon: ClipboardSignature },
];

const STAFF_ROLES = new Set(["lab_admin", "lab_manager"]);

// Approvals — pathologist queue of verified orders awaiting sign-off
const APPROVALS_ITEMS = [
  { to: "/approvals", label: "Pathologist", icon: ShieldCheck },
  { to: "/mobile-review", label: "Mobile Review", icon: Smartphone },
];

const APPROVALS_ROLES = new Set(["pathologist", "lab_admin", "lab_manager"]);

// Verify — technician queue of completed orders awaiting result confirmation
const VERIFY_ITEMS = [
  { to: "/verify", label: "Technician", icon: BadgeCheck },
];

const VERIFY_ROLES = new Set(["technician", "lab_admin", "lab_manager"]);

// Analytics — business reporting (revenue, test volumes, referrer payouts).
// Named Analytics (not Reports) so it can't be confused with the printable
// per-order clinical report.
const ANALYTICS_ITEMS = [
  { to: "/reports", label: "Analytics", icon: TrendingUp },
];

const ANALYTICS_ROLES = new Set(["lab_admin", "lab_manager"]);

// Parties — hospitals, corporates, insurers, labs & consultants with rate cards
const PARTIES_ITEMS = [
  { to: "/parties", label: "Parties", icon: Building2 },
];

const PARTIES_ROLES = new Set(["lab_admin", "lab_manager"]);

// Settings — central hub: lab details, QC rules, notifications,
// integrations & compliance (org fields print on reports & invoices)
const SETTINGS_ITEMS = [
  { to: "/general-settings", label: "Settings", icon: Settings },
];

const SETTINGS_ROLES = new Set(["lab_admin", "lab_manager"]);

// System — admin-only user management, RBAC & security compliance
const SYSTEM_ITEMS = [
  { to: "/system-settings", label: "System", icon: UserCog },
];

const SYSTEM_ROLES = new Set(["lab_admin"]);

// Inventory — reagents & consumables stock, suppliers, test links
const INVENTORY_ITEMS = [
  { to: "/inventory", label: "Inventory", icon: Boxes },
];

const INVENTORY_ROLES = new Set(["lab_admin", "lab_manager"]);

// Setup — configuration & master data, visually separated from the daily
// patient workflow (mirrors SENAITE's LIMS Setup area).
const SETUP_ITEMS = [{ to: "/audit", label: "Audit Trail", icon: History }];

function roleLabel(role?: string) {
  if (role === "lab_admin") return "Lab Admin";
  if (role === "pathologist") return "Pathologist";
  if (role === "technician") return "Technician";
  return role;
}

type NavItem = { to: string; label: string; icon: any };

const CommandPalette = memo(function CommandPalette({
  open,
  onClose,
  navItems,
  go,
}: {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  go: (to: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      // small timeout to ensure the input is mounted
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const paletteItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [
      ...navItems.map((n) => ({ ...n, group: "Navigate" })),
      ...QUICK_ACTIONS.map((a) => ({ ...a, group: "Actions" })),
    ];
    if (!q) return all;
    return all.filter(
      (i) => i.label.toLowerCase().includes(q) || i.to.toLowerCase().includes(q)
    );
  }, [query, navItems]);

  const onPaletteKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, paletteItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = paletteItems[cursor];
      if (item) {
        onClose();
        go(item.to);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/30 px-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-md border border-line-200 bg-surface-0 shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line-200 px-3.5">
          <Search className="size-4 shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onPaletteKey}
            placeholder="Jump to page or action…"
            className="h-11 w-full bg-transparent text-sm text-ink-950 placeholder:text-ink-400 focus:outline-none"
          />
          <kbd className="rounded-sm border border-line-200 bg-surface-100 px-1.5 py-0.5 text-[10px] text-ink-400">
            ESC
          </kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-1.5">
          {paletteItems.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-ink-400">
              No matches for “{query}”
            </div>
          )}
          {paletteItems.map((item, i) => (
            <button
              key={item.to}
              onClick={() => {
                onClose();
                go(item.to);
              }}
              onMouseEnter={() => setCursor(i)}
              className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm transition-colors duration-fast ${
                i === cursor ? "bg-accent-100 text-accent-700" : "text-ink-600"
              }`}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-ink-400">
                {item.group}
              </span>
              {i === cursor && (
                <CornerDownLeft className="size-3.5 text-ink-400" />
              )}
            </button>
          ))}
        </div>
        <div className="border-t border-line-200 px-3.5 py-2 text-[11px] text-ink-400">
          ↑↓ to navigate · ↵ to open
        </div>
      </div>
    </div>
  );
});

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => (localStorage.getItem("thulir-rail") === "open" ? false : true)
  );
  const [paletteOpen, setPaletteOpen] = useState(false);

  const canManageMasters = MASTER_ROLES.has(user?.role ?? "");
  const canManageStaff = STAFF_ROLES.has(user?.role ?? "");
  const canApprove = APPROVALS_ROLES.has(user?.role ?? "");
  const canVerify = VERIFY_ROLES.has(user?.role ?? "");
  const canViewAnalytics = ANALYTICS_ROLES.has(user?.role ?? "");
  const canManageParties = PARTIES_ROLES.has(user?.role ?? "");
  const canManageSettings = SETTINGS_ROLES.has(user?.role ?? "");
  const canManageSystem = SYSTEM_ROLES.has(user?.role ?? "");
  const canManageInventory = INVENTORY_ROLES.has(user?.role ?? "");

  const operationsNav = useMemo(
    () => [
      ...OPERATIONS_ITEMS,
      ...(canVerify ? VERIFY_ITEMS : []),
      ...(canApprove ? APPROVALS_ITEMS : []),
    ],
    [canVerify, canApprove]
  );

  const setupNav = useMemo(
    () => [
      ...(canManageMasters ? MASTERS_ITEMS : []),
      ...(canManageParties ? PARTIES_ITEMS : []),
      ...(canManageStaff ? STAFF_ITEMS : []),
      ...SETUP_ITEMS,
      ...(canViewAnalytics ? ANALYTICS_ITEMS : []),
      ...(canManageSettings ? SETTINGS_ITEMS : []),
      ...(canManageSystem ? SYSTEM_ITEMS : []),
      ...(canManageInventory ? INVENTORY_ITEMS : []),
    ],
    [
      canManageMasters,
      canManageParties,
      canManageStaff,
      canViewAnalytics,
      canManageSettings,
      canManageSystem,
      canManageInventory,
    ]
  );

  // Flat list for the Cmd+K palette — search finds every page in one place,
  // regardless of which sidebar section it lives in.
  const navItems = useMemo(
    () => [...operationsNav, ...setupNav],
    [operationsNav, setupNav]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleRail = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("thulir-rail", next ? "collapsed" : "open");
      return next;
    });
  };

  const railWidth = collapsed ? "w-14" : "w-50";
  const contentPad = collapsed ? "md:pl-14" : "md:pl-50";

  return (
    <div className="h-screen w-screen overflow-hidden bg-surface-100 flex flex-col">
      {/* ─── Icon Rail ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden md:flex flex-col border-r border-line-200 bg-surface-0 transition-[width] duration-180 ease-precise ${railWidth}`}
      >
        {/* Brand */}
        <div
          className={`flex h-14 items-center gap-2.5 border-b border-line-200 px-3 shrink-0 ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <div className="size-8 shrink-0 rounded-md bg-accent-700 text-surface-0 flex items-center justify-center">
            <FlaskConical className="size-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink-950 leading-tight tracking-wide">
                THULIR03
              </div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-ink-400">
                Lab LIMS
              </div>
            </div>
          )}
        </div>

        {/* Nav — two labeled sections: Operations (daily workflow) and
            Setup (master data / configuration) */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {!collapsed && (
            <div className="mb-1 px-2.5 text-[10px] uppercase tracking-[0.14em] text-ink-400">
              Operations
            </div>
          )}
          {operationsNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-sm px-2.5 py-2 text-[13px] font-medium transition-colors duration-fast ${
                  collapsed ? "justify-center px-0" : ""
                } ${
                  isActive
                    ? "bg-accent-100 text-accent-700"
                    : "text-ink-600 hover:bg-surface-100 hover:text-ink-950"
                }`
              }
            >
              <item.icon className="size-4.5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}

          {!collapsed && (
            <div className="mt-4 border-t border-line-200 pt-3">
              <div className="mb-1 px-2.5 text-[10px] uppercase tracking-[0.14em] text-ink-400">
                Setup
              </div>
            </div>
          )}
          {setupNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-sm px-2.5 py-2 text-[13px] font-medium transition-colors duration-fast ${
                  collapsed ? "justify-center px-0" : ""
                } ${
                  isActive
                    ? "bg-accent-100 text-accent-700"
                    : "text-ink-600 hover:bg-surface-100 hover:text-ink-950"
                }`
              }
            >
              <item.icon className="size-4.5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: palette trigger + user */}
        <div className="border-t border-line-200 p-2 space-y-1 shrink-0">
          <button
            onClick={() => setPaletteOpen(true)}
            title="Command palette (Ctrl+K)"
            className={`flex w-full items-center gap-3 rounded-sm px-2.5 py-2 text-[13px] text-ink-600 hover:bg-surface-100 hover:text-ink-950 transition-colors duration-fast ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <Search className="size-4.5 shrink-0" />
            {!collapsed && (
              <span className="flex-1 text-left truncate">Search…</span>
            )}
            {!collapsed && (
              <kbd className="rounded-sm border border-line-200 bg-surface-100 px-1.5 py-0.5 text-[10px] text-ink-400">
                ⌘K
              </kbd>
            )}
          </button>

          <div
            className={`flex items-center gap-2.5 rounded-sm px-2.5 py-2 ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <div className="size-7 shrink-0 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center">
              <User className="size-3.5" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-ink-950 truncate">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-[10px] text-ink-400 truncate">
                  {roleLabel(user?.role)}
                </div>
              </div>
            )}
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              title="Sign out"
              className={`text-ink-400 hover:text-status-critical transition-colors duration-fast ${
                collapsed ? "" : "hidden"
              }`}
            >
              <LogOut className="size-4" />
            </button>
          </div>

          {/* Rail toggle */}
          <button
            onClick={toggleRail}
            title={collapsed ? "Expand rail" : "Collapse rail"}
            className="flex w-full items-center justify-center gap-2 rounded-sm py-1.5 text-ink-400 hover:bg-surface-100 hover:text-ink-600 transition-colors duration-fast"
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <>
                <ChevronsLeft className="size-4" />
                <span className="text-[10px] uppercase tracking-wider">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line-200 bg-surface-0 px-4">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-md bg-accent-700 text-surface-0 flex items-center justify-center">
            <FlaskConical className="size-4" />
          </div>
          <span className="text-[13px] font-semibold text-ink-950 tracking-wide">
            THULIR03
          </span>
        </div>
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex items-center gap-1.5 rounded-sm border border-line-200 px-2.5 py-1.5 text-xs text-ink-600"
        >
          <Search className="size-3.5" /> Search
        </button>
      </div>

      {/* Content */}
      <main className={`${contentPad} flex-1 min-h-0 overflow-hidden pt-0`}>{children}</main>

      {/* Command Palette (moved to its own memoized component) */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} navItems={navItems} go={(to) => {
        setPaletteOpen(false);
        navigate(to);
      }} />
    </div>
  );
}
