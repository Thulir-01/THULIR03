import React from "react";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

type Status =
  | "draft"
  | "collected"
  | "pending"
  | "entered"
  | "verified"
  | "approved"
  | "critical"
  | "rejected";

const statusMap: Record<
  Status,
  { label: string; classes: string; Icon?: React.ComponentType<any> }
> = {
  draft: { label: "Draft", classes: "border text-[var(--color-ink-600)] bg-transparent", Icon: undefined },
  collected: { label: "Sample collected", classes: "bg-[var(--color-accent-100)] text-[var(--color-accent-700)]", Icon: undefined },
  pending: { label: "Pending", classes: "bg-[var(--color-amber-50)] text-[var(--color-amber-500)]", Icon: undefined },
  entered: { label: "Awaiting verification", classes: "bg-[var(--color-accent-100)] text-[var(--color-accent-700)]", Icon: undefined },
  verified: { label: "Awaiting approval", classes: "bg-[var(--color-blue-50)] text-[var(--color-indigo-600)]", Icon: CheckCircle },
  approved: { label: "Report ready", classes: "bg-[var(--color-green-50)] text-[var(--color-green-500)]", Icon: CheckCircle },
  critical: { label: "Critical value", classes: "bg-[var(--color-red-50)] text-[var(--color-red-500)]", Icon: AlertTriangle },
  rejected: { label: "Rejected", classes: "bg-transparent border border-[var(--color-red-200)] text-[var(--color-red-500)]", Icon: XCircle },
};

export default function StatusBadge({ status }: { status: Status }) {
  const info = statusMap[status];
  const Icon = info.Icon;
  return (
    <span
      role="status"
      aria-label={info.label}
      className={`inline-flex items-center gap-2 text-sm px-2 py-1 rounded ${info.classes}`}
    >
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      <span className="font-medium">{info.label}</span>
    </span>
  );
}
