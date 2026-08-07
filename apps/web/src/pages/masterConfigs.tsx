import type { LucideIcon } from "lucide-react";
import {
  Building2,
  TestTube2,
  FlaskConical,
  Cpu,
  Briefcase,
} from "lucide-react";
import {
  getHospitals,
  createHospital,
  updateHospital,
  setHospitalStatus,
  removeHospital,
  generateHospitalCode,
  getSampleTypeMasters,
  createSampleTypeMaster,
  updateSampleTypeMaster,
  setSampleTypeMasterStatus,
  removeSampleTypeMaster,
  generateSampleTypeMasterCode,
  getTestMethods,
  createTestMethod,
  updateTestMethod,
  setTestMethodStatus,
  removeTestMethod,
  generateTestMethodCode,
  getInstruments,
  createInstrument,
  updateInstrument,
  setInstrumentStatus,
  removeInstrument,
  generateInstrumentCode,
  getParties,
  createParty,
  updateParty,
  type CreatePartyData,
  type Party,
} from "../lib/api-client";

// ─── Types ──────────────────────────────────────────────────────────────────

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "date"
  | "color";

export interface MasterField {
  key: string;
  label: string;
  kind?: FieldKind;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  half?: boolean;
  /** Group name — rendered as a bordered card (legend) in the left panel. */
  group?: string;
  /** Width within a group row. Defaults to "full". */
  width?: "full" | "half" | "third";
  hint?: string;
}

export interface MasterOption {
  key: string;
  label: string;
  desc?: string;
}

export type SettingKind = FieldKind | "toggle" | "multicheck" | "radio";

export interface MasterSetting {
  key: string;
  label: string;
  kind?: SettingKind;
  options?: string[];
  placeholder?: string;
  half?: boolean;
  hint?: string;
  /** Dynamic show/hide — e.g. Auto Invoice Period only when Auto Invoice is ON. */
  dependsOn?: { field: string; value: boolean };
}

export interface MasterListColumn {
  key: string;
  label: string;
  kind?: "text" | "pill" | "color";
  pillTrue?: string;
  pillFalse?: string;
}

export interface MasterConfig {
  key: string;
  title: string;
  singular: string;
  description: string;
  icon: LucideIcon;
  codeHint: string;
  listColumns: MasterListColumn[];
  /** LEFT panel — identity & details ("who they are"). */
  leftFields: MasterField[];
  /** RIGHT panel · Tab A — boolean option flags ("how we treat them"). */
  options: MasterOption[];
  /** RIGHT panel · Tab B — dropdowns / radios / inputs. */
  settings: MasterSetting[];
  /** RIGHT panel · Tab C — source / billing (Hospital only). */
  billing?: MasterSetting[];
  newDefaults: Record<string, unknown>;
  rowToDraft: (row: Record<string, unknown>) => Record<string, unknown>;
  isActiveOf: (row: Record<string, unknown>) => boolean;
  api: {
    list: (p?: { search?: string; isActive?: string }) => Promise<MasterRow[]>;
    create: (body: Record<string, unknown>) => Promise<MasterRow>;
    update: (id: string, body: Record<string, unknown>) => Promise<MasterRow>;
    setStatus: (id: string, isActive: boolean) => Promise<MasterRow>;
    remove?: (id: string) => Promise<MasterRow>;
    generateCode: () => Promise<string>;
  };
  /** Returns { fieldKey: message } for validation errors. */
  validate?: (draft: Record<string, unknown>) => Record<string, string>;
}

export type MasterConfigKey = "hospital" | "sample_type" | "method" | "instrument" | "client";

// ─── Helpers ────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (v == null ? "" : String(v));
const numStr = (v: unknown): string =>
  v == null ? "" : String(typeof v === "number" ? v : Number(v));

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;

/** Join an array back into a comma-separated string. */
const joinList = (v: unknown): string => Array.isArray(v) ? (v as string[]).join(", ") : str(v);

/** Loose row type used by the generic editor (the API fns are strongly typed). */
type MasterRow = Record<string, unknown> & { id: string };
const asRows = <T,>(x: T[]): MasterRow[] => x as unknown as MasterRow[];
const asRow = <T,>(x: T): MasterRow => x as unknown as MasterRow;

// ─── Hospital master ────────────────────────────────────────────────────────

