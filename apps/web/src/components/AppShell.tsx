import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
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
  CornerDownLeft,
  User,
  Plus,
  ClipboardSignature,
  ShieldCheck,
  BadgeCheck,
  TrendingUp,
  Building2,
  Boxes,
  UserCog,
  Bell,
  Table2,
  Package,
  TestTube,
  Cpu,
  Briefcase,
  Ruler,
  CreditCard,
  Ban,
  BadgePercent,
  Percent,
  Layers,
  Truck,
  AlertTriangle,
  Link2,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { loadExtraAlerts } from "../lib/alerts-store";
import { getInventoryAlerts } from "../lib/api-client";
import { preloadHeavyPages } from "../lib/preload";
import {
  ContextActionsProvider,
  ContextToolbar,
  type ContextAction,
} from "../lib/context-actions";

// ─── Navigation model ─────────────────────────────────────────────────────
// The shell is an MS Office-style ribbon: a row of top-level tabs, each of
// which reveals a strip of grouped icon-buttons below it. Role gating is the
// same as the old rail — a technician never sees Masters/Parties/Settings,
// and the verify/approvals queues only appear for the roles that use them.

type NavItem = { to: string; label: string; icon: LucideIcon };
// Subtle per-group tints so operators can recognize ribbon actions at a
// glance (decorative only — clinical status colors are never used here).
type GroupTint = "accent" | "blue" | "amber" | "green" | "ink";
type RibbonGroup = { label: string; tint?: GroupTint; items: NavItem[] };
type TabId =
  | "operations"
  | "masters"
  | "parties"
  | "staff"
  | "inventory"
  | "analytics"
  | "settings"
  | "audit";
type RibbonTab = { id: TabId; label: string; defaultTo: string; groups: RibbonGroup[] };

// Operations — the patient/sample journey, in the order it happens.
// Alerts is not a tab item — it lives as the bell icon at the top edge.
const OPERATIONS_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patient-registration", label: "Registration", icon: FilePlus2 },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/results", label: "Result Entry", icon: Beaker },
  { to: "/qc", label: "QC", icon: FlaskConical },
];

// Role-gated queue buttons (appended to the Operations ribbon when allowed)
const QUEUE_ITEMS: NavItem[] = [
  { to: "/verify", label: "Technician", icon: BadgeCheck },
  { to: "/approvals", label: "Pathologist", icon: ShieldCheck },
];

// Masters is a full ribbon of its own: two test-catalog sections, five
// master-configuration editors and six lookup catalogues. Each sub-item is
// its own icon-button in the strip — the content area no longer needs tabs.
// URL slugs must stay in sync with the section map in MastersPage.tsx.
const MASTERS_TESTS_ITEMS: NavItem[] = [
  { to: "/masters/parameters", label: "Parameters", icon: Table2 },
  { to: "/masters/packages", label: "Packages", icon: Package },
];
const MASTERS_CATALOG_ITEMS: NavItem[] = [
  { to: "/masters/hospitals", label: "Hospitals", icon: Building2 },
  { to: "/masters/sample-types", label: "Sample Types", icon: TestTube },
  { to: "/masters/methods", label: "Methods", icon: FlaskConical },
  { to: "/masters/instruments", label: "Instruments", icon: Cpu },
  { to: "/masters/clients", label: "Clients", icon: Briefcase },
];
const MASTERS_LOOKUP_ITEMS: NavItem[] = [
  { to: "/masters/containers", label: "Containers", icon: Boxes },
  { to: "/masters/units", label: "Units", icon: Ruler },
  { to: "/masters/payment-modes", label: "Payments", icon: CreditCard },
  { to: "/masters/rejection-reasons", label: "Rejects", icon: Ban },
  { to: "/masters/discount-schemes", label: "Discounts", icon: BadgePercent },
  { to: "/masters/tax-rates", label: "Tax Rates", icon: Percent },
];

const PARTIES_ITEMS: NavItem[] = [{ to: "/parties", label: "Parties", icon: Building2 }];
const STAFF_ITEMS: NavItem[] = [{ to: "/staff", label: "Staff", icon: ClipboardSignature }];

