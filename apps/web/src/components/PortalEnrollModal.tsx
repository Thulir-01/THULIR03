import { useState, type FormEvent } from "react";
import { X, ShieldCheck, ShieldX, Loader2, KeyRound } from "lucide-react";
import { enrollPortalUser, revokePortalUser, type PortalKind } from "../lib/api-client";

export default function PortalEnrollModal({
  kind,
  entityId,
  entityName,
  defaultEmail,
  onClose,
  onDone,
}: {
  kind: PortalKind;
  entityId: string;
  entityName: string;
  defaultEmail: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [alreadyEnabled, setAlreadyEnabled] = useState(false);

  async function handleEnroll(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await enrollPortalUser({ kind, entityId, email, password });
      setMessage(`Portal access enabled for ${email}. Share these credentials with the ${kind}.`);
      onDone();
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "Failed to enable portal access";
      if (/already has portal access/i.test(msg)) {
        setAlreadyEnabled(true);
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    if (!confirm(`Revoke portal access for ${entityName}? The linked account will be deactivated.`)) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await revokePortalUser({ kind, entityId });
      setMessage("Portal access revoked. The account has been deactivated.");
      setAlreadyEnabled(false);
      onDone();
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Failed to revoke access");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/30 px-4 pt-[12vh]">
      <div className="w-full max-w-md rounded-md border border-line-200 bg-surface-0 p-6 shadow-overlay">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink-950">
            <ShieldCheck className="size-4 text-accent-700" />
            Portal access — {entityName}
          </h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-950">
            <X className="size-4" />
          </button>
        </div>

        {message ? (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
          </div>
        ) : (
          <form onSubmit={handleEnroll} className="space-y-3">
            <p className="text-xs text-ink-500">
              Create login credentials so this {kind} can sign in and view{" "}
              {kind === "patient" ? "their own orders & reports" : "referred orders & reports"} online.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-600">Email (login id)</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-line-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-600">
                Temporary password (min 6 chars)
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Share with the patient"
                  className="w-full rounded-md border border-line-300 py-2 pl-9 pr-3 text-sm focus:border-accent-500 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-status-critical/30 bg-status-critical/5 px-3 py-2 text-xs text-status-critical">
                {error}
                {alreadyEnabled && (
                  <button
                    type="button"
                    onClick={handleRevoke}
                    disabled={saving}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-status-critical underline"
                  >
                    <ShieldX className="size-3" /> Revoke existing access instead
                  </button>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-line-300 px-4 py-2 text-xs font-medium text-ink-600 hover:bg-surface-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 hover:bg-accent-500 disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                Enable portal
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