const HOSPITAL_FIELDS: MasterField[] = [
  { key: "name", label: "Hospital Name", required: true, group: "Basic Details" },
  { key: "code", label: "Hospital Code", required: true, group: "Basic Details", hint: "Auto or manual" },
  // Address block
  { key: "country", label: "Country", group: "Address", width: "half", placeholder: "e.g. India" },
  { key: "state", label: "State", group: "Address", width: "half", placeholder: "e.g. Tamil Nadu" },
  { key: "city", label: "City", group: "Address", width: "half", placeholder: "e.g. Chennai" },
  { key: "place", label: "Place", group: "Address", width: "half" },
  { key: "street", label: "Street", group: "Address" },
  { key: "pinCode", label: "PIN", group: "Address", width: "third", placeholder: "621314" },
  { key: "stdCode", label: "STD Code", group: "Address", width: "third" },
  { key: "isdCode", label: "ISD Code", group: "Address", width: "third" },
  { key: "zone", label: "Zone", group: "Address", kind: "select", options: ["North", "South", "East", "West", "Central"], width: "half" },
  // Contact matrix
  { key: "mobile", label: "Mobile", group: "Contact", width: "half" },
  { key: "fax", label: "Fax", group: "Contact", width: "half" },
  { key: "phone1", label: "Phone1", group: "Contact", width: "half" },
  { key: "phone2", label: "Phone2", group: "Contact", width: "half" },
  { key: "whatsapp", label: "WhatsApp No", group: "Contact", width: "half", hint: "10–13 digits — validated" },
  { key: "email", label: "Email", group: "Contact", width: "half" },
  { key: "website", label: "Web Site", group: "Contact" },
  { key: "panNo", label: "Pan No", group: "Contact", placeholder: "AAAAA9999A", hint: "Format validated" },
  // Report customization
  { key: "headerImagePath", label: "Header Image", group: "Report Customization", placeholder: "File path / upload ref" },
  { key: "footerImagePath", label: "Footer Image", group: "Report Customization", placeholder: "File path / upload ref" },
  { key: "reportName", label: "Report Name", group: "Report Customization", placeholder: "Custom label on prints" },
  { key: "headerMarginPx", label: "Header Margin (Pixels)", kind: "number", group: "Report Customization", width: "half" },
  { key: "footerMarginPx", label: "Footer Margin (Pixels)", kind: "number", group: "Report Customization", width: "half" },
];

// Option flags in the reference order (2-column checkbox grid inside the Options box).
const HOSPITAL_OPTIONS: MasterOption[] = [
  { key: "inactive", label: "Inactive" },
  { key: "uploadResults", label: "Upload Results" },
  { key: "noSms", label: "No SMS" },
  { key: "outsourceTests", label: "Outsource Tests" },
  { key: "footerInfo", label: "Footer Information" },
  { key: "monthWiseCommission", label: "Month Wise Commission" },
  { key: "onlySplAmountBilling", label: "Only Spl Amount (Billing)" },
  { key: "noWhatsapp", label: "No WhatsApp" },
  { key: "specialDiscountApplicable", label: "Special Discount Applicable" },
  { key: "stopReportPrinting", label: "Stop Report Printing" },
  { key: "noEmail", label: "No Email" },
  { key: "ignoreCreditLimit", label: "Ignore Credit Limit" },
  { key: "noReportDate", label: "No Report Date" },
  { key: "showPatientTrendGraph", label: "Show Patient Trend Graph" },
  { key: "criticalEmail", label: "Critical Email" },
  { key: "whatsappReportForPatient", label: "WhatsApp Report for Patient" },
  { key: "criticalValueSms", label: "Critical Value SMS" },
  { key: "allowDueReportOnline", label: "Allow Due Report for Patient (Online)" },
  { key: "onlySplAmountOnline", label: "Only Spl Amount (On-Line)" },
  { key: "noDueEmail", label: "No Due Email" },
  { key: "enableOnlineBooking", label: "Enable Online Service Booking" },
  { key: "blockPrintWhenDue", label: "Block Report Print When Due" },
  { key: "whatsappReport", label: "WhatsApp Report (API)" },
];

const HOSPITAL_SETTINGS: MasterSetting[] = [
  { key: "autoInvoice", label: "Auto Invoice", kind: "toggle" },
  {
    key: "autoInvoicePeriod",
    label: "Auto Invoice Period",
    kind: "select",
    options: ["Daily", "Weekly", "Monthly"],
    dependsOn: { field: "autoInvoice", value: true },
  },
  { key: "preferredDoctorId", label: "Preferred Doctor Staff", kind: "text", placeholder: "Doctor master ID", hint: "Links to Doctor Master (one-to-one)" },
  { key: "collectionBoyId", label: "Collection Boy", kind: "text", placeholder: "Staff / agent ID", hint: "For commission tracking" },
  {
    key: "reportDisplayMode",
    label: "Report Display Mode",
    kind: "radio",
    options: ["Report With H/F", "Report Without H/F", "Both"],
    hint: "How the report should print",
  },
];