// Inventory sub-sections live in the ribbon strip, not as content tabs.
const INVENTORY_ITEMS: NavItem[] = [
  { to: "/inventory/items", label: "Items", icon: Package },
  { to: "/inventory/stock", label: "Stock", icon: Layers },
  { to: "/inventory/suppliers", label: "Suppliers", icon: Truck },
  { to: "/inventory/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/inventory/links", label: "Test Links", icon: Link2 },
];

const ANALYTICS_ITEMS: NavItem[] = [{ to: "/reports", label: "Analytics", icon: TrendingUp }];

// Settings is a four-section hub — each section is a ribbon group.
const SETTINGS_GROUPS: RibbonGroup[] = [
  { label: "Lab", tint: "accent", items: [{ to: "/general-settings/lab", label: "Lab Info", icon: Building2 }] },
  { label: "Rules", tint: "green", items: [{ to: "/general-settings/qc", label: "QC Rules", icon: SlidersHorizontal }] },
  { label: "Channels", tint: "blue", items: [{ to: "/general-settings/notify", label: "Notify", icon: Bell }] },
  { label: "Compliance", tint: "ink", items: [{ to: "/general-settings/audit", label: "Audit", icon: ShieldCheck }] },
];

const SYSTEM_ITEMS: NavItem[] = [{ to: "/system-settings", label: "System", icon: UserCog }];
const AUDIT_ITEMS: NavItem[] = [{ to: "/audit", label: "Audit Trail", icon: History }];

const QUICK_ACTIONS = [
  { to: "/patients/new", label: "Add Patient", icon: Plus },
  { to: "/parties/new", label: "Add Party", icon: Plus },
];

const MASTER_ROLES = new Set(["lab_admin", "lab_manager", "pathologist"]);
const STAFF_ROLES = new Set(["lab_admin", "lab_manager"]);
const APPROVALS_ROLES = new Set(["pathologist", "lab_admin", "lab_manager"]);
const VERIFY_ROLES = new Set(["technician", "lab_admin", "lab_manager"]);
const ANALYTICS_ROLES = new Set(["lab_admin", "lab_manager"]);
const PARTIES_ROLES = new Set(["lab_admin", "lab_manager"]);
const SETTINGS_ROLES = new Set(["lab_admin", "lab_manager"]);
const SYSTEM_ROLES = new Set(["lab_admin"]);
const INVENTORY_ROLES = new Set(["lab_admin", "lab_manager"]);

function roleLabel(role?: string) {
  if (role === "lab_admin") return "Lab Admin";
  if (role === "pathologist") return "Pathologist";
  if (role === "technician") return "Technician";
  return role;
}

// Route → ribbon tab (first prefix match decides the active tab).
const TAB_ROUTES: { id: TabId; prefixes: string[] }[] = [
  {
    id: "operations",
    prefixes: [
      "/dashboard",
      "/patient-registration",
      "/registration",
      "/patients",
      "/orders",
      "/results",
      "/qc",
      "/verify",
      "/approvals",
      "/mobile-review",
      "/print",
      "/alerts",
    ],
  },
  { id: "masters", prefixes: ["/masters"] },
  { id: "parties", prefixes: ["/parties"] },
  { id: "staff", prefixes: ["/staff"] },
  { id: "inventory", prefixes: ["/inventory"] },
  { id: "analytics", prefixes: ["/reports"] },
  { id: "settings", prefixes: ["/settings", "/general-settings", "/system-settings"] },
  { id: "audit", prefixes: ["/audit"] },
];

function activeTabId(pathname: string): TabId {
  for (const t of TAB_ROUTES) {
    if (t.prefixes.some((p) => pathname.startsWith(p))) return t.id;
  }
  return "operations";
}

