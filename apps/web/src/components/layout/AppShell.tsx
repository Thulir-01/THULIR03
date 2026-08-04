import React, { useState } from "react";
import { Menu, Search, User, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-[var(--color-surface-100)]">
      <aside className={`hidden md:flex flex-col border-r border-[var(--color-line-200)] bg-[var(--color-surface-0)] transition-[width] duration-150 ${collapsed ? "w-[72px]" : "w-[248px]"}`}>
        <div className="h-16 flex items-center px-4 border-b border-[var(--color-line-200)]">
          <button aria-label="Toggle" onClick={() => setCollapsed(!collapsed)} className="p-2 rounded hover:bg-[var(--color-accent-100)]">
            <Menu size={20} />
          </button>
          {!collapsed && <div className="ml-3 font-semibold">THULIR03</div>}
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          <NavLink to="/dashboard" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded ${isActive ? "bg-[var(--color-accent-100)] text-[var(--color-accent-700)]" : "text-[var(--color-ink-600)] hover:bg-[var(--color-surface-100)]"}`}>
            <div className="w-6 h-6"><svg aria-hidden viewBox="0 0 24 24" className="w-5 h-5"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zM13 21h8V11h-8v10zM13 3v6h8V3h-8z"/></svg></div>
            {!collapsed && <span>Dashboard</span>}
          </NavLink>
          <NavLink to="/registration" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded ${isActive ? "bg-[var(--color-accent-100)] text-[var(--color-accent-700)]" : "text-[var(--color-ink-600)] hover:bg-[var(--color-surface-100)]"}`}>
            <div className="w-6 h-6"><svg aria-hidden viewBox="0 0 24 24" className="w-5 h-5"><path d="M12 2L2 7v6c0 5 3 9 10 11 7-2 10-6 10-11V7l-10-5z"/></svg></div>
            {!collapsed && <span>Registration</span>}
          </NavLink>
          <NavLink to="/worklists" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded ${isActive ? "bg-[var(--color-accent-100)] text-[var(--color-accent-700)]" : "text-[var(--color-ink-600)] hover:bg-[var(--color-surface-100)]"}`}>
            <div className="w-6 h-6"><svg aria-hidden viewBox="0 0 24 24" className="w-5 h-5"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg></div>
            {!collapsed && <span>Worklists</span>}
          </NavLink>
        </nav>

        <div className="p-3 border-t border-[var(--color-line-200)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent-100)] flex items-center justify-center"> 
              <User size={16} />
            </div>
            {!collapsed && <div className="flex-1">
              <div className="text-sm font-medium">User Name</div>
              <div className="text-xs text-[var(--color-ink-600)]">Lab Staff</div>
            </div>}
            <button onClick={() => navigate('/login')} title="Sign out" className="text-[var(--color-ink-600)] p-2 rounded hover:bg-[var(--color-surface-100)]"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="h-16 flex items-center px-4 border-b border-[var(--color-line-200)] bg-[var(--color-surface-0)]">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 rounded"><Menu size={18} /></button>
            <div className="text-lg font-semibold">Page title</div>
            <div className="ml-6">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]" />
                <input aria-label="Search" placeholder="Search patient, accession..." className="h-8 pl-8 pr-3 border border-[var(--color-line-200)] rounded-control" />
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="px-3 py-1 rounded bg-[var(--color-accent-700)] text-white">Primary</button>
          </div>
        </header>

        <main className="p-6 max-w-[1600px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
