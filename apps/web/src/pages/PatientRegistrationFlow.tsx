import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  Loader2,
  ShieldCheck,
  User,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  IdCard,
  Building2,
  Lock,
  FileCheck2,
  UserCheck,
  ClipboardList,
} from "lucide-react";
import {
  getPatients,
  createPatient,
  updatePatient,
  type Patient,
  type CreatePatientData,
} from "../lib/api-client";
import { useAuth } from "../lib/useAuth";

/* ── Helpers ───────────────────────────────────────────────────── */

const TITLES = ["Mr.", "Mrs.", "Ms.", "Dr.", "Baby", "Master"];

const INSURERS = [
  "Star Health",
  "HDFC ERGO",
  "ICICI Lombard",
  "NIA (National Insurance)",
  "Bajaj Allianz",
  "MediAssist TPA",
  "Self-Pay / None",
];

type Eligibility = "idle" | "checking" | "active" | "pending" | "denied";

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidPhone(v: string): boolean {
  return /^[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ""));
}

function isValidMrn(v: string): boolean {
  return /^[A-Za-z0-9-]{3,20}$/.test(v.trim());
}

/** YYYY-MM-DD string must be today or earlier. */
function isFutureDob(v: string): boolean {
  if (!v) return false;
  const d = new Date(`${v}T00:00:00`);
  return !isNaN(d.getTime()) && d.getTime() > Date.now();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function initials(p: { firstName: string; lastName?: string | null }): string {
  return `${p.firstName.charAt(0)}${p.lastName?.charAt(0) ?? ""}`.toUpperCase();
}

interface FormState {
  title: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  mrn: string;
  abha: string;
  insuranceId: string;
  insurer: string;
  policyNo: string;
  groupNo: string;
}

const EMPTY_FORM: FormState = {
  title: "Mr.",
  firstName: "",
  lastName: "",
  dob: "",
  gender: "male",
  phone: "",
  email: "",
  address: "",
  mrn: "",
  abha: "",
  insuranceId: "",
  insurer: "Self-Pay / None",
  policyNo: "",
  groupNo: "",
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

/* ── Page ──────────────────────────────────────────────────────── */

export default function PatientRegistrationFlow() {
  const navigate = useNavigate();
  const { user } = useAuth();

  /* ── Smart search (Step 1) ── */
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [index, setIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Form (Step 2–3) ── */
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [revealId, setRevealId] = useState(false);
  const [eligibility, setEligibility] = useState<Eligibility>("idle");
  const [hipaaConsent, setHipaaConsent] = useState(false);
  const [treatmentConsent, setTreatmentConsent] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});

  /* ── Submit ── */
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [savedPatient, setSavedPatient] = useState<Patient | null>(null);

  /* ── Derived ── */
  const isExisting = !!selected;
  const allRequiredNames = form.firstName.trim().length > 0;
  const validName = allRequiredNames && form.lastName.trim().length > 0;
  const consentComplete = hipaaConsent && treatmentConsent;
  const insuranceEntered = form.insuranceId.trim().length > 0 || form.policyNo.trim().length > 0;

  const step = useMemo(() => {
    if (savedPatient) return 4;
    if (consentComplete && validName) return 3;
    if (validName) return 2;
    return 1;
  }, [savedPatient, consentComplete, validName]);

  const STEPS = ["Identify", "Demographics", "Insurance & Consent", "Done"];

  /* ── Smart search with debounce ── */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await getPatients(search.trim());
        setResults(data);
        setShowResults(data.length > 0);
        setIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const pickPatient = useCallback((p: Patient) => {
    setSelected(p);
    setShowResults(false);
    setSearch("");
    setResults([]);
    setForm({
      title: p.gender === "female" ? "Ms." : "Mr.",
      firstName: p.firstName,
      lastName: p.lastName ?? "",
      dob: p.dateOfBirth ? p.dateOfBirth.split("T")[0] : "",
      gender: p.gender ?? "male",
      phone: p.phone ?? "",
      email: p.email ?? "",
      address: p.address ?? "",
      mrn: p.patientId ?? "",
      abha: p.abhaNumber ?? "",
      insuranceId: "",
      insurer: "Self-Pay / None",
      policyNo: "",
      groupNo: "",
    });
    setErrors({});
    setTouched({});
    setBanner(null);
    setSavedPatient(null);
  }, []);

  const startNew = useCallback(() => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setTouched({});
    setBanner(null);
    setSavedPatient(null);
    setEligibility("idle");
    setHipaaConsent(false);
    setTreatmentConsent(false);
    setTimeout(() => searchRef.current?.focus(), 30);
  }, []);

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (index >= 0 && index < results.length) pickPatient(results[index]);
    } else if (e.key === "Escape") {
      setShowResults(false);
    }
  };

  /* ── Field updates + real-time validation ── */
  const setField = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setTouched((t) => ({ ...t, [key]: true }));
    // live validation
    const e: FieldErrors = {};
    if (key === "dob" && value && isFutureDob(value)) e.dob = "Date of birth cannot be in the future";
    if (key === "phone" && value && !isValidPhone(value))
      e.phone = "Enter a valid 10-digit Indian mobile number";
    if (key === "email" && value && !isValidEmail(value)) e.email = "Enter a valid email address";
    if (key === "mrn" && value && !isValidMrn(value))
      e.mrn = "MRN must be 3–20 letters, numbers or dashes";
    if (key === "insuranceId" && value && value.replace(/[\s-]/g, "").length < 6)
      e.insuranceId = "Insurance ID must be at least 6 characters";
    setErrors((prev) => ({ ...prev, [key]: e[key] }));
  };

  const showError = (key: keyof FormState) => touched[key] && errors[key];

  const fieldCls = (key: keyof FormState, extra = "") =>
    `h-10 w-full rounded-md border bg-surface-0 px-3 text-sm transition-colors duration-fast focus:outline-none focus:ring-1 ${
      showError(key)
        ? "border-status-critical focus:border-status-critical focus:ring-red-100"
        : "border-line-300 focus:border-accent-500 focus:ring-accent-100"
    } ${extra}`;

  const labelCls = "field-label mb-1.5 block";

  /* ── Submit ── */
  const submit = async () => {
    // final validation pass
    const e: FieldErrors = {};
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    if (form.dob && isFutureDob(form.dob)) e.dob = "Date of birth cannot be in the future";
    if (form.phone && !isValidPhone(form.phone))
      e.phone = "Enter a valid 10-digit Indian mobile number";
    if (form.email && !isValidEmail(form.email)) e.email = "Enter a valid email address";
    if (form.mrn && !isValidMrn(form.mrn)) e.mrn = "MRN must be 3–20 letters, numbers or dashes";
    if (form.insuranceId && form.insuranceId.replace(/[\s-]/g, "").length < 6)
      e.insuranceId = "Insurance ID must be at least 6 characters";
    if (!hipaaConsent || !treatmentConsent) {
      setBanner({
        tone: "error",
        text: "HIPAA Privacy Notice and Consent to Treatment must be acknowledged before saving.",
      });
    }
    setErrors(e);
    setTouched({
      firstName: true,
      lastName: true,
      dob: true,
      phone: true,
      email: true,
      mrn: true,
      insuranceId: true,
    });
    if (Object.keys(e).length > 0 || !consentComplete) return;

    setSaving(true);
    setBanner(null);
    const body: CreatePatientData = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      dateOfBirth: form.dob || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      patientId: form.mrn.trim() || undefined,
      abhaNumber: form.abha.trim() || undefined,
    };
    try {
      const saved = isExisting
        ? await updatePatient(selected!.id, body)
        : await createPatient(body);
      setSavedPatient(saved as Patient);
      setBanner({
        tone: "success",
        text: isExisting
          ? "Patient demographics updated and verified."
          : "Patient registered — routed to Pathology Lab.",
      });
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string | string[] } } };
      const apiMsg = anyErr.response?.data?.message;
      setBanner({
        tone: "error",
        text: Array.isArray(apiMsg) ? apiMsg.join(", ") : apiMsg ?? "Save failed. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const eligibleLabel: Record<Eligibility, { text: string; cls: string }> = {
    idle: { text: "Not verified", cls: "border-line-300 bg-surface-100 text-ink-600" },
    checking: { text: "Verifying with payer…", cls: "border-accent-200 bg-accent-100/60 text-accent-700" },
    active: { text: "Eligible — coverage active", cls: "border-green-200 bg-green-50 text-status-normal" },
    pending: { text: "Pending payer review", cls: "border-amber-200 bg-amber-50 text-amber-700" },
    denied: { text: "Coverage not found", cls: "border-red-200 bg-red-50 text-status-critical" },
  };

  const checkEligibility = () => {
    if (!insuranceEntered) {
      setEligibility("idle");
      return;
    }
    setEligibility("checking");
    setTimeout(() => {
      // Mocked payer lookup — deterministic from the ID hash
      const h = form.insuranceId + form.policyNo;
      let acc = 0;
      for (let i = 0; i < h.length; i++) acc += h.charCodeAt(i);
      setEligibility(acc % 7 === 0 ? "denied" : acc % 3 === 0 ? "pending" : "active");
    }, 1200);
  };

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /* ── Render ── */
  return (
    <div className="h-full overflow-y-auto bg-surface-100">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-ink-950">
                Patient Registration
              </h1>
              <span className="inline-flex items-center gap-1 rounded-sm border border-accent-200 bg-accent-100/60 px-2 py-0.5 text-[11px] font-medium text-accent-700">
                <ShieldCheck className="size-3" />
                HIPAA
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-600">
              Front-desk & kiosk registration · {todayLabel}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-400">Attending staff</div>
            <div className="mt-0.5 text-sm font-semibold text-ink-950">
              {user?.firstName} {user?.lastName ?? ""}
            </div>
            <div className="text-[11px] capitalize text-accent-700">{user?.role ?? "receptionist"}</div>
          </div>
        </div>

        {banner && (
          <div
            className={`mb-5 flex items-center gap-2 rounded-md border px-3 py-2.5 text-xs font-medium ${
              banner.tone === "error"
                ? "border-red-200 bg-red-50 text-status-critical"
                : "border-green-200 bg-green-50 text-status-normal"
            }`}
          >
            {banner.tone === "error" ? (
              <AlertTriangle className="size-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="size-3.5 shrink-0" />
            )}
            {banner.text}
            <button
              onClick={() => setBanner(null)}
              className="ml-auto opacity-60 transition-opacity duration-fast hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Stepper */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    done
                      ? "bg-green-50 text-status-normal"
                      : active
                        ? "bg-accent-700 text-surface-0"
                        : "border border-line-300 bg-surface-0 text-ink-400"
                  }`}
                >
                  {done ? <CheckCircle2 className="size-3.5" /> : n}
                </div>
                <span
                  className={`hidden truncate text-[11px] font-medium sm:block ${
                    active ? "text-ink-950" : "text-ink-400"
                  }`}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 ${done ? "bg-green-200" : "bg-line-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Success / Done ── */}
        {savedPatient ? (
          <div className="rounded-md border border-green-200 bg-surface-0 shadow-raised">
            <div className="border-b border-line-200 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-status-normal">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-ink-950">
                    {isExisting ? "Demographics verified" : "Patient registered"}
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-600">
                    {isExisting
                      ? "Record updated — no consent re-capture needed for existing patients."
                      : "Encounter created — routed to Pathology Lab for order entry."}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 px-6 py-5 sm:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-400">Patient</div>
                <div className="mt-1 text-sm font-semibold text-ink-950">
                  {savedPatient.firstName} {savedPatient.lastName}
                </div>
                <div className="mt-0.5 text-xs capitalize text-ink-600">{savedPatient.gender}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-400">Patient ID</div>
                <div className="data-mono mt-1 text-sm font-semibold text-accent-700">
                  {savedPatient.patientId ?? savedPatient.id.slice(0, 8).toUpperCase()}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-400">DOB</div>
                <div className="mt-1 text-sm text-ink-950">{fmtDate(savedPatient.dateOfBirth)}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-200 bg-surface-100 px-6 py-3.5">
              <button
                onClick={startNew}
                className="inline-flex items-center gap-2 rounded-md border border-line-300 px-4 py-2 text-xs font-medium text-ink-600 transition-colors duration-fast hover:border-accent-500 hover:text-accent-700"
              >
                <UserPlus className="size-3.5" />
                Register Another
              </button>
              <button
                onClick={() => navigate("/registration")}
                className="inline-flex items-center gap-2 rounded-md bg-accent-700 px-5 py-2.5 text-xs font-semibold text-surface-0 shadow-raised transition-colors duration-fast hover:bg-accent-500"
              >
                <ClipboardList className="size-4" />
                Continue to Order Entry
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Step 1: Smart search ── */}
            <div className="rounded-md border border-line-200 bg-surface-0 p-5 shadow-raised">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-sm bg-accent-100 text-accent-700">
                    <UserCheck className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-ink-950">Identify Patient</h2>
                    <p className="mt-0.5 text-xs text-ink-600">
                      Search by name, phone, MRN or ABHA — or register a new patient
                    </p>
                  </div>
                </div>
                {selected && (
                  <button
                    onClick={startNew}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-line-300 px-2.5 py-1.5 text-[11px] font-medium text-ink-600 transition-colors duration-fast hover:border-accent-500 hover:text-accent-700"
                  >
                    <UserPlus className="size-3" /> New Patient
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setIndex(-1);
                  }}
                  onKeyDown={onSearchKey}
                  onFocus={() => results.length > 0 && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  placeholder="Type a name, phone, MRN, or ABHA number… (↓↑ navigate · Enter select)"
                  className="h-11 w-full rounded-md border border-line-300 bg-surface-0 pl-10 pr-10 text-sm transition-colors duration-fast focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-100"
                />
                {searching ? (
                  <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-400" />
                ) : (
                  search && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setResults([]);
                        setShowResults(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 transition-colors duration-fast hover:text-ink-950"
                      aria-label="Clear search"
                    >
                      <X className="size-4" />
                    </button>
                  )
                )}
              </div>

              {showResults && (
                <div className="mt-2 overflow-hidden rounded-md border border-line-200">
                  {results.map((p, i) => (
                    <button
                      key={p.id}
                      onMouseDown={() => pickPatient(p)}
                      onMouseEnter={() => setIndex(i)}
                      className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-fast ${
                        i === index ? "border-l-2 border-accent-500 bg-accent-100/40" : "border-l-2 border-transparent hover:bg-surface-100"
                      }`}
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-bold text-accent-700">
                        {initials(p)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink-950">
                          {p.firstName} {p.lastName}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-600">
                          {p.phone && <span className="data-mono">{p.phone}</span>}
                          {p.patientId && <span className="data-mono">MRN {p.patientId}</span>}
                          {p._count?.orders !== undefined && (
                            <span>{p._count.orders} visit{p._count.orders === 1 ? "" : "s"}</span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-line-300 transition-colors duration-fast group-hover:text-accent-500" />
                    </button>
                  ))}
                </div>
              )}

              {search.trim().length >= 2 && !searching && results.length === 0 && (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-dashed border-line-300 bg-surface-100 px-3.5 py-3">
                  <div className="flex items-center gap-2 text-xs text-ink-600">
                    <AlertTriangle className="size-3.5 text-amber-600" />
                    No patient matches “{search.trim()}”
                  </div>
                  <button
                    onClick={startNew}
                    className="inline-flex items-center gap-1.5 rounded-sm bg-accent-700 px-3 py-1.5 text-[11px] font-semibold text-surface-0 transition-colors duration-fast hover:bg-accent-500"
                  >
                    <UserPlus className="size-3" /> Register New
                  </button>
                </div>
              )}

              {selected && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-accent-200 bg-accent-100/40 px-3.5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-700 text-xs font-bold text-surface-0">
                      {initials(selected)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink-950">
                        {selected.firstName} {selected.lastName}
                      </div>
                      <div className="mt-0.5 text-[11px] text-ink-600">
                        {selected.phone ?? "—"} · {fmtDate(selected.dateOfBirth)} ·{" "}
                        {selected._count?.orders ?? 0} prior visit{(selected._count?.orders ?? 0) === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-sm bg-green-50 px-2 py-1 text-[10px] font-semibold text-status-normal">
                    <CheckCircle2 className="size-3" /> Existing — verify below
                  </span>
                </div>
              )}
            </div>

            {/* ── Steps 2–3: Form ── */}
            <div className="mt-5 rounded-md border border-line-200 bg-surface-0 p-5 shadow-raised">
              {/* Demographics */}
              <div className="mb-5 flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-sm bg-accent-100 text-accent-700">
                  <User className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-ink-950">
                    {isExisting ? "Verify / Update Demographics" : "New Patient Registration"}
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-600">
                    {isExisting
                      ? "Current details are loaded — correct anything that changed"
                      : "All fields validate in real time to prevent entry errors"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-4">
                    <div>
                      <label className={labelCls}>Title</label>
                      <select
                        value={form.title}
                        onChange={(e) => setField("title", e.target.value)}
                        className={fieldCls("title")}
                      >
                        {TITLES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>First name <span className="text-status-critical">*</span></label>
                      <input
                        type="text"
                        value={form.firstName}
                        onChange={(e) => setField("firstName", e.target.value)}
                        placeholder="First name"
                        className={fieldCls("firstName")}
                      />
                      {showError("firstName") && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-status-critical">
                          <AlertTriangle className="size-3" /> {errors.firstName}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>Last name <span className="text-status-critical">*</span></label>
                      <input
                        type="text"
                        value={form.lastName}
                        onChange={(e) => setField("lastName", e.target.value)}
                        placeholder="Last name"
                        className={fieldCls("lastName")}
                      />
                      {showError("lastName") && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-status-critical">
                          <AlertTriangle className="size-3" /> {errors.lastName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>
                    <Calendar className="mr-1 inline size-3.5 text-ink-400" /> Date of birth
                  </label>
                  <input
                    type="date"
                    value={form.dob}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setField("dob", e.target.value)}
                    className={fieldCls("dob")}
                  />
                  {showError("dob") && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-status-critical">
                      <AlertTriangle className="size-3" /> {errors.dob}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setField("gender", e.target.value)}
                    className={fieldCls("gender")}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>
                    <Phone className="mr-1 inline size-3.5 text-ink-400" /> Mobile
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="10-digit mobile"
                    className={fieldCls("phone")}
                  />
                  {showError("phone") && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-status-critical">
                      <AlertTriangle className="size-3" /> {errors.phone}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>
                    <Mail className="mr-1 inline size-3.5 text-ink-400" /> Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder="name@example.com"
                    className={fieldCls("email")}
                  />
                  {showError("email") && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-status-critical">
                      <AlertTriangle className="size-3" /> {errors.email}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className={labelCls}>
                    <MapPin className="mr-1 inline size-3.5 text-ink-400" /> Address
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                    placeholder="Street, city, pincode"
                    className={fieldCls("address")}
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    <IdCard className="mr-1 inline size-3.5 text-ink-400" /> MRN / Patient ID
                  </label>
                  <input
                    type="text"
                    value={form.mrn}
                    onChange={(e) => setField("mrn", e.target.value)}
                    placeholder="e.g. THL-2024-00123"
                    className={fieldCls("mrn")}
                  />
                  {showError("mrn") && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-status-critical">
                      <AlertTriangle className="size-3" /> {errors.mrn}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>ABHA Number</label>
                  <input
                    type="text"
                    value={form.abha}
                    onChange={(e) => setField("abha", e.target.value)}
                    placeholder="10-digit ABHA"
                    className={fieldCls("abha")}
                  />
                </div>
              </div>

              {/* ── Insurance & Consent ── */}
              <div className="border-t border-line-200 pt-5">
                <div className="mb-5 flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-sm bg-accent-100 text-accent-700">
                    <Building2 className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-ink-950">Insurance & Payer Details</h2>
                    <p className="mt-0.5 text-xs text-ink-600">
                      Sensitive fields are masked — reveal only when needed to prevent shoulder-surfing
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>
                      <Lock className="mr-1 inline size-3.5 text-ink-400" /> Insurance ID
                    </label>
                    <div className="relative">
                      <input
                        type={revealId ? "text" : "password"}
                        value={form.insuranceId}
                        onChange={(e) => setField("insuranceId", e.target.value)}
                        placeholder={revealId ? "e.g. SH-482913" : "••••••••"}
                        className={fieldCls("insuranceId") + (form.insuranceId ? " pr-10" : "")}
                      />
                      {form.insuranceId && (
                        <button
                          type="button"
                          onClick={() => setRevealId((r) => !r)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 transition-colors duration-fast hover:text-accent-700"
                          aria-label={revealId ? "Mask insurance ID" : "Reveal insurance ID"}
                          title={revealId ? "Mask" : "Reveal"}
                        >
                          {revealId ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      )}
                    </div>
                    {showError("insuranceId") && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-status-critical">
                        <AlertTriangle className="size-3" /> {errors.insuranceId}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>Insurer / Payer</label>
                    <select
                      value={form.insurer}
                      onChange={(e) => setField("insurer", e.target.value)}
                      className={fieldCls("insurer")}
                    >
                      {INSURERS.map((ins) => (
                        <option key={ins}>{ins}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Policy number</label>
                    <input
                      type="text"
                      value={form.policyNo}
                      onChange={(e) => setField("policyNo", e.target.value)}
                      placeholder="Policy #"
                      className={fieldCls("policyNo")}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Group / TPA ID</label>
                    <input
                      type="text"
                      value={form.groupNo}
                      onChange={(e) => setField("groupNo", e.target.value)}
                      placeholder="Group or TPA reference"
                      className={fieldCls("groupNo")}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex flex-wrap items-center gap-3 rounded-md border border-line-200 bg-surface-100 px-3.5 py-3">
                      <div className="flex items-center gap-2 text-xs text-ink-600">
                        <ShieldCheck className="size-4 text-accent-700" />
                        Payer eligibility check
                      </div>
                      <button
                        type="button"
                        onClick={checkEligibility}
                        disabled={eligibility === "checking" || !insuranceEntered}
                        className="inline-flex items-center gap-1.5 rounded-sm border border-accent-500 px-3 py-1.5 text-[11px] font-semibold text-accent-700 transition-colors duration-fast hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {eligibility === "checking" ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Search className="size-3" />
                        )}
                        {eligibility === "checking" ? "Verifying…" : "Verify against payer"}
                      </button>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[11px] font-medium ${eligibleLabel[eligibility].cls}`}
                      >
                        {eligibility === "active" && <CheckCircle2 className="size-3" />}
                        {eligibility === "denied" && <AlertTriangle className="size-3" />}
                        {eligibility === "pending" && <Loader2 className="size-3" />}
                        {eligibleLabel[eligibility].text}
                      </span>
                      {eligibility !== "idle" && eligibility !== "checking" && (
                        <span className="text-[10px] text-ink-400">
                          Mocked payer lookup — wire to real API for production
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Consent (HIPAA) ── */}
                <div className="mt-5 rounded-md border border-line-200 bg-surface-100/60">
                  <div className="flex items-center gap-2 border-b border-line-200 px-4 py-3">
                    <FileCheck2 className="size-4 text-accent-700" />
                    <h3 className="text-sm font-semibold text-ink-950">Consent & Privacy</h3>
                    <span className="ml-auto rounded-sm bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-status-critical">
                      Required before save
                    </span>
                  </div>
                  <div className="space-y-3 px-4 py-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={hipaaConsent}
                        onChange={(e) => setHipaaConsent(e.target.checked)}
                        className="mt-0.5 size-4 shrink-0 rounded-sm border-line-300 accent-accent-700"
                      />
                      <span className="text-xs leading-relaxed text-ink-700">
                        <span className="font-semibold text-ink-950">HIPAA Privacy Notice.</span>{" "}
                        I acknowledge the lab's privacy practices, how health information is used and
                        shared, and my right to request a copy of this notice at any time.
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={treatmentConsent}
                        onChange={(e) => setTreatmentConsent(e.target.checked)}
                        className="mt-0.5 size-4 shrink-0 rounded-sm border-line-300 accent-accent-700"
                      />
                      <span className="text-xs leading-relaxed text-ink-700">
                        <span className="font-semibold text-ink-950">Consent to Treatment.</span>{" "}
                        I consent to sample collection, diagnostic testing, and processing of my
                        specimens by the laboratory and its authorised staff.
                      </span>
                    </label>
                    {!consentComplete && step >= 2 && validName && (
                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                        <AlertTriangle className="size-3.5" />
                        Both consents are required to save this registration.
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Actions ── */}
                <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={startNew}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-md border border-line-300 px-5 py-2.5 text-xs font-medium text-ink-600 transition-colors duration-fast hover:border-line-400 hover:bg-surface-100 disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={saving}
                    className="inline-flex min-w-44 items-center justify-center gap-2 rounded-md bg-accent-700 px-6 py-2.5 text-xs font-semibold text-surface-0 shadow-raised transition-colors duration-fast hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    {saving ? "Saving…" : isExisting ? "Save & Verify" : "Save & Continue"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
