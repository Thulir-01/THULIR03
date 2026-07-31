import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Search, Trash2, HelpCircle, User, X, Loader2, ChevronDown, Phone, Calendar, ArrowLeft } from "lucide-react";
import { registerPatient, getPatients } from "../lib/api-client";

// ─── DATA ─────────────────────────────────────────────────────────

const BRANCHES = ["NOOR HOSPITAL", "Main Lab", "City Branch", "North Clinic"];
const TITLES = ["Mr.", "Mrs.", "Ms.", "Dr.", "Baby", "Master"];
const CATEGORIES = ["Normal", "Urgent", "STAT", "Camp"];
const REFERRERS = [
  "Dr. Senthil Kumar - Cardiologist",
  "Dr. Priya Sharma - Gynecologist",
  "Dr. Rajesh - Orthopedic",
  "Walk-in",
  "Other",
];
const SOURCES = ["Walk-in", "Camp", "Home Collection", "Referral", "Hospital"];
const COLLECTION_BOYS = ["Not Assigned", "Raju", "Suresh", "Mani", "Kumar"];
const PATIENT_TYPES = ["Outpatient", "Inpatient", "Camp", "Insurance"];
const DELIVERY_MODES = ["Print", "SMS", "Email", "WhatsApp", "Portal"];
const DISC_AUTH = ["Not Required", "Lab Manager", "Admin", "Doctor"];
const PAYMENT_MODES = ["Cash", "Card", "UPI", "Cheque", "Insurance"];
const TESTS_LIST = [
  { code: "CBC", name: "Complete Blood Count", rate: 350 },
  { code: "BSF", name: "Blood Sugar Fasting", rate: 80 },
  { code: "HBA1C", name: "HbA1c", rate: 450 },
  { code: "LIPID", name: "Lipid Profile", rate: 600 },
  { code: "LFT", name: "Liver Function Test", rate: 500 },
  { code: "RFT", name: "Renal Function Test", rate: 450 },
  { code: "T3", name: "T3", rate: 350 },
  { code: "T4", name: "T4", rate: 350 },
  { code: "TSH", name: "TSH", rate: 350 },
  { code: "THYROID", name: "Thyroid Profile", rate: 700 },
  { code: "URINE", name: "Urine Routine", rate: 120 },
  { code: "WIDAL", name: "Widal Test", rate: 200 },
  { code: "DENGUE", name: "Dengue NS1", rate: 900 },
  { code: "MALARIA", name: "Malaria Antigen", rate: 350 },
  { code: "VITD", name: "Vitamin D", rate: 1200 },
  { code: "VITB12", name: "Vitamin B12", rate: 800 },
  { code: "IRON", name: "Iron Studies", rate: 600 },
  { code: "CRP", name: "CRP Quantitative", rate: 400 },
  { code: "ESR", name: "ESR", rate: 100 },
  { code: "BTCT", name: "Bleeding Time / Clotting Time", rate: 150 },
  { code: "PTINR", name: "PT / INR", rate: 250 },
  { code: "HIV", name: "HIV Rapid", rate: 300 },
  { code: "HBSAG", name: "HBsAg", rate: 250 },
  { code: "HCV", name: "HCV Rapid", rate: 300 },
];

interface SelTest {
  id: string;
  code: string;
  name: string;
  rate: number;
}

interface PatientResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  email: string | null;
  _count?: { orders: number };
}

// ─── REUSABLE STYLES ──────────────────────────────────────────────

const inputBase = [
  "h-8 px-2.5 border border-gray-300 rounded-md text-sm",
  "bg-white",
  "focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200",
  "transition-colors",
].join(" ");

const inputReadonly = inputBase + " bg-gray-50 text-gray-500 cursor-default";
const selectBase = inputBase + " cursor-pointer appearance-none";
const labelBase = "text-xs font-medium text-gray-500 text-right leading-8 shrink-0";

type FieldProps = { label: string; w: string; children: React.ReactNode };
function Field({ label, w, children }: FieldProps) {
  return (
    <div className="flex items-center gap-1.5">
      <label className={`${labelBase} ${w}`}>{label}</label>
      {children}
    </div>
  );
}

