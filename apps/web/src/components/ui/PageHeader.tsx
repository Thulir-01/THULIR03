import type { ReactNode } from "react";

/**
 * Consistent page header — every authenticated screen uses this so
 * titles, subtitles and action buttons sit at the same height and rhythm.
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-ink-950">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-ink-600">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