// Route → human screen name for the context toolbar (longest prefix first).
const SCREEN_NAMES: { prefix: string; name: string }[] = [
  { prefix: "/masters/parameters", name: "Test Parameters" },
  { prefix: "/masters/packages", name: "Test Packages" },
  { prefix: "/inventory/stock", name: "Stock Ledger" },
  { prefix: "/inventory/suppliers", name: "Suppliers" },
  { prefix: "/inventory/alerts", name: "Stock Alerts" },
  { prefix: "/inventory/links", name: "Test Links" },
  { prefix: "/general-settings/lab", name: "General Lab Info" },
  { prefix: "/general-settings/qc", name: "QC Rules" },
  { prefix: "/general-settings/notify", name: "Notifications" },
  { prefix: "/general-settings/audit", name: "Audit & Compliance" },
  { prefix: "/patient-registration", name: "Patient Registration" },
  { prefix: "/registration", name: "Registration" },
  { prefix: "/patients/new", name: "New Patient" },
  { prefix: "/patients/", name: "Patient Detail" },
  { prefix: "/patients", name: "Patients" },
  { prefix: "/print/report/", name: "Report · Print View" },
  { prefix: "/print/invoice/", name: "Invoice · Print View" },
  { prefix: "/orders/", name: "Order Detail" },
  { prefix: "/orders", name: "Orders" },
  { prefix: "/results", name: "Result Entry" },
  { prefix: "/qc", name: "Quality Control" },
  { prefix: "/verify", name: "Verify Queue" },
  { prefix: "/approvals/", name: "Pathologist Review" },
  { prefix: "/approvals", name: "Approvals Queue" },
  { prefix: "/mobile-review", name: "Mobile Review" },
  { prefix: "/masters/", name: "Masters" },
  { prefix: "/masters", name: "Masters" },
  { prefix: "/parties/new", name: "New Party" },
  { prefix: "/parties/", name: "Party" },
  { prefix: "/parties", name: "Parties" },
  { prefix: "/staff", name: "Staff & Sign-off" },
  { prefix: "/inventory", name: "Inventory" },
  { prefix: "/reports", name: "Analytics" },
  { prefix: "/general-settings", name: "Settings" },
  { prefix: "/system-settings", name: "System & Security" },
  { prefix: "/settings", name: "Settings" },
  { prefix: "/audit", name: "Audit Trail" },
  { prefix: "/alerts", name: "Alerts Center" },
  { prefix: "/dashboard", name: "Dashboard" },
];

function screenNameFor(pathname: string): string {
  for (const s of SCREEN_NAMES) {
    if (pathname.startsWith(s.prefix)) return s.name;
  }
  return "Workspace";
}

// Hide scrollbars on the scrollable tab / ribbon rows (kept minimal).
const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const GROUP_TINTS: Record<GroupTint, string> = {
  accent: "bg-accent-100 text-accent-700",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  green: "bg-green-50 text-status-normal",
  ink: "bg-surface-100 text-ink-600",
};

// ─── Command palette ─────────────────────────────────────────────────────

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

// ─── Alerts bell (top edge) ─────────────────────────────────────────────
// Alerts is not a ribbon item — it lives as a bell icon in the top bar so
// it is always one tap away, on every screen size.
const AlertsBell = memo(function AlertsBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [openCount, setOpenCount] = useState(0);

  const refresh = useCallback(() => {
    const extra = loadExtraAlerts().filter(
      (a) => a.status === "unread" || a.status === "in_progress"
    ).length;
    void getInventoryAlerts()
      .then((inv) => {
        const invCount =
          (inv.expired?.length ?? 0) + (inv.expiring?.length ?? 0) + (inv.lowStock?.length ?? 0);
        setOpenCount(extra + invCount);
      })
      .catch(() => setOpenCount(extra));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, location.pathname]);

  return (
    <button
      onClick={() => navigate("/alerts")}
      title="Alerts & Notifications"
      className="relative flex size-9 items-center justify-center rounded-full border border-line-200 bg-surface-0 text-ink-600 transition-colors duration-fast hover:border-accent-300 hover:text-accent-700"
    >
      <Bell className="size-4" />
      {openCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-critical px-1 text-[9px] font-bold text-surface-0">
          {openCount > 99 ? "99+" : openCount}
        </span>
      )}
    </button>
  );
});

