import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Search,
  Plus,
  Check,
  X,
  ClipboardSignature,
  BadgeCheck,
  FileSignature,
} from "lucide-react";
import {
  listStaff,
  upsertStaffDetail,
  removeStaffDetail,
  type StaffUser,
} from "../lib/api-client";

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Edit form state
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [registrationNo, setRegistrationNo] = useState("");
  const [qualification, setQualification] = useState("");
  const [designation, setDesignation] = useState("");
  const [signatureImageUrl, setSignatureImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listStaff();
      setStaff(data);
    } catch {
      setError("Failed to load staff. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (user: StaffUser) => {
    setEditing(user);
    setRegistrationNo(user.staffDetail?.registrationNo ?? "");
    setQualification(user.staffDetail?.qualification ?? "");
    setDesignation(user.staffDetail?.designation ?? "");
    setSignatureImageUrl(user.staffDetail?.signatureImageUrl ?? "");
    setError("");
  };

  const closeForm = () => {
    setEditing(null);
    setError("");
  };

  const submit = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const updated = await upsertStaffDetail(editing.id, {
        registrationNo: registrationNo.trim(),
        qualification: qualification.trim(),
        designation: designation.trim(),
        signatureImageUrl: signatureImageUrl.trim(),
      });
      setStaff((prev) =>
        prev.map((u) =>
          u.id === editing.id ? { ...u, staffDetail: updated } : u,
        ),
      );
      closeForm();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Failed to save. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const clearDetails = async (user: StaffUser) => {
    if (
      !confirm(
        `Remove NABL sign-off details for ${user.firstName} ${user.lastName}?`,
      )
    )
      return;
    setError("");
    try {
      await removeStaffDetail(user.id);
      setStaff((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, staffDetail: null } : u)),
      );
    } catch {
      setError("Failed to remove details.");
    }
  };

  const filtered = staff.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.staffDetail?.designation ?? "").toLowerCase().includes(q) ||
      (u.staffDetail?.registrationNo ?? "").toLowerCase().includes(q)
    );
  });

  const signedCount = staff.filter(
    (u) => u.staffDetail?.signatureImageUrl && u.staffDetail?.registrationNo,
  ).length;

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-ink-950">Staff</h2>
            <p className="text-sm text-ink-400 mt-0.5">
              NABL sign-off details — registration no. + digital signature for
              report verification
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-md border border-line-200 bg-surface-0 px-3 py-2">
            <BadgeCheck className="size-4 text-status-normal" />
            <span className="text-sm text-ink-600">
              <span className="font-semibold text-ink-950">{signedCount}</span>{" "}
              of {staff.length} ready to sign
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-300" />
          <input
            type="text"
            placeholder="Search by name, email, designation, reg no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-line-200 bg-surface-0 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400 transition-all"
          />
        </div>

        {/* Table */}
        <div className="rounded-md border border-line-200 bg-surface-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 text-accent-600 animate-spin" />
              <span className="ml-3 text-sm text-ink-400">Loading staff…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center">
                <ClipboardSignature className="size-6 text-accent-600" />
              </div>
              <p className="text-sm text-ink-400">
                {search
                  ? "No staff match your search."
                  : "No staff found."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-100/60 border-b border-line-200 text-left text-[11px] uppercase tracking-wider text-ink-400">
                  <th className="px-4 py-2.5 font-medium">Staff member</th>
                  <th className="px-3 py-2.5 font-medium">Designation</th>
                  <th className="px-3 py-2.5 font-medium">Reg. no.</th>
                  <th className="px-3 py-2.5 font-medium">Qualification</th>
                  <th className="px-3 py-2.5 font-medium">Signature</th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-200">
                {filtered.map((user) => {
                  const ready =
                    !!user.staffDetail?.signatureImageUrl &&
                    !!user.staffDetail?.registrationNo;
                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-surface-100/40 transition-colors duration-fast"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="size-8 shrink-0 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-xs font-semibold">
                            {user.firstName[0]}
                            {user.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-ink-950 truncate">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-xs text-ink-400 truncate">
                              {user.email}
                              {user.role ? ` · ${user.role.name}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-ink-600">
                        {user.staffDetail?.designation ?? (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-ink-500">
                        {user.staffDetail?.registrationNo ?? (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-ink-600">
                        {user.staffDetail?.qualification ?? (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {user.staffDetail?.signatureImageUrl ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-normal">
                            <FileSignature className="size-3.5" />
                            On file
                          </span>
                        ) : (
                          <span className="text-xs text-ink-300">
                            Not uploaded
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-3">
                          {ready && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-status-normal/10 px-2 py-0.5 text-[10px] font-semibold text-status-normal">
                              <BadgeCheck className="size-3" />
                              Can sign
                            </span>
                          )}
                          <button
                            onClick={() => openEdit(user)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line-200 text-xs font-medium text-accent-600 hover:border-accent-300 hover:bg-accent-50 transition-colors"
                          >
                            <Plus className="size-3.5" />
                            {user.staffDetail ? "Edit" : "Add details"}
                          </button>
                          {user.staffDetail && (
                            <button
                              onClick={() => clearDetails(user)}
                              className="text-xs text-ink-400 hover:text-status-critical font-medium transition-colors"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-surface-0 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-ink-950">
                NABL sign-off details
              </h3>
              <button
                onClick={closeForm}
                className="text-ink-400 hover:text-ink-600 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mb-5 flex items-center gap-3 rounded-md bg-surface-100 px-3 py-2.5">
              <div className="size-9 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-sm font-semibold">
                {editing.firstName[0]}
                {editing.lastName[0]}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink-950 truncate">
                  {editing.firstName} {editing.lastName}
                </div>
                <div className="text-xs text-ink-400 truncate">
                  {editing.email}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">
                  Designation
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Chief Pathologist"
                  className="w-full px-3 py-2 rounded-md border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">
                  Registration no.
                </label>
                <input
                  type="text"
                  value={registrationNo}
                  onChange={(e) => setRegistrationNo(e.target.value)}
                  placeholder="e.g. MCI-123456"
                  className="w-full px-3 py-2 rounded-md border border-line-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">
                  Qualification
                </label>
                <input
                  type="text"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="e.g. MD Pathology"
                  className="w-full px-3 py-2 rounded-md border border-line-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">
                  Signature image URL
                </label>
                <input
                  type="text"
                  value={signatureImageUrl}
                  onChange={(e) => setSignatureImageUrl(e.target.value)}
                  placeholder="https://cdn.example.com/signatures/…"
                  className="w-full px-3 py-2 rounded-md border border-line-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-400"
                />
                {signatureImageUrl.trim() && (
                  <div className="mt-2 flex items-center gap-3 rounded-md border border-line-200 bg-surface-100 px-3 py-2">
                    <img
                      src={signatureImageUrl.trim()}
                      alt="Signature preview"
                      className="h-10 w-auto object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = "0.3";
                      }}
                      onLoad={(e) => {
                        (e.target as HTMLImageElement).style.opacity = "1";
                      }}
                    />
                    <span className="text-[11px] text-ink-400">
                      Live preview — this stamps verified reports
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-md border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-xs text-status-critical">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={closeForm}
                  className="px-4 py-2 rounded-md text-sm font-medium text-ink-500 hover:bg-surface-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-700 text-surface-0 text-sm font-semibold hover:bg-accent-800 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Save Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