export default function PatientRegistrationPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  // === Patient Search ===
  const [patientId, setPatientId] = useState<string>("");
  const [pSearch, setPSearch] = useState("");
  const [pResults, setPResults] = useState<PatientResult[]>([]);
  const [pIndex, setPIndex] = useState(-1);
  const [pSearching, setPSearching] = useState(false);
  const [pShowDropdown, setPShowDropdown] = useState(false);
  const pSearchRef = useRef<HTMLInputElement>(null);
  const pDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Header
  const [branch, setBranch] = useState("NOOR HOSPITAL");
  const [category, setCategory] = useState("Normal");
  const [sidDate, setSidDate] = useState(today);
  const [refNo, setRefNo] = useState("");

  // Patient
  const [title, setTitle] = useState("Mr.");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [ageY, setAgeY] = useState("");
  const [ageM, setAgeM] = useState("");
  const [sex, setSex] = useState("male");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [referrer, setReferrer] = useState("");
  const [source, setSource] = useState("Walk-in");
  const [insurance, setInsurance] = useState("");
  const [collBoy, setCollBoy] = useState("");
  const [patType, setPatType] = useState("Outpatient");
  const [ward, setWard] = useState("");
  const [ipop, setIpop] = useState("");
  const [bed, setBed] = useState("");

  // Tests
  const [selTests, setSelTests] = useState<SelTest[]>([]);
  const [tSearch, setTSearch] = useState("");
  const [tIndex, setTIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Billing
  const [sampDt, setSampDt] = useState(today);
  const [otherCh, setOtherCh] = useState(0);
  const [discPct, setDiscPct] = useState(0);
  const [discAuth, setDiscAuth] = useState("");
  const [paidAmt, setPaidAmt] = useState(0);
  const [payMode, setPayMode] = useState("Cash");
  const [bankName, setBankName] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payDt, setPayDt] = useState(today);
  const [payRem, setPayRem] = useState("");
  const [delMode, setDelMode] = useState("Print");
  const [clinRem, setClinRem] = useState("");
  const [fRptDt, setFRptDt] = useState("");
  const [remarks, setRemarks] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [billHf, setBillHf] = useState(false);
  const [conBill, setConBill] = useState(false);

  // Computed
  const subTotal = selTests.reduce((s, t) => s + t.rate, 0);
  const discAmt = subTotal * (discPct / 100);
  const totalAmt = subTotal + otherCh - discAmt;
  const balance = totalAmt - paidAmt;

  // ─── Patient Search ──────────────────────────────────────────

  useEffect(() => {
    if (pDebounceRef.current) clearTimeout(pDebounceRef.current);

    if (pSearch.trim().length < 2) {
      setPResults([]);
      setPShowDropdown(false);
      return;
    }

    setPSearching(true);
    pDebounceRef.current = setTimeout(async () => {
      try {
        const results = await getPatients(pSearch.trim());
        setPResults(results);
        setPShowDropdown(results.length > 0);
        setPIndex(-1);
      } catch {
        setPResults([]);
      } finally {
        setPSearching(false);
      }
    }, 300);

    return () => {
      if (pDebounceRef.current) clearTimeout(pDebounceRef.current);
    };
  }, [pSearch]);

  const selectPatient = useCallback((pat: PatientResult) => {
    setPatientId(pat.id);
    setPSearch("");
    setPShowDropdown(false);

    // Auto-fill patient fields
    setFirstName(pat.firstName);
    setLastName(pat.lastName || "");
    setMobile(pat.phone || "");
    setEmail(pat.email || "");

    // Gender
    if (pat.gender) setSex(pat.gender);

    // DOB → auto-calculate age
    if (pat.dateOfBirth) {
      const d = pat.dateOfBirth.split("T")[0];
      setDob(d);
      const b = new Date(d), n = new Date();
      let y = n.getFullYear() - b.getFullYear();
      let m = n.getMonth() - b.getMonth();
      if (m < 0) { y--; m += 12; }
      setAgeY(String(y));
      setAgeM(String(m));
    }

    // Auto-select title based on gender
    if (pat.gender === "male") setTitle("Mr.");
    else if (pat.gender === "female") setTitle(pat.firstName.endsWith("a") ? "Ms." : "Mrs.");
  }, []);

  const clearPatientSearch = () => {
    setPatientId("");
    setPSearch("");
    setPResults([]);
    setPShowDropdown(false);
    pSearchRef.current?.focus();
  };

  const onPSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPIndex((p) => Math.min(p + 1, pResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPIndex((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (pIndex >= 0 && pIndex < pResults.length) {
        selectPatient(pResults[pIndex]);
      }
    } else if (e.key === "Escape") {
      setPShowDropdown(false);
    }
  };

  // ─── Test Search ─────────────────────────────────────────────

  const filtered = tSearch.trim()
    ? TESTS_LIST.filter(
        (t) =>
          !selTests.some((s) => s.code === t.code) &&
          (t.name.toLowerCase().includes(tSearch.toLowerCase()) ||
            t.code.toLowerCase().includes(tSearch.toLowerCase()))
      )
    : [];

  useEffect(() => {
    if (listRef.current && tIndex >= 0) {
      const el = listRef.current.children[tIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [tIndex]);

  const addTest = useCallback(
    (code: string, name: string, rate: number) => {
      setSelTests((p) => [...p, { id: code + Date.now(), code, name, rate }]);
      setTSearch(""); setTIndex(-1);
      inputRef.current?.focus();
    }, []
  );

  const removeTest = (id: string) => setSelTests((p) => p.filter((t) => t.id !== id));

  const onDOB = (val: string) => {
    setDob(val);
    if (val) {
      const b = new Date(val), n = new Date();
      let y = n.getFullYear() - b.getFullYear();
      let m = n.getMonth() - b.getMonth();
      if (m < 0) { y--; m += 12; }
      setAgeY(String(y)); setAgeM(String(m));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setTIndex((p) => Math.min(p + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setTIndex((p) => Math.max(p - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (tIndex >= 0 && tIndex < filtered.length) addTest(filtered[tIndex].code, filtered[tIndex].name, filtered[tIndex].rate);
      else if (filtered.length === 1) addTest(filtered[0].code, filtered[0].name, filtered[0].rate);
    } else if (e.key === "Escape") { setTSearch(""); setTIndex(-1); }
  };

  const onClear = () => {
    setPatientId("");
    setPSearch("");
    setPResults([]);
    setPShowDropdown(false);
    setFirstName(""); setLastName(""); setDob(""); setAgeY(""); setAgeM("");
    setMobile(""); setEmail(""); setReferrer(""); setSource("Walk-in");
    setInsurance(""); setCollBoy(""); setPatType("Outpatient");
    setWard(""); setIpop(""); setBed(""); setRefNo("");
    setSelTests([]); setOtherCh(0); setDiscPct(0); setDiscAuth("");
    setPaidAmt(0); setPayMode("Cash"); setBankName(""); setPayRef("");
    setPayDt(today); setPayRem(""); setDelMode("Print"); setClinRem("");
    setEmergency(false); setFRptDt(""); setRemarks(""); setSidDate(today);
    setCategory("Normal"); setBranch("NOOR HOSPITAL"); setTSearch("");
    setBillHf(false); setConBill(false);
  };

  const onSave = async () => {
    if (!patientId && !firstName) { setError("Search or enter patient name"); return; }
    if (selTests.length === 0) { setError("At least one test must be selected"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await registerPatient({
        patientId: patientId || undefined,
        firstName, lastName, title, dateOfBirth: dob || undefined,
        ageYears: ageY ? parseInt(ageY) : undefined,
        ageMonths: ageM ? parseInt(ageM) : undefined,
        gender: sex, phone: mobile || undefined, email: email || undefined,
        referrer: referrer || undefined, source, insurance: insurance || undefined,
        collectionBoy: collBoy || undefined, patientType: patType,
        ward: ward || undefined, ipOpNo: ipop || undefined, bedNo: bed || undefined,
        category, sidDate: sidDate || undefined, refNo: refNo || undefined,
        branch,
        tests: selTests.map((t) => ({ code: t.code, name: t.name, rate: t.rate })),
        sampleCollectDate: sampDt || undefined,
        otherCharges: otherCh || undefined, discountPercent: discPct || undefined,
        discountAuth: discAuth || undefined, amountPaid: paidAmt || undefined,
        paymentMode: payMode, bankName: bankName || undefined,
        paymentRef: payRef || undefined, paymentDate: payDt || undefined,
        paymentRemarks: payRem || undefined, deliveryMode: delMode,
        clinicalRemarks: clinRem || undefined, emergency,
        finalReportDate: fRptDt || undefined, remarks: remarks || undefined,
        billHf, consolidatedBill: conBill,
      });
      alert(`Patient Registered Successfully!\nOrder: ${res.orderNumber}`);
      onClear();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ─── RENDER ─────────────────────────────────────────────────

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100 flex flex-col">
      {/* TOP BAR */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-base tracking-wide">THULIR03</span>
          <span className="text-teal-300/60">|</span>
          <span className="text-sm font-medium text-teal-50">Patient Registration</span>
        </div>
        <button onClick={() => navigate("/dashboard")}
          className="text-xs px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white transition-colors font-medium">
          Dashboard
        </button>
      </div>

      <div className="flex-1 overflow-hidden p-2.5">
        <div className="h-full flex gap-2.5">

          {/* ═══ LEFT: Header + Patient + Tests ═══ */}
          <div className="w-[55%] flex flex-col gap-2.5 min-h-0">

            {/* ── PATIENT SEARCH ── */}
            <div className="bg-white rounded-lg border border-blue-200/80 px-3.5 py-2.5 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-5 bg-blue-500 rounded-full shrink-0" />
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Search Existing Patient</span>
              </div>

              {patientId ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                      {firstName.charAt(0)}{lastName.charAt(0)}
                    </div>
                    <div>
                      <span className="font-medium text-sm text-gray-800">{firstName} {lastName}</span>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
                        {mobile && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{mobile}</span>}
                        {dob && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{dob}</span>}
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                          {patientId.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={clearPatientSearch}
                    className="text-xs px-3 h-7 border border-blue-300 text-blue-600 rounded-md hover:bg-blue-100 transition-colors font-medium flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input ref={pSearchRef}
                      type="text"
                      placeholder="Search by name or phone... (↓↑ navigate, Enter select)"
                      value={pSearch}
                      onChange={(e) => { setPSearch(e.target.value); setPIndex(-1); }}
                      onKeyDown={onPSearchKeyDown}
                      onFocus={() => { if (pResults.length > 0) setPShowDropdown(true); }}
                      onBlur={() => setTimeout(() => setPShowDropdown(false), 200)}
                      className={"w-full h-8 pl-8 pr-8 " + inputBase}
                    />
                    {pSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />}
                    {!pSearching && pSearch && (
                      <button onClick={() => { setPSearch(""); setPResults([]); setPShowDropdown(false); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {pShowDropdown && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {pSearching ? (
                        <div className="px-3 py-3 text-sm text-gray-400 text-center">Searching...</div>
                      ) : pResults.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-gray-400 text-center">No matching patients found</div>
                      ) : (
                        pResults.map((pat, i) => (
                          <button key={pat.id}
                            onMouseDown={() => selectPatient(pat)}
                            onMouseEnter={() => setPIndex(i)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors ${
                              i === pIndex ? "bg-blue-50 border-l-2 border-blue-500" : "hover:bg-gray-50"
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-blue-700 font-semibold text-xs shrink-0">
                              {pat.firstName.charAt(0)}{pat.lastName?.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-800 truncate">
                                {pat.firstName} {pat.lastName}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                {pat.phone && <span>{pat.phone}</span>}
                                {pat.gender && <span className="capitalize">| {pat.gender}</span>}
                                {pat._count?.orders !== undefined && <span>| {pat._count.orders} visits</span>}
                              </div>
                            </div>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-300 rotate-[-90deg] shrink-0" />
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── HEADER ── */}
            <div className="bg-white rounded-lg border border-gray-200/80 px-3.5 py-2.5 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-2 flex-wrap">
                <Field label="Branch" w="w-12">
                  <select value={branch} onChange={(e) => setBranch(e.target.value)} className={selectBase + " w-36"}>
                    {BRANCHES.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Date" w="w-9">
                  <input type="date" value={today} readOnly className={inputReadonly + " w-32"} />
                </Field>
                <Field label="No" w="w-7">
                  <input type="text" value="REG-0001" readOnly className={inputReadonly + " w-24"} />
                </Field>
                <Field label="Category" w="w-14">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectBase + " w-28"}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="SID Dt" w="w-12">
                  <input type="date" value={sidDate} onChange={(e) => setSidDate(e.target.value)} className={inputBase + " w-28"} />
                </Field>
                <Field label="Ref No" w="w-11">
                  <input type="text" value={refNo} onChange={(e) => setRefNo(e.target.value)} className={inputBase + " w-28"} />
                </Field>
              </div>
            </div>

            {/* ── PATIENT ── */}
            <div className="bg-white rounded-lg border border-gray-200/80 px-3.5 py-2.5 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="text-xs font-semibold text-teal-700 border-b border-teal-100 pb-2 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                <User className="w-3.5 h-3.5" /> Patient Information
                {patientId && <span className="ml-auto normal-case text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">Existing Patient</span>}
              </div>

              <div className="flex flex-col gap-2">
                {/* Row 1 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Field label="Code" w="w-10">
                    <input type="text" value={patientId ? patientId.slice(0, 8).toUpperCase() : "NEW"} readOnly className={inputReadonly + " w-20"} />
                  </Field>
                  <Field label="Title" w="w-9">
                    <select value={title} onChange={(e) => setTitle(e.target.value)} className={selectBase + " w-20"}>
                      {TITLES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <div className="flex items-center gap-1.5">
                    <label className={`${labelBase} w-9`}>Name</label>
                    <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputBase + " w-28"} />
                    <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputBase + " w-28"} />
                    <button className="p-1.5 text-teal-500 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors shrink-0"><HelpCircle className="w-3.5 h-3.5" /></button>
                    <button className="px-2.5 h-7 text-xs text-blue-600 hover:bg-blue-50 rounded-md font-medium shrink-0 border border-blue-200 transition-colors">Edit</button>
                  </div>
                  <Field label="Sex" w="w-8">
                    <select value={sex} onChange={(e) => setSex(e.target.value)} className={selectBase + " w-20"}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                </div>

                {/* Row 2 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Field label="DOB" w="w-9">
                    <input type="date" value={dob} onChange={(e) => onDOB(e.target.value)} className={inputBase + " w-32"} />
                  </Field>
                  <div className="flex items-center gap-1">
                    <label className={`${labelBase} w-8`}>Age</label>
                    <input type="number" value={ageY} onChange={(e) => setAgeY(e.target.value)} className={inputBase + " w-12 text-center"} placeholder="Y" />
                    <span className="text-[10px] text-gray-400 w-3">Y</span>
                    <input type="number" value={ageM} onChange={(e) => setAgeM(e.target.value)} className={inputBase + " w-12 text-center"} placeholder="M" />
                    <span className="text-[10px] text-gray-400 w-3">M</span>
                  </div>
                  <Field label="Mobile" w="w-11">
                    <input type="tel" placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} className={inputBase + " w-32"} />
                  </Field>
                  <Field label="Email" w="w-10">
                    <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputBase + " w-44"} />
                  </Field>
                </div>

                {/* Row 3 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Field label="Referrer" w="w-14">
                    <select value={referrer} onChange={(e) => setReferrer(e.target.value)} className={selectBase + " w-48"}>
                      <option value="">-- Select Referrer --</option>
                      {REFERRERS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </Field>
                  <button className="p-1.5 text-teal-500 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors"><HelpCircle className="w-3.5 h-3.5" /></button>
                  <Field label="Source" w="w-11">
                    <select value={source} onChange={(e) => setSource(e.target.value)} className={selectBase + " w-32"}>
                      {SOURCES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Insurance" w="w-14">
                    <input type="text" placeholder="Insurance Details" value={insurance} onChange={(e) => setInsurance(e.target.value)} className={inputBase + " w-40"} />
                  </Field>
                </div>

                {/* Row 4 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Field label="Coll Boy" w="w-12">
                    <select value={collBoy} onChange={(e) => setCollBoy(e.target.value)} className={selectBase + " w-28"}>
                      <option value="">-- Select --</option>
                      {COLLECTION_BOYS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Pat Type" w="w-13">
                    <select value={patType} onChange={(e) => setPatType(e.target.value)} className={selectBase + " w-28"}>
                      <option value="">-- Select --</option>
                      {PATIENT_TYPES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Ward" w="w-9">
                    <input type="text" placeholder="Ward" value={ward} onChange={(e) => setWard(e.target.value)} className={inputBase + " w-24"} />
                  </Field>
                  <Field label="IP/OP" w="w-10">
                    <input type="text" placeholder="No" value={ipop} onChange={(e) => setIpop(e.target.value)} className={inputBase + " w-24"} />
                  </Field>
                  <Field label="Bed" w="w-8">
                    <input type="text" placeholder="No" value={bed} onChange={(e) => setBed(e.target.value)} className={inputBase + " w-20"} />
                  </Field>
                </div>
              </div>
            </div>

            {/* ── TEST ORDER ── */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200/80 p-3 flex flex-col gap-2.5 min-h-0 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="text-xs font-semibold text-teal-700 border-b border-teal-100 pb-2 flex items-center gap-1.5 shrink-0 uppercase tracking-wider">
                <Search className="w-3.5 h-3.5" /> Test / Profile Selection
              </div>

              {/* Search */}
              <div className="relative shrink-0">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input ref={inputRef} type="text"
                      placeholder="Search by test name or code...  (↓↑ navigate, Enter add, Esc close)"
                      value={tSearch}
                      onChange={(e) => { setTSearch(e.target.value); setTIndex(-1); }}
                      onKeyDown={onKeyDown}
                      onFocus={() => tSearch && setTIndex(-1)}
                      className={"w-full h-8 pl-8 pr-3 " + inputBase}
                    />
                    {tSearch && (
                      <button onClick={() => { setTSearch(""); setTIndex(-1); inputRef.current?.focus(); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {tSearch && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                    {filtered.length === 0 && <div className="px-3 py-2.5 text-sm text-gray-400">No matching tests found</div>}
                    <div ref={listRef}>
                      {filtered.map((t, i) => (
                        <button key={t.code}
                          onMouseDown={() => addTest(t.code, t.name, t.rate)}
                          onMouseEnter={() => setTIndex(i)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
                            i === tIndex ? "bg-teal-50 border-l-2 border-teal-500" : "hover:bg-gray-50"
                          }`}
                        >
                          <span className="font-mono text-[11px] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded w-14 text-center shrink-0">{t.code}</span>
                          <span className="flex-1 text-gray-700 truncate">{t.name}</span>
                          <span className="text-gray-500 font-medium shrink-0">₹{t.rate}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden min-h-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-16">Code</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500 text-[11px] uppercase tracking-wider">Test Name</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-24">Rate (₹)</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-500 text-[11px] uppercase tracking-wider w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {selTests.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">No tests selected</td></tr>
                    )}
                    {selTests.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-1.5 font-mono text-xs text-teal-600">{t.code}</td>
                        <td className="px-3 py-1.5 text-gray-800">{t.name}</td>
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">₹{t.rate}</td>
                        <td className="px-3 py-1.5 text-center">
                          <button onClick={() => removeTest(t.id)}
                            className="text-red-300 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="flex items-center justify-between text-sm text-gray-600 border-t border-gray-100 pt-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-gray-400">Tests</span>
                  <span className="bg-teal-50 text-teal-700 font-bold text-sm px-2.5 py-0.5 rounded-md">{selTests.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-gray-400">Sub Total</span>
                  <span className="font-bold text-gray-900 text-base tabular-nums">₹{subTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ RIGHT: Billing + Payment ═══ */}
          <div className="flex-1 flex flex-col gap-2.5 min-h-0">

            {/* ── BILLING ── */}
            <div className="bg-white rounded-lg border border-gray-200/80 px-3.5 py-2.5 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="text-xs font-semibold text-teal-700 border-b border-teal-100 pb-2 mb-2.5 flex items-center justify-between uppercase tracking-wider">
                <span>Billing Details</span>
                <div className="flex items-center gap-3 normal-case">
                  <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none hover:text-teal-700 transition-colors">
                    <input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} className="w-3.5 h-3.5 rounded" />
                    <span className="font-medium text-teal-700">Emergency</span>
                  </label>
                  <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none hover:text-gray-700 transition-colors">
                    <input type="checkbox" checked={billHf} onChange={(e) => setBillHf(e.target.checked)} className="w-3.5 h-3.5 rounded" />
                    <span className="text-gray-500">Bill H/F</span>
                  </label>
                  <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none hover:text-gray-700 transition-colors">
                    <input type="checkbox" checked={conBill} onChange={(e) => setConBill(e.target.checked)} className="w-3.5 h-3.5 rounded" />
                    <span className="text-gray-500">Consolidated</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {/* Row 1 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Field label="Sample Collect" w="w-24">
                    <input type="date" value={sampDt} onChange={(e) => setSampDt(e.target.value)} className={inputBase + " w-36"} />
                  </Field>
                  <Field label="Bill Amt" w="w-13">
                    <input type="number" value={subTotal.toFixed(2)} readOnly className={inputReadonly + " w-28 font-medium"} />
                  </Field>
                  <Field label="Other Chrg" w="w-16">
                    <input type="number" value={otherCh} onChange={(e) => setOtherCh(Number(e.target.value))} className={inputBase + " w-24"} />
                  </Field>
                  <Field label="Disc %" w="w-11">
                    <input type="number" value={discPct} onChange={(e) => setDiscPct(Number(e.target.value))} className={inputBase + " w-20"} />
                  </Field>
                </div>

                {/* Row 2 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Field label="Disc Amt" w="w-24">
                    <input type="number" value={discAmt.toFixed(2)} readOnly className={inputReadonly + " w-28"} />
                  </Field>
                  <Field label="Disc Auth" w="w-13">
                    <select value={discAuth} onChange={(e) => setDiscAuth(e.target.value)} className={selectBase + " w-28"}>
                      <option value="">-- Select --</option>
                      {DISC_AUTH.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Final Rpt" w="w-14">
                    <input type="date" value={fRptDt} onChange={(e) => setFRptDt(e.target.value)} className={inputBase + " w-32"} />
                  </Field>
                </div>

                {/* Row 3 - Totals */}
                <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-2.5 mt-0.5">
                  <Field label="Total Amount" w="w-24">
                    <input type="number" value={totalAmt.toFixed(2)} readOnly className={inputReadonly + " w-32 font-bold text-teal-800 bg-teal-50"} />
                  </Field>
                  <Field label="Paid" w="w-13">
                    <input type="number" value={paidAmt} onChange={(e) => setPaidAmt(Number(e.target.value))} className={inputBase + " w-28 font-medium"} />
                  </Field>
                  <Field label="Balance" w="w-12">
                    <input type="number" value={balance.toFixed(2)} readOnly
                      className={`${inputReadonly} w-28 font-bold ${
                        balance > 0 ? "text-red-700 bg-red-50" : "text-green-700 bg-green-50"
                      }`} />
                  </Field>
                </div>
              </div>
            </div>

            {/* ── PAYMENT + ACTIONS ── */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200/80 px-3.5 py-2.5 flex flex-col gap-2 min-h-0 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="text-xs font-semibold text-teal-700 border-b border-teal-100 pb-2 shrink-0 uppercase tracking-wider">
                Payment Details
              </div>

              {/* Payment row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Field label="Mode" w="w-9">
                  <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className={selectBase + " w-24"}>
                    {PAYMENT_MODES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Bank Name" w="w-16">
                  <input type="text" placeholder="Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputBase + " w-36"} />
                </Field>
                <Field label="Ref No" w="w-11">
                  <input type="text" placeholder="Ref" value={payRef} onChange={(e) => setPayRef(e.target.value)} className={inputBase + " w-28"} />
                </Field>
                <Field label="Date" w="w-9">
                  <input type="date" value={payDt} onChange={(e) => setPayDt(e.target.value)} className={inputBase + " w-28"} />
                </Field>
                <Field label="Amount" w="w-12">
                  <input type="number" value={paidAmt} onChange={(e) => setPaidAmt(Number(e.target.value))} className={inputBase + " w-24 font-medium"} />
                </Field>
                <Field label="Remarks" w="w-13">
                  <input type="text" placeholder="Remarks" value={payRem} onChange={(e) => setPayRem(e.target.value)} className={inputBase + " w-32"} />
                </Field>
              </div>

              {/* Delivery + Clinical + Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <Field label="Delivery" w="w-13">
                  <select value={delMode} onChange={(e) => setDelMode(e.target.value)} className={selectBase + " w-28"}>
                    {DELIVERY_MODES.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Clinical Rmk" w="w-18">
                  <input type="text" placeholder="Clinical remarks" value={clinRem} onChange={(e) => setClinRem(e.target.value)} className={inputBase + " w-48"} />
                </Field>
                <Field label="Remarks" w="w-12">
                  <input type="text" placeholder="General remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inputBase + " w-36"} />
                </Field>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md px-3 py-1.5 text-xs text-red-700 shrink-0">{error}</div>
              )}
              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-auto pt-2.5 border-t border-gray-100 shrink-0">
                <button onClick={onClear} disabled={saving}
                  className="px-5 h-8 border border-gray-300 text-gray-600 rounded-md text-xs font-semibold hover:bg-gray-100 hover:border-gray-400 transition-all active:scale-[0.97] disabled:opacity-50">
                  Clear
                </button>
                <button onClick={onSave} disabled={saving}
                  className="px-6 h-8 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-md text-xs font-bold hover:from-teal-700 hover:to-cyan-700 transition-all shadow-sm active:scale-[0.97] disabled:opacity-60 flex items-center gap-1.5">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
