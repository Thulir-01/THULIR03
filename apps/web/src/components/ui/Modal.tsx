import React from "react";

export default function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children?: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-lg bg-[var(--color-surface-0)] rounded-panel border border-[var(--color-line-200)] shadow-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[var(--color-line-200)] flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="text-[var(--color-ink-600)] px-2 py-1">Close</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