const HOSPITAL_BILLING: MasterSetting[] = [
  { key: "creditBill", label: "Credit Bill", kind: "toggle" },
  { key: "cashBill", label: "Cash Bill", kind: "toggle" },
  { key: "creditDays", label: "Credit Days", kind: "number", hint: "e.g. 30 days payment terms" },
  {
    key: "creditLimit",
    label: "Credit Limit",
    kind: "number",
    hint: "Must be > 0 when Credit Bill is active",
  },
  { key: "webPassword", label: "Online Web Password", kind: "text", hint: "Generate / reset — never shown after save" },
  {
    key: "sentChannels",
    label: "Sent Password Through",
    kind: "multicheck",
    options: ["SMS", "Email", "WhatsApp"],
  },
];

// ─── Sample type master ─────────────────────────────────────────────────────

const SAMPLE_FIELDS: MasterField[] = [
  { key: "name", label: "Sample Name", required: true, group: "Basic Details", hint: "e.g. Blood, Urine, Water" },
  { key: "code", label: "Sample Code", required: true, group: "Basic Details" },
  { key: "collectionMethod", label: "Collection Method", kind: "select", options: ["Venipuncture", "Spot Catch", "Composite", "Swab", "Catheter", "Other"], group: "Collection & Stability", width: "half" },
  { key: "containerType", label: "Container Type", kind: "select", options: ["Vial", "Bottle", "Bag", "Tube"], group: "Collection & Stability", width: "half" },
  { key: "containerColor", label: "Container Colour", kind: "color", group: "Collection & Stability", width: "half" },
  { key: "storageCondition", label: "Storage Condition", kind: "select", options: ["Room Temp", "Refrigerated", "Frozen"], group: "Collection & Stability", width: "half" },
  { key: "shelfLifeHours", label: "Shelf Life (hours)", kind: "number", group: "Collection & Stability", width: "half", hint: "Max time before the test must start" },
  { key: "preAnalytical", label: "Pre-analytical Requirements", kind: "textarea", group: "Collection & Stability", hint: 'e.g. "Fasting for 8 hours"' },
];

const SAMPLE_OPTIONS: MasterOption[] = [
  { key: "active", label: "Active", desc: "Enable / disable this sample type" },
  { key: "requiresRequisition", label: "Requires Requisition", desc: "Force form fill before collection" },
  { key: "autoGenerateId", label: "Auto-Generate ID", desc: "Generate unique tube ID automatically" },
  { key: "rejectOnHemolysis", label: "Reject on Hemolysis", desc: "Flag if the sample looks damaged" },
  { key: "compositeSample", label: "Composite Sample", desc: "Allow mixing multiple sub-samples" },
];

const SAMPLE_SETTINGS: MasterSetting[] = [
  { key: "priorityDefault", label: "Priority Default", kind: "select", options: ["ROUTINE", "URGENT", "STAT"], half: true },
  { key: "tatHours", label: "Turnaround Time (hours)", kind: "number", half: true },
  { key: "associatedTests", label: "Associated Tests", kind: "textarea", hint: "Comma-separated test codes linked to this sample" },
];

// ─── Method master ──────────────────────────────────────────────────────────

const METHOD_FIELDS: MasterField[] = [
  { key: "name", label: "Method Name", required: true, group: "Basic Details", hint: "e.g. ASTM D1179, ISO 10504" },
  { key: "code", label: "Method Code", required: true, group: "Basic Details", hint: "e.g. AST-01" },
  { key: "standardBody", label: "Standard Body", kind: "select", options: ["ASTM", "ISO", "EPA", "APHA", "CUSTOM"], group: "Basic Details", width: "half" },
  { key: "category", label: "Category", kind: "select", options: ["Physical", "Chemical", "Biological", "Microbial"], group: "Basic Details", width: "half" },
  { key: "referenceDoc", label: "Reference Document Path", group: "Documentation", hint: "Link to PDF / manual" },
  { key: "description", label: "Description", kind: "textarea", group: "Documentation", hint: "Detailed procedure steps" },
];

const METHOD_OPTIONS: MasterOption[] = [
  { key: "active", label: "Active", desc: "Enable this method" },
  { key: "mandatory", label: "Mandatory", desc: "Force selection for specific parameters" },
  { key: "versionControl", label: "Version Control", desc: "Track updates to this method" },
];

const METHOD_SETTINGS: MasterSetting[] = [
  { key: "defaultParameters", label: "Default Parameter Set", kind: "textarea", hint: "Comma-separated parameter codes auto-loaded when chosen" },
  { key: "safetyPrecautions", label: "Safety Precautions", kind: "textarea", hint: "List of PPE required" },
];

// ─── Instrument master ──────────────────────────────────────────────────────

