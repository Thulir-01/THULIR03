/**
 * Context toolbar actions (Photoshop-style options bar).
 *
 * Each page can register a small set of actions that appear in the ribbon
 * strip's right-hand cluster, mirroring its primary actions so operators
 * never have to hunt for them. Pages that don't register anything simply
 * show the screen name — the cluster stays empty.
 *
 * Usage:
 *   useContextActions([
 *     { id: "save", label: "Save All", icon: Save, variant: "primary", onClick: () => void saveAll() },
 *   ]);
 */
import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type ContextAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "primary" | "secondary";
  danger?: boolean;
  disabled?: boolean;
  title?: string;
};

type ContextActionsApi = {
  setActions: (actions: ContextAction[]) => void;
};

const ContextActionsContext = createContext<ContextActionsApi>({
  setActions: () => {},
});

/**
 * Register the current screen's context-toolbar actions. Call once per page,
 * unconditionally at the top level of the component, with a fresh array each
 * render — only the visible identity (id / label / disabled) is diffed, so
 * the toolbar stays in sync without re-registering on every keystroke.
 */
export function useContextActions(actions: ContextAction[]): void {
  const { setActions } = useContext(ContextActionsContext);
  const key = actions
    .map((a) => `${a.id}|${a.label}|${String(!!a.disabled)}`)
    .join("~");

  useEffect(() => {
    setActions(actions);
    return () => setActions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function ContextActionsProvider({
  value,
  children,
}: {
  value: ContextActionsApi;
  children: ReactNode;
}) {
  return (
    <ContextActionsContext.Provider value={value}>
      {children}
    </ContextActionsContext.Provider>
  );
}

/**
 * Compact actions cluster, rendered inside the ribbon strip's right edge.
 * Returns null when the page registers no actions, so the shell can skip
 * the whole cluster (and its divider) entirely.
 */
export function ContextToolbar({ actions }: { actions: ContextAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {actions.map((a) => (
        <button
          key={a.id}
          onClick={a.onClick}
          disabled={a.disabled}
          title={a.title ?? a.label}
          className={`inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[11px] font-semibold transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40 ${
            a.variant === "primary"
              ? "bg-accent-700 text-surface-0 hover:bg-accent-500"
              : a.danger
                ? "text-status-critical hover:bg-red-50"
                : "border border-line-200 bg-surface-0 text-ink-600 hover:bg-surface-100 hover:text-ink-950"
          }`}
        >
          {a.icon && <a.icon className="size-3.5" />}
          {a.label}
        </button>
      ))}
    </div>
  );
}