// ─── Shell ───────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [contextActions, setContextActions] = useState<ContextAction[]>([]);

  const role = user?.role ?? "";
  const canMasters = MASTER_ROLES.has(role);
  const canParties = PARTIES_ROLES.has(role);
  const canStaff = STAFF_ROLES.has(role);
  const canInventory = INVENTORY_ROLES.has(role);
  const canAnalytics = ANALYTICS_ROLES.has(role);
  const canSettings = SETTINGS_ROLES.has(role);
  const canSystem = SYSTEM_ROLES.has(role);
  const canVerify = VERIFY_ROLES.has(role);
  const canApprove = APPROVALS_ROLES.has(role);

  // Tabs are role-gated, mirroring the old rail's grouping exactly.
  const tabs = useMemo<RibbonTab[]>(() => {
    const opsGroups: RibbonGroup[] = [
      { label: "Home", tint: "accent", items: [OPERATIONS_ITEMS[0]] },
      { label: "Patient", tint: "blue", items: [OPERATIONS_ITEMS[1], OPERATIONS_ITEMS[2]] },
      { label: "Orders", tint: "amber", items: [OPERATIONS_ITEMS[3]] },
      { label: "Results", tint: "green", items: [OPERATIONS_ITEMS[4], OPERATIONS_ITEMS[5]] },
    ];
    if (canVerify || canApprove) {
      opsGroups.push({
        label: "Queues",
        tint: "ink",
        items: [
          ...(canVerify ? [QUEUE_ITEMS[0]] : []),
          ...(canApprove ? [QUEUE_ITEMS[1]] : []),
        ],
      });
    }
    const settingsGroups: RibbonGroup[] = [...SETTINGS_GROUPS];
    if (canSystem) settingsGroups.push({ label: "System", tint: "accent", items: [...SYSTEM_ITEMS] });

    const result: RibbonTab[] = [
      { id: "operations", label: "Operations", defaultTo: "/dashboard", groups: opsGroups },
    ];
    if (canMasters)
      result.push({
        id: "masters",
        label: "Masters",
        defaultTo: "/masters/parameters",
        groups: [
          { label: "Tests", tint: "accent", items: [...MASTERS_TESTS_ITEMS] },
          { label: "Catalog", tint: "blue", items: [...MASTERS_CATALOG_ITEMS] },
          { label: "Lookups", tint: "ink", items: [...MASTERS_LOOKUP_ITEMS] },
        ],
      });
    if (canParties)
      result.push({ id: "parties", label: "Parties", defaultTo: "/parties", groups: [{ label: "Parties", items: [...PARTIES_ITEMS] }] });
    if (canStaff)
      result.push({ id: "staff", label: "Staff", defaultTo: "/staff", groups: [{ label: "Staff", items: [...STAFF_ITEMS] }] });
    if (canInventory)
      result.push({ id: "inventory", label: "Inventory", defaultTo: "/inventory/items", groups: [{ label: "Stock", tint: "accent", items: [...INVENTORY_ITEMS] }] });
    if (canAnalytics)
      result.push({ id: "analytics", label: "Analytics", defaultTo: "/reports", groups: [{ label: "Reports", items: [...ANALYTICS_ITEMS] }] });
    if (canSettings)
      result.push({ id: "settings", label: "Settings", defaultTo: "/general-settings/lab", groups: settingsGroups });
    result.push({ id: "audit", label: "Audit", defaultTo: "/audit", groups: [{ label: "Compliance", tint: "ink", items: [...AUDIT_ITEMS] }] });
    return result;
  }, [canMasters, canParties, canStaff, canInventory, canAnalytics, canSettings, canSystem, canVerify, canApprove]);

  const activeTab = useMemo(() => {
    const id = activeTabId(location.pathname);
    return tabs.find((t) => t.id === id) ?? tabs[0];
  }, [tabs, location.pathname]);

  // Flat, deduped list for the Cmd+K palette — every page in one place,
  // regardless of which ribbon tab it lives under.
  const navItems = useMemo(() => {
    const seen = new Set<string>();
    const items: NavItem[] = [];
    for (const tab of tabs) {
      for (const group of tab.groups) {
        for (const item of group.items) {
          if (!seen.has(item.to)) {
            seen.add(item.to);
            items.push(item);
          }
        }
      }
    }
    return items;
  }, [tabs]);

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

  // Warm the heavy lazy route chunks during idle time right after login,
  // so the first navigation to Masters / Report / QC / Settings is instant.
  useEffect(() => {
    preloadHeavyPages();
  }, []);

  const screenName = screenNameFor(location.pathname);

  return (
    <ContextActionsProvider value={{ setActions: setContextActions }}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-100">
        <header className="sticky top-0 z-40 shrink-0 border-b border-line-200 bg-surface-0">
          {/* Row 1 — brand · ribbon tabs · utility cluster */}
          <div className="flex h-12 items-center gap-2 border-b border-line-200 px-2.5">
            <div className="flex shrink-0 items-center gap-2 pr-1">
              <div className="flex size-8 items-center justify-center rounded-md bg-accent-700 text-surface-0">
                <FlaskConical className="size-4" />
              </div>
              <div className="hidden leading-tight lg:block">
                <div className="text-[12px] font-semibold tracking-wide text-ink-950">
                  THULIR03
                </div>
                <div className="text-[9px] uppercase tracking-[0.14em] text-ink-400">
                  Lab LIMS
                </div>
              </div>
            </div>

            {/* Ribbon tabs — horizontally scrollable on narrow screens */}
            <nav className={`flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto ${NO_SCROLLBAR}`}>
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => navigate(tab.defaultTo)}
                    title={tab.label}
                    className={`flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-3 text-[13px] font-semibold transition-colors duration-fast ${
                      isActive
                        ? "bg-accent-700 text-surface-0"
                        : "text-ink-600 hover:bg-surface-100 hover:text-ink-950"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => setPaletteOpen(true)}
                title="Command palette (Ctrl+K)"
                className="hidden h-8 items-center gap-1.5 rounded-sm border border-line-200 px-2 text-xs text-ink-500 transition-colors duration-fast hover:border-accent-300 hover:text-accent-700 sm:flex"
              >
                <Search className="size-3.5" />
                <span className="hidden md:inline">Search</span>
                <kbd className="hidden rounded-sm bg-surface-100 px-1 text-[9px] text-ink-400 md:inline">
                  ⌘K
                </kbd>
              </button>
              <button
                onClick={() => setPaletteOpen(true)}
                title="Search"
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-line-200 text-ink-500 transition-colors duration-fast hover:border-accent-300 hover:text-accent-700 sm:hidden"
              >
                <Search className="size-3.5" />
              </button>
              <AlertsBell />
              <div className="ml-1 hidden items-center gap-2 border-l border-line-200 pl-2.5 md:flex">
                <div className="flex size-7 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                  <User className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-ink-950">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="truncate text-[10px] text-ink-400">
                    {roleLabel(user?.role)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  title="Sign out"
                  className="text-ink-400 transition-colors duration-fast hover:text-status-critical"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2 — ribbon strip: active tab's groups (Office-style icon
              buttons with a horizontal group label beneath) + the per-screen
              context actions pinned at the right edge. Merging the context
              toolbar into this row keeps the shell at two chrome bars. */}
          <div className="flex items-stretch border-b border-line-200 bg-surface-100/50">
            {/* Screen context — pinned left, hidden on small screens */}
            <div className="hidden shrink-0 items-center gap-2 border-r border-line-200/70 px-3 md:flex">
              <span className="size-1.5 shrink-0 rounded-full bg-accent-500" />
              <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600">
                {screenName}
              </span>
              <span className="whitespace-nowrap text-[10px] text-ink-400">
                · {activeTab.label}
              </span>
            </div>

            {/* Ribbon groups — horizontally scrollable on narrow screens */}
            <div className={`flex min-w-0 flex-1 items-stretch gap-0 overflow-x-auto py-1 pl-1 ${NO_SCROLLBAR}`}>
              {activeTab.groups.map((group) => (
                <div
                  key={group.label}
                  className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-r border-line-200/70 px-2.5 last:border-r-0"
                >
                  <div className="flex items-center gap-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) =>
                          `flex flex-col items-center gap-1 rounded-sm px-1.5 py-1 transition-colors duration-fast ${
                            isActive ? "bg-accent-100" : "hover:bg-surface-0"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              className={`flex size-7 items-center justify-center rounded-md transition-colors duration-fast ${
                                isActive
                                  ? "bg-accent-700 text-surface-0"
                                  : GROUP_TINTS[group.tint ?? "accent"]
                              }`}
                            >
                              <item.icon className="size-4" strokeWidth={2.2} />
                            </span>
                        <span
                          className={`max-w-[76px] truncate text-[9.5px] font-medium leading-none ${
                                isActive ? "text-accent-700" : "text-ink-600"
                              }`}
                            >
                              {item.label}
                            </span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                  <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                    {group.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Context actions — pinned right, hidden entirely when empty */}
            {contextActions.length > 0 && (
              <div className="flex shrink-0 items-center border-l border-line-200/70 px-2">
                <ContextToolbar actions={contextActions} />
              </div>
            )}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navItems={navItems}
        go={(to) => {
          setPaletteOpen(false);
          navigate(to);
        }}
      />
    </ContextActionsProvider>
  );
}