const INSTRUMENT_FIELDS: MasterField[] = [
  { key: "name", label: "Instrument Name", required: true, group: "Basic Details", hint: "e.g. HPLC, Spectrophotometer" },
  { key: "code", label: "Instrument Code", required: true, group: "Basic Details" },
  { key: "modelName", label: "Model Number", group: "Basic Details", width: "half" },
  { key: "manufacturer", label: "Manufacturer", group: "Basic Details", width: "half" },
  { key: "assetTag", label: "Asset Tag", group: "Basic Details", width: "half" },
  { key: "serialNo", label: "Serial No", group: "Basic Details", width: "half" },
  { key: "location", label: "Location", kind: "select", options: ["Lab A", "Lab B", "Store"], group: "Location & Status", width: "half" },
  { key: "status", label: "Status", kind: "select", options: ["Active", "Under Repair", "Decommissioned"], group: "Location & Status", width: "half" },
  { key: "assignedTo", label: "Assigned To", group: "Location & Status", hint: "Staff ID / name of the operator" },
];

const INSTRUMENT_OPTIONS: MasterOption[] = [
  { key: "active", label: "Active", desc: "Enable for test assignment" },
  { key: "requiresQc", label: "Requires QC", desc: "Force quality-control check before use" },
  { key: "downtimeWarning", label: "Downtime Warning", desc: "Alert if the instrument is overdue for service" },
];

