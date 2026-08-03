import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  Plus,
  Building2,
  Phone,
  Mail,
  MapPin,
  Landmark,
  Briefcase,
  ShieldCheck,
  FlaskConical,
  Stethoscope,
  Settings2,
  FileText,
  Trash2,
  BadgePercent,
  KeyRound,
  Award,
} from "lucide-react";
import {
  getParties,
  deleteParty,
  PARTY_TYPE_LABELS,
  type Party,
  type PartyType,
} from "../lib/api-client";
import PageHeader from "../components/ui/PageHeader";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/PageStates";
import PortalEnrollModal from "../components/PortalEnrollModal";

const TYPES: Array<{ value: PartyType | "all"; label: string; icon: typeof Building2 }> = [
  { value: "all", label: "All Parties", icon: Building2 },
  { value: "doctor", label: "Doctors", icon: Stethoscope },
  { value: "hospital", label: "Hospitals", icon: Landmark },
  { value: "corporate", label: "Corporates", icon: Briefcase },
  { value: "insurance_tpa", label: "Insurance / TPA", icon: ShieldCheck },
  { value: "reference_lab", label: "Reference Labs", icon: FlaskConical },
  { value: "consultant", label: "Consultants", icon: Stethoscope },
];

const TYPE_ACCENTS: Record<PartyType, string> = {
  doctor: "bg-accent-100 text-accent-700",
  hospital: "bg-blue-50 text-blue-700",
  corporate: "bg-indigo-50 text-indigo-700",
  insurance_tpa: "bg-amber-50 text-amber-700",
  reference_lab: "bg-green-50 text-green-700",
  consultant: "bg-cyan-100 text-accent-700",
};

export default function PartiesPage() {
  const navigate = useNavigate();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState<PartyType | "all">("all");
  const [search, setSearch] = useState("");
  const [portalParty, setPortalParty] = useState<Party | null>(null);

  const load = useCallback(
    async (t?: PartyType, q?: string) => {
      setLoading(true);
      setError("");
      try {
        const data = await getParties({
          ...(t ? { type: t } : {}),
          ...(q ? { search: q } : {}),
        });
        setParties(data);
      } catch {
        setParties([]);
        setError("Failed to load parties. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(
      () => load(type === "all" ? undefined : type, search || undefined),
      300,
    );
    return () => clearTimeout(timer);
  }, [load, type, search]);

  const handleDelete = async (party: Party) => {
    if (
      !confirm(
        `Delete "${party.name}"? This will mark it inactive and it can no longer be referenced.`,
      )
    )
      return;
    try {
      await deleteParty(party.id);
      setParties((prev) => prev.filter((p) => p.id !== party.id));
    } catch {
      alert("Failed to delete party. Please try again.");
    }
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <PageHeader
            title="Parties"
            subtitle="Hospitals, corporates, insurers, reference labs & consultants — each can carry its own rate card"
            actions={
              <button
                onClick={() => navigate("/parties/new")}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3.5 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
              >
                <Plus className="size-3.5" /> Add Party
              </button>
            }
          />
        </div>

        {/* Type tabs */}
        <div className="mb-5 flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-fast ${
                type === t.value
                  ? "border-accent-500 bg-accent-100 text-accent-700"
                  : "border-line-200 bg-surface-0 text-ink-600 hover:bg-surface-100"
              }`}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search by name, contact, or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-line-300 bg-surface-0 py-2.5 pl-10 pr-4 text-sm transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
          />
        </div>

        {loading ? (
          <LoadingState label="Loading parties…" rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load(type === "all" ? undefined : type, search || undefined)} />
        ) : parties.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={search ? "No parties match your search" : "No parties yet"}
            hint={
              search
                ? "Try a different search term"
                : "Add hospitals, corporates, insurers or labs to manage their rate cards"
            }
            action={
              !search ? (
                <button
                  onClick={() => navigate("/parties/new")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-4 py-2 text-xs font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                >
                  <Plus className="size-3.5" /> Add Party
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {parties.map((party) => (
              <div
                key={party.id}
                className="group rounded-md border border-line-200 bg-surface-0 p-5 shadow-raised transition-all duration-fast hover:border-accent-500 hover:shadow-raised"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-700">
                      {initials(party.name)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-ink-950">{party.name}</h3>
                      <span
                        className={`mt-1 inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_ACCENTS[party.partyType]}`}
                      >
                        {PARTY_TYPE_LABELS[party.partyType]}
                      </span>
                    </div>
                  </div>
                  {party.status !== "active" && (
                    <span className="rounded-full bg-surface-100 px-2 py-0.5 text-xs text-ink-600">
                      {party.status}
                    </span>
                  )}
                </div>

                <div className="mb-4 space-y-1.5 text-sm text-ink-600">
                  {party.gstin && (
                    <div className="flex items-center gap-2">
                      <Settings2 className="size-3.5 text-ink-400" />
                      <span className="data-mono text-xs">{party.gstin}</span>
                    </div>
                  )}
                  {party.primaryContactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 text-ink-400" />
                      <span>{party.primaryContactPhone}</span>
                    </div>
                  )}
                  {party.primaryContactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="size-3.5 text-ink-400" />
                      <span className="truncate">{party.primaryContactEmail}</span>
                    </div>
                  )}
                  {party.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-ink-400" />
                      <span className="truncate">{party.address}</span>
                    </div>
                  )}
                  {party.primaryContactName && (
                    <div className="flex items-center gap-2">
                      <Stethoscope className="size-3.5 text-ink-400" />
                      <span>{party.primaryContactName}</span>
                    </div>
                  )}
                  {party.partyType === "doctor" && party.specialty && (
                    <div className="flex items-center gap-2">
                      <Award className="size-3.5 text-ink-400" />
                      <span>{party.specialty}</span>
                    </div>
                  )}
                  {party.partyType === "doctor" && party.clinicName && (
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3.5 text-ink-400" />
                      <span>{party.clinicName}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-line-200 pt-3">
                  <div className="flex items-center gap-1.5">
                    {party._count && party._count.orders > 0 && (
                      <span className="rounded-full bg-accent-100 px-2.5 py-1 text-xs font-medium text-accent-700">
                        {party._count.orders}{" "}
                        {party.partyType === "doctor" ? "referrals" : "orders"}
                      </span>
                    )}
                    {party._count && party._count.referrerPrices > 0 && (
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                        {party._count.referrerPrices} rates
                      </span>
                    )}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/parties/${party.id}/pricing`)}
                      title="Rate cards"
                      className="inline-flex items-center gap-1 rounded-sm bg-accent-700 px-2 py-1 text-[11px] font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                    >
                      <BadgePercent className="size-3" /> Rates
                    </button>
                    <button
                      onClick={() => navigate(`/parties/${party.id}/edit`)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500"
                    >
                      <FileText className="size-3" /> Edit
                    </button>
                    <button
                      onClick={() => setPortalParty(party)}
                      title="Enable referrer portal login"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-500 transition-colors duration-fast hover:text-accent-700"
                    >
                      <KeyRound className="size-3" /> Portal
                    </button>
                    <button
                      onClick={() => handleDelete(party)}
                      className="text-ink-400 transition-colors duration-fast hover:text-status-critical"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {portalParty && (
        <PortalEnrollModal
          kind="referrer"
          entityId={portalParty.id}
          entityName={portalParty.name}
          defaultEmail={portalParty.primaryContactEmail}
          onClose={() => setPortalParty(null)}
          onDone={() => setPortalParty(null)}
        />
      )}
    </div>
  );
}
