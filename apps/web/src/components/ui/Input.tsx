import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  id?: string;
  className?: string;
};

export default function Input({ label, id, className = "", ...rest }: Props) {
  return (
    <label className="flex flex-col text-sm">
      {label ? <span className="mb-1 text-xs text-[var(--color-ink-600)] font-medium">{label}</span> : null}
      <input
        id={id}
        className={`h-8 px-2.5 border border-[var(--color-line-200)] rounded-control bg-[var(--color-surface-0)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-100)] ${className}`}
        {...rest}
      />
    </label>
  );
}
