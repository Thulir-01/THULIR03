import React from "react";

export function Receipt({ orderNumber, patientName, total }: { orderNumber: string; patientName: string; total: number }) {
  return (
    <div className="p-4 bg-[var(--color-surface-0)] rounded-md border border-[var(--color-line-200)] w-full">
      <div className="text-sm font-semibold mb-2">Receipt</div>
      <div className="text-[13px] text-[var(--color-ink-600)]">Order: <span className="font-mono">{orderNumber}</span></div>
      <div className="mt-2">Patient: <span className="font-medium">{patientName}</span></div>
      <div className="mt-4 text-lg font-bold">Total: ₹{total.toFixed(2)}</div>
    </div>
  );
}