const INSTRUMENT_SETTINGS: MasterSetting[] = [
  { key: "calibrationFrequency", label: "Calibration Frequency", kind: "select", options: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"], half: true },
  { key: "lastCalibratedAt", label: "Last Calibrated", kind: "date", half: true },
  { key: "nextCalibrationDue", label: "Next Calibration Due", kind: "date", half: true },
  { key: "calibrationStandard", label: "Calibration Standard Used" },
];

// ─── Client / Lab master (Party-backed) ─────────────────────────────────────

const CLIENT_TYPES = ["hospital", "corporate", "reference_lab", "insurance_tpa", "consultant"];
const CLIENT_TYPE_LABELS: Record<string, string> = {
  hospital: "Hospital",
  corporate: "Corporate",
  reference_lab: "Reference Lab",
  insurance_tpa: "Insurance / TPA",
  consultant: "Consultant",
};

const CLIENT_FIELDS: MasterField[] = [
  { key: "name", label: "Client / Lab Name", required: true, group: "Basic Details" },
  { key: "partyType", label: "Client Type", kind: "select", options: CLIENT_TYPES, group: "Basic Details", width: "half" },
  { key: "gstin", label: "GST / PAN No", group: "Basic Details", width: "half" },
  { key: "currency", label: "Currency", group: "Basic Details", width: "half", placeholder: "INR" },
  { key: "primaryContactName", label: "Contact Person", group: "Contact", width: "half", hint: "Name & designation" },
  { key: "primaryContactPhone", label: "Phone", group: "Contact", width: "half" },
  { key: "primaryContactEmail", label: "Email", group: "Contact" },
  { key: "address", label: "Billing Address", kind: "textarea", group: "Address & Terms", hint: "With pincode / city" },
  { key: "shippingAddress", label: "Shipping Address", kind: "textarea", group: "Address & Terms" },
  { key: "paymentTerms", label: "Payment Terms", kind: "select", options: ["IMMEDIATE", "NET_30", "NET_45", "NET_60", "NET_90"], group: "Address & Terms" },
];

const CLIENT_OPTIONS: MasterOption[] = [
  { key: "outsourcePartner", label: "Outsource Partner", desc: "Mark as external lab for sub-contracting" },
  { key: "creditAllowed", label: "Credit Allowed", desc: "Enable credit-limit checks" },
  { key: "commissionApplicable", label: "Commission Applicable", desc: "Commission tracking for agents / collection boys" },
  { key: "customBranding", label: "Custom Branding", desc: "Allow client logo for co-branded reports" },
];

const CLIENT_SETTINGS: MasterSetting[] = [
  { key: "discountPercent", label: "Discount %", kind: "number", half: true, hint: "Default discount on all tests" },
  { key: "commissionPercent", label: "Commission %", kind: "number", half: true, hint: "Rate for collection boys / agencies" },
  { key: "preferredLab", label: "Preferred Lab", half: true, hint: "Primary lab if a multi-lab network" },
  { key: "invoiceTemplate", label: "Invoice Template", half: true },
];

// ─── Client helpers (Party ↔ draft) ─────────────────────────────────────────

function partyToDraft(p: unknown): Record<string, unknown> {
  const x = p as Party;
  const c = (x.commercial ?? {}) as Record<string, unknown>;
  return {
    id: x.id,
    name: x.name,
    partyType: x.partyType,
    gstin: str(x.gstin),
    primaryContactName: str(x.primaryContactName),
    primaryContactPhone: str(x.primaryContactPhone),
    primaryContactEmail: str(x.primaryContactEmail),
    address: str(x.address),
    billingAddress: str(c.billingAddress),
    shippingAddress: str(c.shippingAddress),
    paymentTerms: str(c.paymentTerms),
    currency: str(c.currency),
    discountPercent: numStr(c.discountPercent),
    commissionPercent: numStr(c.commissionPercent),
    preferredLab: str(c.preferredLab),
    invoiceTemplate: str(c.invoiceTemplate),
    outsourcePartner: Boolean(c.outsourcePartner),
    creditAllowed: Boolean(c.creditAllowed),
    commissionApplicable: Boolean(c.commissionApplicable),
    customBranding: Boolean(c.customBranding),
    status: x.status,
  };
}

// ─── The five master configs ────────────────────────────────────────────────

export const MASTER_CONFIGS: Record<MasterConfigKey, MasterConfig> = {
  hospital: {
    key: "hospital",
    title: "Hospitals",
    singular: "Hospital",
    description: "Master records for hospitals & clinics — billing, reporting and communication behaviour",
    icon: Building2,
    codeHint: "e.g. HSP-001",
    listColumns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "city", label: "City" },
      { key: "mobile", label: "Mobile" },
      { key: "isActive", label: "Status", kind: "pill" },
    ],
    leftFields: HOSPITAL_FIELDS,
    options: HOSPITAL_OPTIONS,
    settings: HOSPITAL_SETTINGS,
    billing: HOSPITAL_BILLING,
    newDefaults: {
      name: "", code: "", country: "", state: "", city: "", place: "", street: "",
      pinCode: "", stdCode: "", isdCode: "", zone: "", mobile: "", phone1: "", phone2: "",
      fax: "", whatsapp: "", email: "", website: "", panNo: "", headerImagePath: "",
      footerImagePath: "", reportName: "", headerMarginPx: "", footerMarginPx: "",
      inactive: false, uploadResults: false, noSms: false, noEmail: false,
      outsourceTests: false, footerInfo: false, monthWiseCommission: false,
      criticalEmail: false, whatsappReport: false, enableOnlineBooking: false,
      blockPrintWhenDue: false, noWhatsapp: false, onlySplAmountBilling: false,
      specialDiscountApplicable: false, stopReportPrinting: false, ignoreCreditLimit: false,
      noReportDate: false, showPatientTrendGraph: false, whatsappReportForPatient: false,
      criticalValueSms: false, allowDueReportOnline: false, onlySplAmountOnline: false,
      noDueEmail: false, autoInvoice: false, autoInvoicePeriod: "Monthly",
      preferredDoctorId: "", collectionBoyId: "", reportDisplayMode: "Report With H/F",
      creditBill: false, cashBill: true, creditDays: "", creditLimit: "",
      webPassword: "", sentChannels: [] as string[],
    },
    rowToDraft: (r) => {
      const dmode = str(r.reportDisplayMode);
      return {
        id: r.id, name: str(r.name), code: str(r.code),
        country: str(r.country), state: str(r.state), city: str(r.city),
        place: str(r.place), street: str(r.street), pinCode: str(r.pinCode),
        stdCode: str(r.stdCode), isdCode: str(r.isdCode),
        zone: str(r.zone), mobile: str(r.mobile), phone1: str(r.phone1),
        phone2: str(r.phone2), fax: str(r.fax), whatsapp: str(r.whatsapp),
        email: str(r.email), website: str(r.website), panNo: str(r.panNo),
        headerImagePath: str(r.headerImagePath), footerImagePath: str(r.footerImagePath),
        reportName: str(r.reportName), headerMarginPx: numStr(r.headerMarginPx),
        footerMarginPx: numStr(r.footerMarginPx),
        inactive: Boolean(r.inactive), uploadResults: Boolean(r.uploadResults),
        noSms: Boolean(r.noSms), noEmail: Boolean(r.noEmail),
        outsourceTests: Boolean(r.outsourceTests), footerInfo: Boolean(r.footerInfo),
        monthWiseCommission: Boolean(r.monthWiseCommission),
        criticalEmail: Boolean(r.criticalEmail), whatsappReport: Boolean(r.whatsappReport),
        enableOnlineBooking: Boolean(r.enableOnlineBooking),
        blockPrintWhenDue: Boolean(r.blockPrintWhenDue),
        noWhatsapp: Boolean(r.noWhatsapp),
        onlySplAmountBilling: Boolean(r.onlySplAmountBilling),
        specialDiscountApplicable: Boolean(r.specialDiscountApplicable),
        stopReportPrinting: Boolean(r.stopReportPrinting),
        ignoreCreditLimit: Boolean(r.ignoreCreditLimit),
        noReportDate: Boolean(r.noReportDate),
        showPatientTrendGraph: Boolean(r.showPatientTrendGraph),
        whatsappReportForPatient: Boolean(r.whatsappReportForPatient),
        criticalValueSms: Boolean(r.criticalValueSms),
        allowDueReportOnline: Boolean(r.allowDueReportOnline),
        onlySplAmountOnline: Boolean(r.onlySplAmountOnline),
        noDueEmail: Boolean(r.noDueEmail),
        autoInvoice: Boolean(r.autoInvoice),
        autoInvoicePeriod: str(r.autoInvoicePeriod) || "Monthly",
        preferredDoctorId: str(r.preferredDoctorId), collectionBoyId: str(r.collectionBoyId),
        reportDisplayMode:
          dmode === "WITH_HF" ? "Report With H/F" :
          dmode === "WITHOUT_HF" ? "Report Without H/F" :
          dmode === "BOTH" ? "Both" : dmode,
        creditBill: Boolean(r.creditBill), cashBill: Boolean(r.cashBill),
        creditDays: numStr(r.creditDays), creditLimit: numStr(r.creditLimit),
        webPassword: str(r.webPassword), sentChannels: Array.isArray(r.sentChannels) ? r.sentChannels : [],
        isActive: Boolean(r.isActive),
      };
    },
    isActiveOf: (r) => Boolean(r.isActive),
    api: {
      list: (p) => getHospitals(p).then(asRows),
      create: (b) => createHospital(b).then(asRow),
      update: (id, b) => updateHospital(id, b).then(asRow),
      setStatus: (id, v) => setHospitalStatus(id, v).then(asRow),
      remove: (id) => removeHospital(id).then(asRow),
      generateCode: generateHospitalCode,
    },
    validate: (d) => {
      const errs: Record<string, string> = {};
      if (!str(d.name).trim()) errs.name = "Hospital name is required";
      if (!str(d.code).trim()) errs.code = "Hospital code is required";
      const pan = str(d.panNo).toUpperCase().replace(/\s/g, "");
      if (pan && !PAN_RE.test(pan)) errs.panNo = "PAN must match AAAAA9999A";
      if (str(d.email) && !EMAIL_RE.test(str(d.email))) errs.email = "Email is not valid";
      if (str(d.website) && !URL_RE.test(str(d.website))) errs.website = "URL is not valid";
      const wa = str(d.whatsapp).replace(/\D/g, "");
      if (str(d.whatsapp) && (wa.length < 10 || wa.length > 13)) errs.whatsapp = "WhatsApp must be 10–13 digits";
      if (d.creditBill) {
        const lim = Number(d.creditLimit);
        if (!Number.isFinite(lim) || lim <= 0) errs.creditLimit = "Credit Limit must be > 0 when Credit Bill is active";
      }
      return errs;
    },
  },

  sample_type: {
    key: "sample_type",
    title: "Sample Types",
    singular: "Sample Type",
    description: "What kind of sample is accepted and how it is handled",
    icon: TestTube2,
    codeHint: "e.g. SMP-001",
    listColumns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "containerType", label: "Container" },
      { key: "containerColor", label: "Colour", kind: "color" },
      { key: "active", label: "Status", kind: "pill" },
    ],
    leftFields: SAMPLE_FIELDS,
    options: SAMPLE_OPTIONS,
    settings: SAMPLE_SETTINGS,
    newDefaults: {
      name: "", code: "", collectionMethod: "Venipuncture", containerType: "Tube",
      containerColor: "#8B5CF6", storageCondition: "Room Temp", shelfLifeHours: "",
      preAnalytical: "", active: true, requiresRequisition: false,
      autoGenerateId: false, rejectOnHemolysis: false, compositeSample: false,
      priorityDefault: "ROUTINE", tatHours: "", associatedTests: "",
    },
    rowToDraft: (r) => ({
      id: r.id, name: str(r.name), code: str(r.code),
      collectionMethod: str(r.collectionMethod), containerType: str(r.containerType),
      containerColor: str(r.containerColor), storageCondition: str(r.storageCondition),
      shelfLifeHours: numStr(r.shelfLifeHours), preAnalytical: str(r.preAnalytical),
      active: Boolean(r.active), requiresRequisition: Boolean(r.requiresRequisition),
      autoGenerateId: Boolean(r.autoGenerateId), rejectOnHemolysis: Boolean(r.rejectOnHemolysis),
      compositeSample: Boolean(r.compositeSample), priorityDefault: str(r.priorityDefault),
      tatHours: numStr(r.tatHours), associatedTests: joinList(r.associatedTests),
    }),
    isActiveOf: (r) => Boolean(r.active),
    api: {
      list: (p) => getSampleTypeMasters(p).then(asRows),
      create: (b) => createSampleTypeMaster(b).then(asRow),
      update: (id, b) => updateSampleTypeMaster(id, b).then(asRow),
      setStatus: (id, v) => setSampleTypeMasterStatus(id, v).then(asRow),
      remove: (id) => removeSampleTypeMaster(id).then(asRow),
      generateCode: generateSampleTypeMasterCode,
    },
    validate: (d) => {
      const errs: Record<string, string> = {};
      if (!str(d.name).trim()) errs.name = "Sample name is required";
      if (!str(d.code).trim()) errs.code = "Sample code is required";
      return errs;
    },
  },

  method: {
    key: "method",
    title: "Methods",
    singular: "Method",
    description: "Standardized protocols used for testing",
    icon: FlaskConical,
    codeHint: "e.g. MET-001",
    listColumns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "standardBody", label: "Standard" },
      { key: "category", label: "Category" },
      { key: "active", label: "Status", kind: "pill" },
    ],
    leftFields: METHOD_FIELDS,
    options: METHOD_OPTIONS,
    settings: METHOD_SETTINGS,
    newDefaults: {
      name: "", code: "", standardBody: "CUSTOM", category: "Chemical",
      referenceDoc: "", description: "", active: true, mandatory: false,
      versionControl: false, defaultParameters: "", safetyPrecautions: "",
    },
    rowToDraft: (r) => ({
      id: r.id, name: str(r.name), code: str(r.code), standardBody: str(r.standardBody),
      category: str(r.category), referenceDoc: str(r.referenceDoc),
      description: str(r.description), active: Boolean(r.active),
      mandatory: Boolean(r.mandatory), versionControl: Boolean(r.versionControl),
      defaultParameters: joinList(r.defaultParameters), safetyPrecautions: str(r.safetyPrecautions),
    }),
    isActiveOf: (r) => Boolean(r.active),
    api: {
      list: (p) => getTestMethods(p).then(asRows),
      create: (b) => createTestMethod(b).then(asRow),
      update: (id, b) => updateTestMethod(id, b).then(asRow),
      setStatus: (id, v) => setTestMethodStatus(id, v).then(asRow),
      remove: (id) => removeTestMethod(id).then(asRow),
      generateCode: generateTestMethodCode,
    },
    validate: (d) => {
      const errs: Record<string, string> = {};
      if (!str(d.name).trim()) errs.name = "Method name is required";
      if (!str(d.code).trim()) errs.code = "Method code is required";
      return errs;
    },
  },

  instrument: {
    key: "instrument",
    title: "Instruments",
    singular: "Instrument",
    description: "Analyzers & equipment — calibration and maintenance tracking",
    icon: Cpu,
    codeHint: "e.g. INS-001",
    listColumns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "modelName", label: "Model" },
      { key: "location", label: "Location" },
      { key: "status", label: "Status", kind: "pill" },
    ],
    leftFields: INSTRUMENT_FIELDS,
    options: INSTRUMENT_OPTIONS,
    settings: INSTRUMENT_SETTINGS,
    newDefaults: {
      name: "", code: "", modelName: "", manufacturer: "", assetTag: "", serialNo: "",
      location: "Lab A", status: "Active", assignedTo: "", active: true,
      requiresQc: false, downtimeWarning: false, calibrationFrequency: "Monthly",
      lastCalibratedAt: "", nextCalibrationDue: "", calibrationStandard: "",
    },
    rowToDraft: (r) => {
      const st = str(r.status);
      return {
        id: r.id, name: str(r.name), code: str(r.code), modelName: str(r.modelName),
        manufacturer: str(r.manufacturer), assetTag: str(r.assetTag), serialNo: str(r.serialNo),
        location: str(r.location),
        status: st === "ACTIVE" ? "Active" : st === "UNDER_REPAIR" ? "Under Repair" : st === "DECOMMISSIONED" ? "Decommissioned" : st,
        assignedTo: str(r.assignedTo),
        active: Boolean(r.active), requiresQc: Boolean(r.requiresQc),
        downtimeWarning: Boolean(r.downtimeWarning),
        calibrationFrequency: str(r.calibrationFrequency),
      lastCalibratedAt: r.lastCalibratedAt ? String(r.lastCalibratedAt).slice(0, 10) : "",
        nextCalibrationDue: r.nextCalibrationDue ? String(r.nextCalibrationDue).slice(0, 10) : "",
        calibrationStandard: str(r.calibrationStandard),
      };
    },
    isActiveOf: (r) => Boolean(r.active),
    api: {
      list: (p) => getInstruments(p).then(asRows),
      create: (b) => createInstrument(b).then(asRow),
      update: (id, b) => updateInstrument(id, b).then(asRow),
      setStatus: (id, v) => setInstrumentStatus(id, v).then(asRow),
      remove: (id) => removeInstrument(id).then(asRow),
      generateCode: generateInstrumentCode,
    },
    validate: (d) => {
      const errs: Record<string, string> = {};
      if (!str(d.name).trim()) errs.name = "Instrument name is required";
      if (!str(d.code).trim()) errs.code = "Instrument code is required";
      return errs;
    },
  },

  client: {
    key: "client",
    title: "Clients / Labs",
    singular: "Client",
    description: "B2B clients and external labs — billing, credit and commission terms",
    icon: Briefcase,
    codeHint: "Client name",
    listColumns: [
      { key: "name", label: "Name" },
      { key: "partyType", label: "Type" },
      { key: "primaryContactPhone", label: "Phone" },
      { key: "gstin", label: "GST / PAN" },
      { key: "status", label: "Status", kind: "pill" },
    ],
    leftFields: CLIENT_FIELDS,
    options: CLIENT_OPTIONS,
    settings: CLIENT_SETTINGS,
    newDefaults: {
      name: "", partyType: "hospital", gstin: "", currency: "INR",
      primaryContactName: "", primaryContactPhone: "", primaryContactEmail: "",
      address: "", shippingAddress: "", paymentTerms: "NET_30",
      outsourcePartner: false, creditAllowed: false, commissionApplicable: false,
      customBranding: false, discountPercent: "", commissionPercent: "",
      preferredLab: "", invoiceTemplate: "",
    },
    rowToDraft: partyToDraft,
    isActiveOf: (r) => r.status === "active",
    api: {
      list: async (p) => {
        const all = await getParties({ search: p?.search });
        return asRows(all.filter((x) => CLIENT_TYPES.includes(x.partyType)));
      },
      create: async (body) =>
        asRow(
          await createParty(buildClientParty(body) as unknown as CreatePartyData),
        ),
      update: async (id, body) =>
        asRow(
          await updateParty(id, buildClientParty(body) as unknown as CreatePartyData),
        ),
      setStatus: async (id, isActive) =>
        asRow(
          await updateParty(id, {
            status: isActive ? "active" : "inactive",
          } as unknown as CreatePartyData),
        ),
      remove: undefined,
      generateCode: async () => "",
    },
    validate: (d) => {
      const errs: Record<string, string> = {};
      if (!str(d.name).trim()) errs.name = "Client name is required";
      if (str(d.primaryContactEmail) && !EMAIL_RE.test(str(d.primaryContactEmail)))
        errs.primaryContactEmail = "Email is not valid";
      if (d.creditAllowed) {
        const disc = Number(d.discountPercent);
        if (Number.isFinite(disc) && (disc < 0 || disc > 100)) errs.discountPercent = "Discount % must be 0–100";
      }
      return errs;
    },
  },
};

