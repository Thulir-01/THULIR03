import type { LucideIcon } from "lucide-react";

const ACCENTS: Record<string, string> = {
  accent: "bg-accent-100 text-accent-700",
  green: "bg-green-50 text-green-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  blue: "bg-blue-50 text-blue-600",
  indigo: "bg-indigo-50 text-indigo-600",
};

/**
 * KPI stat card — the single pattern for dashboard/report numbers.
 * `accent` is one of: accent | green | amber | red | blue | indigo.
 */
export default function StatCard({
  label,
  value,
  icon: Icon,
  accent = "accent",
  sub,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: "accent" | "green" | "amber" | "red" | "blue" | "indigo";
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-line-200 bg-surface-0 p-4 shadow-raised">
      <div className="flex items-center gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-md ${ACCENTS[accent]}`}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tabular-nums text-ink-950">
            {value}
          </p>
          <p className="truncate text-xs text-ink-600">{label}</p>
        </div>
      </div>
      {sub && <p className="mt-2 text-[11px] text-ink-400">{sub}</p>}
    </div>
  );
}
