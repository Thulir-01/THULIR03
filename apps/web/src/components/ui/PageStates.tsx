import { Loader2, AlertCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared data-state components — every list/detail screen uses these
 * so loading, empty and error states look and behave identically.
 */

/** Full-area loading state with optional rows of skeleton blocks. */
export function LoadingState({
  label = "Loading…",
  rows = 4,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-4 p-8">
      <div className="flex items-center gap-2.5 text-sm text-ink-600">
        <Loader2 className="size-4.5 animate-spin text-accent-500" />
        {label}
      </div>
      <div className="w-full max-w-md space-y-2" aria-hidden>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-11 animate-pulse rounded-md bg-line-200/70"
            style={{ opacity: 1 - i * 0.16 }}
          />
        ))}
      </div>
    </div>
  );
}

/** Centered empty state — icon in a quiet chip, title, hint, optional action. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-md bg-accent-100 text-accent-700">
        <Icon className="size-6" />
      </div>
      <p className="mt-1 text-sm font-semibold text-ink-950">{title}</p>
      {hint && <p className="max-w-sm text-xs text-ink-600">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Error state — message plus a retry action. */
export function ErrorState({
  message = "Something went wrong while loading this data.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-md bg-red-50 text-status-critical">
        <AlertCircle className="size-6" />
      </div>
      <p className="mt-1 text-sm font-semibold text-ink-950">Couldn't load data</p>
      <p className="max-w-sm text-xs text-ink-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-1.5 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
        >
          Try again
        </button>
      )}
    </div>
  );
}
