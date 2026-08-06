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
  hint?: string;
}

export interface MasterOption {
  key: string;
  label: string;
  desc?: string;
}

export type SettingKind = FieldKind | "toggle" | "multicheck";

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
  { key: "name", label: "Hospital Name", required: true, hint: "Required" },
  { key: "code", label: "Hospital Code", required: true, hint: "Auto or manual" },
  { key: "country", label: "Country", half: true, placeholder: "e.g. India" },
  { key: "state", label: "State", half: true, placeholder: "e.g. Tamil Nadu" },
  { key: "city", label: "City", half: true, placeholder: "e.g. Chennai" },
  { key: "place", label: "Place / Area", half: true },
  { key: "street", label: "Street", half: true },
  { key: "pinCode", label: "PIN Code", kind: "text", half: true, placeholder: "600001" },
  { key: "zone", label: "Zone", half: true, placeholder: "e.g. North" },
  { key: "mobile", label: "Mobile", half: true },
  { key: "phone1", label: "Phone 1", half: true },
  { key: "phone2", label: "Phone 2", half: true },
  { key: "fax", label: "Fax", half: true },
  { key: "whatsapp", label: "WhatsApp No", half: true, hint: "10–13 digits — validated" },
  { key: "email", label: "Email", half: true },
  { key: "website", label: "Website", half: true },
  { key: "panNo", label: "PAN No", half: true, placeholder: "AAAAA9999A", hint: "Format validated" },
  { key: "headerImagePath", label: "Header Image Path", half: true },
  { key: "footerImagePath", label: "Footer Image Path", half: true },
  { key: "reportName", label: "Report Name", half: true, placeholder: "Custom label on prints" },
  { key: "headerMarginPx", label: "Header Margin (px)", kind: "number", half: true },
  { key: "footerMarginPx", label: "Footer Margin (px)", kind: "number", half: true },
];

const HOSPITAL_OPTIONS: MasterOption[] = [
  { key: "inactive", label: "Inactive", desc: "Disables the master record immediately" },
  { key: "uploadResults", label: "Upload Results", desc: "Allow hospital to view patient results online" },
  { key: "noSms", label: "No SMS", desc: "Global suppressor for SMS notifications" },
  { key: "noEmail", label: "No Email", desc: "Global suppressor for email notifications" },
  { key: "outsourceTests", label: "Outsource Tests", desc: "Tests done at external labs" },
  { key: "footerInfo", label: "Footer Information", desc: "Show footer text on reports" },
  { key: "monthWiseCommission", label: "Month Wise Commission", desc: "Monthly billing cycles for commissions" },
  { key: "criticalEmail", label: "Critical Email", desc: "Route critical alerts to a dedicated queue" },
  { key: "whatsappReport", label: "WhatsApp Report", desc: "Trigger WhatsApp API for result delivery" },
  { key: "enableOnlineBooking", label: "Enable Online Service Booking", desc: "Activates appointment booking portal" },
  { key: "blockPrintWhenDue", label: "Block Report Print When Due", desc: "Prevents printing if pending payments exist" },
];

const HOSPITAL_SETTINGS: MasterSetting[] = [
  { key: "autoInvoice", label: "Auto Invoice", kind: "toggle", half: true },
  {
    key: "autoInvoicePeriod",
    label: "Auto Invoice Period",
    kind: "select",
    options: ["DAILY", "WEEKLY", "MONTHLY"],
    half: true,
    dependsOn: { field: "autoInvoice", value: true },
  },
  { key: "preferredDoctorId", label: "Preferred Doctor", kind: "text", half: true, placeholder: "Doctor master ID", hint: "Links to Doctor Master (one-to-one)" },
  { key: "collectionBoyId", label: "Collection Boy", kind: "text", half: true, placeholder: "Staff/agent ID", hint: "For commission tracking" },
  {
    key: "reportDisplayMode",
    label: "Report Display Mode",
    kind: "select",
    options: ["WITH_HF", "WITHOUT_HF", "BOTH"],
    hint: "With H/F · Without H/F · Both (user choice)",
  },
];

const HOSPITAL_BILLING: MasterSetting[] = [
  { key: "creditBill", label: "Credit Bill", kind: "toggle", half: true },
  { key: "cashBill", label: "Cash Bill", kind: "toggle", half: true },
  { key: "creditDays", label: "Credit Days", kind: "number", half: true, hint: "e.g. 30 days payment terms" },
  {
    key: "creditLimit",
    label: "Credit Limit",
    kind: "number",
    half: true,
    hint: "Must be > 0 when Credit Bill is active",
  },
  { key: "webPassword", label: "Online Web Password", kind: "text", hint: "Generate / reset — never shown after save" },
  {
    key: "sentChannels",
    label: "Sent Password Through",
    kind: "multicheck",
    options: ["SMS", "EMAIL", "WHATSAPP"],
    hint: "Delivery methods for the web password",
  },
];

// ─── Sample type master ─────────────────────────────────────────────────────