/** Build a Party API body from a client draft (commercial fields → JSON). */
function buildClientParty(d: Record<string, unknown>) {
  const body: Record<string, unknown> = {
    name: str(d.name).trim(),
    partyType: str(d.partyType),
    gstin: str(d.gstin).trim() || undefined,
    primaryContactName: str(d.primaryContactName).trim() || undefined,
    primaryContactPhone: str(d.primaryContactPhone).trim() || undefined,
    primaryContactEmail: str(d.primaryContactEmail).trim() || undefined,
    address: str(d.address).trim() || undefined,
    status: str(d.status) || "active",
    commercial: {
      billingAddress: str(d.billingAddress).trim() || undefined,
      shippingAddress: str(d.shippingAddress).trim() || undefined,
      paymentTerms: str(d.paymentTerms).trim() || undefined,
      currency: str(d.currency).trim() || "INR",
      discountPercent: d.discountPercent === "" || d.discountPercent == null ? undefined : Number(d.discountPercent),
      commissionPercent: d.commissionPercent === "" || d.commissionPercent == null ? undefined : Number(d.commissionPercent),
      preferredLab: str(d.preferredLab).trim() || undefined,
      invoiceTemplate: str(d.invoiceTemplate).trim() || undefined,
      outsourcePartner: Boolean(d.outsourcePartner),
      creditAllowed: Boolean(d.creditAllowed),
      commissionApplicable: Boolean(d.commissionApplicable),
      customBranding: Boolean(d.customBranding),
    },
  };
  return body;
}

export const CLIENT_TYPE_LABEL_MAP = CLIENT_TYPE_LABELS;
