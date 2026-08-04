import React from "react";

type Variant = "primary" | "secondary" | "danger";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
};

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-control font-semibold focus:outline-none focus:ring-2 focus:ring-offset-1";
  const sizes: Record<string, string> = {
    sm: "px-3 h-8 text-sm",
    md: "px-4 h-9 text-sm",
    lg: "px-5 h-11 text-base",
  };

  const variants: Record<Variant, string> = {
    primary: "bg-[var(--color-accent-700)] hover:bg-[var(--color-accent-500)] text-white",
    secondary: "bg-[var(--color-surface-0)] border border-[var(--color-line-200)] text-[var(--color-ink-950)] hover:bg-[var(--color-surface-100)]",
    danger: "bg-transparent border border-[var(--color-red-500)] text-[var(--color-red-500)] hover:bg-[var(--color-red-50)]",
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {icon ? <span className="flex items-center">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