const SAMPLE_FIELDS: MasterField[] = [
  { key: "name", label: "Sample Name", required: true, hint: "e.g. Blood, Urine, Water" },
  { key: "code", label: "Sample Code", required: true },
  { key: "collectionMethod", label: "Collection Method", kind: "select", options: ["Venipuncture", "Spot Catch", "Composite", "Swab", "Catheter", "Other"], half: true },
  { key: "containerType", label: "Container Type", kind: "select", options: ["Vial", "Bottle", "Bag", "Tube"], half: true },
  { key: "containerColor", label: "Container Colour", kind: "color", half: true },
  { key: "storageCondition", label: "Storage Condition", kind: "select", options: ["Room Temp", "Refrigerated", "Frozen"], half: true },
  { key: "shelfLifeHours", label: "Shelf Life (hours)", kind: "number", half: true, hint: "Max time before the test must start" },
  { key: "preAnalytical", label: "Pre-analytical Requirements", kind: "textarea", hint: 'e.g. "Fasting for 8 hours"' },
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
  { key: "name", label: "Method Name", required: true, hint: "e.g. ASTM D1179, ISO 10504" },
  { key: "code", label: "Method Code", required: true, hint: "e.g. AST-01" },
  { key: "standardBody", label: "Standard Body", kind: "select", options: ["ASTM", "ISO", "EPA", "APHA", "CUSTOM"], half: true },
  { key: "category", label: "Category", kind: "select", options: ["Physical", "Chemical", "Biological", "Microbial"], half: true },
  { key: "referenceDoc", label: "Reference Document Path", hint: "Link to PDF / manual" },
  { key: "description", label: "Description", kind: "textarea", hint: "Detailed procedure steps" },
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
  { key: "name", label: "Instrument Name", required: true, hint: "e.g. HPLC, Spectrophotometer" },
  { key: "code", label: "Instrument Code", required: true },
  { key: "modelName", label: "Model Number", half: true },
  { key: "manufacturer", label: "Manufacturer", half: true },
  { key: "assetTag", label: "Asset Tag", half: true },
  { key: "serialNo", label: "Serial No", half: true },
  { key: "location", label: "Location", kind: "select", options: ["Lab A", "Lab B", "Store"], half: true },
  { key: "status", label: "Status", kind: "select", options: ["ACTIVE", "UNDER_REPAIR", "DECOMMISSIONED"], half: true },
  { key: "assignedTo", label: "Assigned To", hint: "Staff ID / name of the operator" },
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
  { key: "name", label: "Client / Lab Name", required: true },
  { key: "partyType", label: "Client Type", kind: "select", options: CLIENT_TYPES, half: true },
  { key: "gstin", label: "GST / PAN No", half: true },
  { key: "currency", label: "Currency", half: true, placeholder: "INR" },
  { key: "primaryContactName", label: "Contact Person", half: true, hint: "Name & designation" },
  { key: "primaryContactPhone", label: "Phone", half: true },
  { key: "primaryContactEmail", label: "Email", half: true },
  { key: "address", label: "Billing Address", kind: "textarea", half: true, hint: "With pincode / city" },
  { key: "shippingAddress", label: "Shipping Address", kind: "textarea", half: true },
  { key: "paymentTerms", label: "Payment Terms", kind: "select", options: ["IMMEDIATE", "NET_30", "NET_45", "NET_60", "NET_90"], half: true },
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
      pinCode: "", zone: "", mobile: "", phone1: "", phone2: "", fax: "", whatsapp: "",
      email: "", website: "", panNo: "", headerImagePath: "", footerImagePath: "",
      reportName: "", headerMarginPx: "", footerMarginPx: "",
      inactive: false, uploadResults: false, noSms: false, noEmail: false,
      outsourceTests: false, footerInfo: false, monthWiseCommission: false,
      criticalEmail: false, whatsappReport: false, enableOnlineBooking: false,
      blockPrintWhenDue: false, autoInvoice: false, autoInvoicePeriod: "MONTHLY",
      preferredDoctorId: "", collectionBoyId: "", reportDisplayMode: "WITH_HF",
      creditBill: false, cashBill: true, creditDays: "", creditLimit: "",
      webPassword: "", sentChannels: [] as string[],
    },
    rowToDraft: (r) => ({
      id: r.id, name: str(r.name), code: str(r.code),
      country: str(r.country), state: str(r.state), city: str(r.city),
      place: str(r.place), street: str(r.street), pinCode: str(r.pinCode),
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
      autoInvoice: Boolean(r.autoInvoice), autoInvoicePeriod: str(r.autoInvoicePeriod),
      preferredDoctorId: str(r.preferredDoctorId), collectionBoyId: str(r.collectionBoyId),
      reportDisplayMode: str(r.reportDisplayMode),
      creditBill: Boolean(r.creditBill), cashBill: Boolean(r.cashBill),
      creditDays: numStr(r.creditDays), creditLimit: numStr(r.creditLimit),
      webPassword: str(r.webPassword), sentChannels: Array.isArray(r.sentChannels) ? r.sentChannels : [],
      isActive: Boolean(r.isActive),
    }),
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
      location: "Lab A", status: "ACTIVE", assignedTo: "", active: true,
      requiresQc: false, downtimeWarning: false, calibrationFrequency: "MONTHLY",
      lastCalibratedAt: "", nextCalibrationDue: "", calibrationStandard: "",
    },
    rowToDraft: (r) => ({
      id: r.id, name: str(r.name), code: str(r.code), modelName: str(r.modelName),
      manufacturer: str(r.manufacturer), assetTag: str(r.assetTag), serialNo: str(r.serialNo),
      location: str(r.location), status: str(r.status), assignedTo: str(r.assignedTo),
      active: Boolean(r.active), requiresQc: Boolean(r.requiresQc),
      downtimeWarning: Boolean(r.downtimeWarning),
      calibrationFrequency: str(r.calibrationFrequency),
      lastCalibratedAt: r.lastCalibratedAt ? String(r.lastCalibratedAt).slice(0, 10) : "",
      nextCalibrationDue: r.nextCalibrationDue ? String(r.nextCalibrationDue).slice(0, 10) : "",
      calibrationStandard: str(r.calibrationStandard),
    }),
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
