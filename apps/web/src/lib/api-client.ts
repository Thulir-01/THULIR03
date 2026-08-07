// Single shared axios instance (see ./api.ts) — it handles 401 → refresh →
// retry, so every page here gets silent token refresh instead of a hard
// redirect to /login mid-work.
import api from "./api";

// ─── Auth ─────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

export async function register(body: Record<string, unknown>) {
  const { data } = await api.post('/auth/register', body);
  return data;
}

export async function getProfile() {
  const { data } = await api.get('/auth/profile');
  return data;
}

// ─── Patients ──────────────────────────────────────────────────────

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  abhaAddress: string | null;
  abhaNumber: string | null;
  patientId: string | null;
  createdAt: string;
  _count?: { orders: number };
}

export interface CreatePatientData {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  abhaAddress?: string;
  abhaNumber?: string;
  patientId?: string;
}

export async function getPatients(search?: string) {
  const { data } = await api.get('/patients', {
    params: search ? { search } : {},
  });
  return data as Patient[];
}

export async function getPatient(id: string) {
  const { data } = await api.get(`/patients/${id}`);
  return data;
}

export async function createPatient(body: CreatePatientData) {
  const { data } = await api.post('/patients', body);
  return data;
}

export async function updatePatient(id: string, body: Partial<CreatePatientData>) {
  const { data } = await api.put(`/patients/${id}`, body);
  return data;
}

export async function deletePatient(id: string) {
  const { data } = await api.delete(`/patients/${id}`);
  return data;
}

// ─── Parties (doctors, hospitals, corporates, insurers, labs, consultants) ──

export type PartyType =
  | "doctor"
  | "hospital"
  | "corporate"
  | "insurance_tpa"
  | "reference_lab"
  | "consultant";

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  doctor: "Doctor",
  hospital: "Hospital",
  corporate: "Corporate",
  insurance_tpa: "Insurance / TPA",
  reference_lab: "Reference Lab",
  consultant: "Consultant",
};

export interface Party {
  id: string;
  partyType: PartyType;
  name: string;
  address: string | null;
  gstin: string | null;
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  primaryContactEmail: string | null;
  status: string;
  createdAt: string;
  // Doctor detail (flattened when partyType === "doctor")
  specialty: string | null;
  qualification: string | null;
  clinicName: string | null;
  registration: string | null;
  commission: number | null;
  pricingMode: string | null;
  discountPercent: number | null;
  commercial: Record<string, unknown> | null;
  _count?: { orders: number; referrerPrices: number };
}

export interface CreatePartyData {
  name: string;
  partyType: PartyType;
  address?: string;
  gstin?: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;
  // Doctor-only
  specialty?: string;
  qualification?: string;
  clinicName?: string;
  registration?: string;
  commission?: number;
  pricingMode?: string;
  discountPercent?: number | null;
  commercial?: Record<string, unknown>;
  status?: string;
}

export async function getParties(params?: {
  type?: PartyType;
  search?: string;
}) {
  const { data } = await api.get("/parties", { params });
  return data as Party[];
}

export async function getParty(id: string) {
  const { data } = await api.get(`/parties/${id}`);
  return data as Party;
}

export async function createParty(body: CreatePartyData) {
  const { data } = await api.post("/parties", body);
  return data as Party;
}

export async function updateParty(id: string, body: Partial<CreatePartyData>) {
  const { data } = await api.patch(`/parties/${id}`, body);
  return data as Party;
}

export async function deleteParty(id: string) {
  const { data } = await api.delete(`/parties/${id}`);
  return data as { message: string };
}

// ─── Orders Registration ───────────────────────────────────────────

export interface RegisterOrderData {
  patientId?: string;
  firstName: string;
  lastName: string;
  title?: string;
  dateOfBirth?: string;
  ageYears?: number;
  ageMonths?: number;
  gender?: string;
  phone?: string;
  email?: string;
  referrer?: string;
  source?: string;
  insurance?: string;
  collectionBoy?: string;
  patientType?: string;
  ward?: string;
  ipOpNo?: string;
  bedNo?: string;
  category?: string;
  sidDate?: string;
  refNo?: string;
  branch?: string;
  tests: Array<{ code: string; name: string; rate: number }>;
  sampleCollectDate?: string;
  otherCharges?: number;
  discountPercent?: number;
  discountAuth?: string;
  amountPaid?: number;
  paymentMode?: string;
  bankName?: string;
  paymentRef?: string;
  paymentDate?: string;
  paymentRemarks?: string;
  deliveryMode?: string;
  clinicalRemarks?: string;
  emergency?: boolean;
  finalReportDate?: string;
  remarks?: string;
  billHf?: boolean;
  consolidatedBill?: boolean;
}

export async function registerPatient(data: RegisterOrderData) {
  const res = await api.post('/orders/register', data);
  return res.data as { message: string; patientId: string; orderId: string; orderNumber: string };
}

// ─── Orders (list + detail) ────────────────────────────────────────

export interface TestChild {
  id: string;
  testCode: string;
  testName: string;
  isProfile: boolean;
  rate: string;
  status: string;
  result: string | null;
  unit: string | null;
  refRange: string | null;
  refLow: number | null;
  refHigh: number | null;
  sortOrder: number | null;
  notes: string | null;
  children?: TestChild[];
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  category: string | null;
  source: string | null;
  billAmount: string | null;
  otherCharges: string | null;
  discountPercent: string | null;
  totalAmount: string | null;
  amountPaid: string | null;
  balanceAmount: string | null;
  paymentMode: string | null;
  deliveryMode: string | null;
  emergency: boolean;
  createdAt: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    gender: string | null;
  };
  tests: Array<{
    id: string;
    testCode: string;
    testName: string;
    rate: string;
    status: string;
    children?: TestChild[];
  }>;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  category: string | null;
  source: string | null;
  billAmount: string | null;
  otherCharges: string | null;
  discountPercent: string | null;
  totalAmount: string | null;
  amountPaid: string | null;
  balanceAmount: string | null;
  paymentMode: string | null;
  deliveryMode: string | null;
  emergency: boolean;
  clinicalRemarks: string | null;
  createdAt: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  verifiedByUser: { id: string; name: string } | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    title: string | null;
    phone: string | null;
    gender: string | null;
    dateOfBirth: string | null;
  };
  tests: TestChild[];
}

export async function getOrders(search?: string) {
  const { data } = await api.get('/orders', {
    params: search ? { search } : {},
  });
  return data as OrderListItem[];
}

export async function getOrder(id: string) {
  const { data } = await api.get(`/orders/${id}`);
  return data as OrderDetail;
}

export async function updateTestResult(orderId: string, testId: string, body: {
  result?: string;
  unit?: string;
  refRange?: string;
  status?: string;
  notes?: string;
}) {
  const { data } = await api.patch(`/orders/${orderId}/tests/${testId}`, body);
  return data;
}

export interface WorkflowState {
  id: string;
  orderNumber: string;
  status: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  finalReportDate: string | null;
}

export async function verifyOrder(orderId: string) {
  const { data } = await api.post(`/orders/${orderId}/verify`);
  return data as WorkflowState;
}

export async function approveOrder(orderId: string) {
  const { data } = await api.post(`/orders/${orderId}/approve`);
  return data as WorkflowState;
}

export interface ReportTestRow {
  testCode: string;
  testName: string;
  isProfile: boolean;
  result: string | null;
  unit: string | null;
  refRange: string | null;
  refLow: number | null;
  refHigh: number | null;
  notes: string | null;
  status: string;
  children?: ReportTestRow[];
}

export interface ClinicalReport {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  sampleCollectDt: string | null;
  refNo: string | null;
  remarks: string | null;
  priority: string;
  emergency: boolean;
  patient: {
    title: string | null;
    firstName: string;
    lastName: string;
    gender: string | null;
    dateOfBirth: string | null;
    ageYears: number | null;
    ageMonths: number | null;
    phone: string | null;
  };
  referrer: string | null;
  verifiedAt: string | null;
  approvedAt: string | null;
  finalReportDate: string | null;
  verifiedBy: { name: string; signatureImageUrl: string | null } | null;
  approvedBy: {
    name: string;
    designation: string | null;
    registrationNo: string | null;
    signatureImageUrl: string | null;
  } | null;
  lab: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  tests: ReportTestRow[];
}

export async function getOrderReport(orderId: string) {
  const { data } = await api.get(`/orders/${orderId}/report`);
  return data as ClinicalReport;
}

export interface InvoiceTestRow {
  testCode: string;
  testName: string;
  isProfile: boolean;
  rate: string;
  status: string;
  children?: { testCode: string; testName: string; rate: string }[];
}

export interface OrderInvoice {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  priority: string;
  emergency: boolean;
  refNo: string | null;
  deliveryMode: string | null;
  consolidatedBill: boolean;
  patient: {
    title: string | null;
    firstName: string;
    lastName: string;
    gender: string | null;
    dateOfBirth: string | null;
    ageYears: number | null;
    ageMonths: number | null;
    phone: string | null;
    email: string | null;
  };
  referrer: string | null;
  tests: InvoiceTestRow[];
  billing: {
    billAmount: string | null;
    otherCharges: string | null;
    discountPercent: string | null;
    discountAmount: string | null;
    discountAuth: string | null;
    totalAmount: string | null;
    amountPaid: string | null;
    balanceAmount: string | null;
    paymentMode: string | null;
    bankName: string | null;
    paymentRef: string | null;
    paymentDate: string | null;
    paymentRemarks: string | null;
  };
}

export async function getOrderInvoice(orderId: string) {
  const { data } = await api.get(`/orders/${orderId}/invoice`);
  return data as OrderInvoice;
}

// ─── Dashboard Stats ──────────────────────────────────────────────

export interface DashboardStats {
  totalPatients: number;
  totalReferrers: number;
  totalOrders: number;
  pendingTests: number;
  todayRevenue: number;
  recentOrders: OrderListItem[];
}

/**
 * Server-side COUNT queries — no full patient/referrer fetches.
 * The backend runs COUNT(...) + aggregate instead of loading every row.
 */
export async function getDashboardStats() {
  const { data } = await api.get('/dashboard/stats');
  return data as DashboardStats;
}

export interface AnalyticsReport {
  range: { from: string | null; to: string | null };
  revenue: {
    totalBilled: number;
    totalDiscount: number;
    totalCollected: number;
    totalOutstanding: number;
    orderCount: number;
  };
  dailySeries: { date: string; billed: number; collected: number }[];
  testVolumes: {
    testCode: string;
    testName: string;
    count: number;
    rateSum: number;
  }[];
  referrerPayouts: {
    partyId: string | null;
    name: string;
    orderCount: number;
    billed: number;
    commissionPercent: number;
    estimatedPayout: number;
  }[];
}

export async function getAnalytics(params?: { from?: string; to?: string }) {
  const { data } = await api.get('/reports/analytics', { params });
  return data as AnalyticsReport;
}

// ─── Audit Logs ──────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  tenantId: string | null;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export async function getAuditLogs(params?: {
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const { data } = await api.get("/audit-logs", { params });
  return data as AuditLogEntry[];
}

// ─── Masters: Test Catalog & Referrer Pricing ─────────────────

export interface TestCategory {
  id: string;
  name: string;
  codePrefix: string;
  defaultSampleType: string | null;
  defaultTurnaroundHours: number | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { parameters: number };
}

export interface TestParameter {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  sampleType: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  methodology: string | null;
  turnaroundHours: number | null;
  defaultPrice: number;
  isActive: boolean;
  sortOrder: number;
  usageCount?: number;
  category?: { id: string; name: string };
  // Master-config extensions (technical specs + acceptance criteria + workflow)
  testCategory: string | null;
  detectionLimit: number | null;
  reportingLimit: number | null;
  lowerLimit: number | null;
  upperLimit: number | null;
  limitType: string | null;
  criticalValueAlert: boolean;
  autoApprove: boolean;
  requiresApproval: boolean;
  visibleOnReport: boolean;
  calculationFormula: string | null;
}

export interface TestPackageItem {
  id: string;
  packageId: string;
  parameterId: string;
  parameter?: TestParameter;
}

export interface TestPackage {
  id: string;
  code: string;
  name: string;
  description: string | null;
  pricingMode: "sum" | "fixed";
  fixedPrice: number | null;
  isActive: boolean;
  items: TestPackageItem[];
  _count?: { referrerPrices: number };
}

export interface ReferrerPriceItem {
  id: string;
  referrerId: string;
  parameterId: string | null;
  packageId: string | null;
  price: number;
  parameter?: { id: string; code: string; name: string; defaultPrice: number };
  package?: { id: string; code: string; name: string; pricingMode: string; fixedPrice: number | null };
}

export interface PricePreviewItem {
  id: string;
  code: string;
  name: string;
  kind: "parameter" | "package";
  defaultPrice: number;
  resolvedPrice: number;
  mode: string;
}

export async function getMastersCategories() {
  const { data } = await api.get("/masters/categories");
  return data as TestCategory[];
}

export async function createMastersCategory(body: { name: string; codePrefix?: string; defaultSampleType?: string; defaultTurnaroundHours?: number; sortOrder?: number }) {
  const { data } = await api.post("/masters/categories", body);
  return data as TestCategory;
}

export async function updateMastersCategory(id: string, body: Partial<{ name: string; codePrefix: string; defaultSampleType: string | null; defaultTurnaroundHours: number | null; sortOrder: number; isActive: boolean }>) {
  const { data } = await api.patch(`/masters/categories/${id}`, body);
  return data as TestCategory;
}

export async function generateMastersParameterCode(categoryId: string) {
  const { data } = await api.get("/masters/parameters/generate-code", {
    params: { categoryId },
  });
  return data as string;
}

export async function generateMastersPackageCode() {
  const { data } = await api.get("/masters/packages/generate-code");
  return data as string;
}

export async function setMastersParameterStatus(id: string, isActive: boolean) {
  const { data } = await api.patch(`/masters/parameters/${id}/status`, { isActive });
  return data as TestParameter;
}

export async function bulkSetMastersParameterStatus(ids: string[], isActive: boolean) {
  const { data } = await api.patch("/masters/parameters/bulk-status", { ids, isActive });
  return data as { updated: number };
}

export async function setMastersPackageStatus(id: string, isActive: boolean) {
  const { data } = await api.patch(`/masters/packages/${id}/status`, { isActive });
  return data as TestPackage;
}

export async function bulkSetMastersPackageStatus(ids: string[], isActive: boolean) {
  const { data } = await api.patch("/masters/packages/bulk-status", { ids, isActive });
  return data as { updated: number };
}

export async function getMastersParameters(params?: { categoryId?: string; search?: string; isActive?: string }) {
  const { data } = await api.get("/masters/parameters", { params });
  return data as TestParameter[];
}

export async function getMastersParameter(id: string) {
  const { data } = await api.get(`/masters/parameters/${id}`);
  return data as TestParameter;
}

export async function createMastersParameter(body: Record<string, unknown>) {
  const { data } = await api.post("/masters/parameters", body);
  return data as TestParameter;
}

export async function updateMastersParameter(id: string, body: Record<string, unknown>) {
  const { data } = await api.patch(`/masters/parameters/${id}`, body);
  return data as TestParameter;
}

export async function deleteMastersParameter(id: string) {
  const { data } = await api.delete(`/masters/parameters/${id}`);
  return data;
}

export async function getMastersPackages(search?: string) {
  const { data } = await api.get("/masters/packages", { params: search ? { search } : {} });
  return data as TestPackage[];
}

export async function getMastersPackage(id: string) {
  const { data } = await api.get(`/masters/packages/${id}`);
  return data as TestPackage;
}

export async function createMastersPackage(body: Record<string, unknown>) {
  const { data } = await api.post("/masters/packages", body);
  return data as TestPackage;
}

export async function updateMastersPackage(id: string, body: Record<string, unknown>) {
  const { data } = await api.patch(`/masters/packages/${id}`, body);
  return data as TestPackage;
}

export async function deleteMastersPackage(id: string) {
  const { data } = await api.delete(`/masters/packages/${id}`);
  return data;
}

export async function getReferrerPrices(referrerId: string) {
  const { data } = await api.get(`/masters/referrers/${referrerId}/prices`);
  return data as ReferrerPriceItem[];
}

export async function saveReferrerPrices(referrerId: string, rows: Array<{ parameterId?: string; packageId?: string; price: number }>) {
  const { data } = await api.put(`/masters/referrers/${referrerId}/prices`, rows);
  return data as ReferrerPriceItem[];
}

export async function deleteReferrerPrice(referrerId: string, id: string) {
  const { data } = await api.delete(`/masters/referrers/${referrerId}/prices/${id}`);
  return data;
}

export async function getPricePreview(params?: { referrerId?: string; parameterIds?: string; packageIds?: string }) {
  const { data } = await api.get("/masters/price-preview", { params });
  return data as {
    referrer: { id: string; pricingMode: string | null; discountPercent: number | null } | null;
    items: PricePreviewItem[];
  };
}

// ─── Masters: Generic Lookups (8 types, one table) ────────────────

export type LookupMasterType =
  | "sample_type"
  | "container_type"
  | "unit"
  | "method"
  | "payment_mode"
  | "rejection_reason"
  | "discount_scheme"
  | "tax_rate";

export interface LookupMaster {
  id: string;
  type: LookupMasterType;
  code: string;
  name: string;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLookupData {
  code: string;
  name: string;
  metadata?: Record<string, unknown>;
  sortOrder?: number;
  isActive?: boolean;
}

export async function getLookupMasters(
  type: LookupMasterType,
  params?: { search?: string; isActive?: string },
) {
  const { data } = await api.get(`/masters/lookup/${type}`, { params });
  return data as LookupMaster[];
}

export async function createLookupMaster(
  type: LookupMasterType,
  body: CreateLookupData,
) {
  const { data } = await api.post(`/masters/lookup/${type}`, body);
  return data as LookupMaster;
}

export async function updateLookupMaster(
  type: LookupMasterType,
  id: string,
  body: Partial<CreateLookupData>,
) {
  const { data } = await api.patch(`/masters/lookup/${type}/${id}`, body);
  return data as LookupMaster;
}

export async function deleteLookupMaster(
  type: LookupMasterType,
  id: string,
) {
  const { data } = await api.delete(`/masters/lookup/${type}/${id}`);
  return data as LookupMaster;
}

export async function setLookupMasterStatus(
  type: LookupMasterType,
  id: string,
  isActive: boolean,
) {
  const { data } = await api.patch(`/masters/lookup/${type}/${id}/status`, {
    isActive,
  });
  return data as LookupMaster;
}

export async function generateLookupMasterCode(type: LookupMasterType) {
  const { data } = await api.get(`/masters/lookup/${type}/generate-code`);
  return data as string;
}

// ─── Master Configuration (full LIMS masters) ─────────────────────────────
// Four dedicated masters (hospital / sample type / method / instrument) plus
// the client master reusing the Parties API. All writes are auto-audited.

export interface HospitalMaster {
  id: string;
  code: string;
  name: string;
  country: string | null;
  state: string | null;
  city: string | null;
  place: string | null;
  street: string | null;
  pinCode: string | null;
  stdCode: string | null;
  isdCode: string | null;
  zone: string | null;
  mobile: string | null;
  phone1: string | null;
  phone2: string | null;
  fax: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  panNo: string | null;
  headerImagePath: string | null;
  footerImagePath: string | null;
  reportName: string | null;
  headerMarginPx: number | null;
  footerMarginPx: number | null;
  inactive: boolean;
  uploadResults: boolean;
  noSms: boolean;
  noEmail: boolean;
  outsourceTests: boolean;
  footerInfo: boolean;
  monthWiseCommission: boolean;
  criticalEmail: boolean;
  whatsappReport: boolean;
  enableOnlineBooking: boolean;
  blockPrintWhenDue: boolean;
  noWhatsapp: boolean;
  onlySplAmountBilling: boolean;
  specialDiscountApplicable: boolean;
  stopReportPrinting: boolean;
  ignoreCreditLimit: boolean;
  noReportDate: boolean;
  showPatientTrendGraph: boolean;
  whatsappReportForPatient: boolean;
  criticalValueSms: boolean;
  allowDueReportOnline: boolean;
  onlySplAmountOnline: boolean;
  noDueEmail: boolean;
  autoInvoice: boolean;
  autoInvoicePeriod: string | null;
  preferredDoctorId: string | null;
  collectionBoyId: string | null;
  reportDisplayMode: string | null;
  creditBill: boolean;
  cashBill: boolean;
  creditDays: number | null;
  creditLimit: number | null;
  webPassword: string | null;
  sentChannels: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SampleTypeMaster {
  id: string;
  code: string;
  name: string;
  collectionMethod: string | null;
  containerType: string | null;
  containerColor: string | null;
  storageCondition: string | null;
  shelfLifeHours: number | null;
  preAnalytical: string | null;
  active: boolean;
  requiresRequisition: boolean;
  autoGenerateId: boolean;
  rejectOnHemolysis: boolean;
  compositeSample: boolean;
  priorityDefault: string | null;
  tatHours: number | null;
  associatedTests: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestMethod {
  id: string;
  code: string;
  name: string;
  standardBody: string | null;
  category: string | null;
  referenceDoc: string | null;
  description: string | null;
  active: boolean;
  mandatory: boolean;
  versionControl: boolean;
  defaultParameters: string[] | null;
  safetyPrecautions: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Instrument {
  id: string;
  code: string;
  name: string;
  modelName: string | null;
  manufacturer: string | null;
  assetTag: string | null;
  serialNo: string | null;
  location: string;
  status: string;
  assignedTo: string | null;
  calibrationFrequency: string | null;
  lastCalibratedAt: string | null;
  nextCalibrationDue: string | null;
  calibrationStandard: string | null;
  active: boolean;
  requiresQc: boolean;
  downtimeWarning: boolean;
  createdAt: string;
  updatedAt: string;
}

// Hospital

export async function getHospitals(params?: {
  search?: string;
  isActive?: string;
}) {
  const { data } = await api.get("/master-config/hospitals", { params });
  return data as HospitalMaster[];
}
export async function createHospital(body: Record<string, unknown>) {
  const { data } = await api.post("/master-config/hospitals", body);
  return data as HospitalMaster;
}
export async function updateHospital(
  id: string,
  body: Record<string, unknown>,
) {
  const { data } = await api.patch(`/master-config/hospitals/${id}`, body);
  return data as HospitalMaster;
}
export async function setHospitalStatus(id: string, isActive: boolean) {
  const { data } = await api.patch(
    `/master-config/hospitals/${id}/status`,
    { isActive },
  );
  return data as HospitalMaster;
}
export async function removeHospital(id: string) {
  const { data } = await api.delete(`/master-config/hospitals/${id}`);
  return data as HospitalMaster;
}
export async function generateHospitalCode() {
  const { data } = await api.get("/master-config/hospitals/generate-code");
  return data as string;
}

// Sample types

export async function getSampleTypeMasters(params?: {
  search?: string;
  isActive?: string;
}) {
  const { data } = await api.get("/master-config/sample-types", { params });
  return data as SampleTypeMaster[];
}
export async function createSampleTypeMaster(body: Record<string, unknown>) {
  const { data } = await api.post("/master-config/sample-types", body);
  return data as SampleTypeMaster;
}
export async function updateSampleTypeMaster(
  id: string,
  body: Record<string, unknown>,
) {
  const { data } = await api.patch(`/master-config/sample-types/${id}`, body);
  return data as SampleTypeMaster;
}
export async function setSampleTypeMasterStatus(id: string, isActive: boolean) {
  const { data } = await api.patch(
    `/master-config/sample-types/${id}/status`,
    { isActive },
  );
  return data as SampleTypeMaster;
}
export async function removeSampleTypeMaster(id: string) {
  const { data } = await api.delete(`/master-config/sample-types/${id}`);
  return data as SampleTypeMaster;
}
export async function generateSampleTypeMasterCode() {
  const { data } = await api.get("/master-config/sample-types/generate-code");
  return data as string;
}

// Methods

export async function getTestMethods(params?: {
  search?: string;
  isActive?: string;
}) {
  const { data } = await api.get("/master-config/methods", { params });
  return data as TestMethod[];
}
export async function createTestMethod(body: Record<string, unknown>) {
  const { data } = await api.post("/master-config/methods", body);
  return data as TestMethod;
}
export async function updateTestMethod(
  id: string,
  body: Record<string, unknown>,
) {
  const { data } = await api.patch(`/master-config/methods/${id}`, body);
  return data as TestMethod;
}
export async function setTestMethodStatus(id: string, isActive: boolean) {
  const { data } = await api.patch(`/master-config/methods/${id}/status`, {
    isActive,
  });
  return data as TestMethod;
}
export async function removeTestMethod(id: string) {
  const { data } = await api.delete(`/master-config/methods/${id}`);
  return data as TestMethod;
}
export async function generateTestMethodCode() {
  const { data } = await api.get("/master-config/methods/generate-code");
  return data as string;
}

// Instruments

export async function getInstruments(params?: {
  search?: string;
  isActive?: string;
}) {
  const { data } = await api.get("/master-config/instruments", { params });
  return data as Instrument[];
}
export async function createInstrument(body: Record<string, unknown>) {
  const { data } = await api.post("/master-config/instruments", body);
  return data as Instrument;
}
export async function updateInstrument(
  id: string,
  body: Record<string, unknown>,
) {
  const { data } = await api.patch(`/master-config/instruments/${id}`, body);
  return data as Instrument;
}
export async function setInstrumentStatus(id: string, isActive: boolean) {
  const { data } = await api.patch(`/master-config/instruments/${id}/status`, {
    isActive,
  });
  return data as Instrument;
}
export async function removeInstrument(id: string) {
  const { data } = await api.delete(`/master-config/instruments/${id}`);
  return data as Instrument;
}
export async function generateInstrumentCode() {
  const { data } = await api.get("/master-config/instruments/generate-code");
  return data as string;
}

// ─── Lab Settings (org details on reports & invoices) ─────────────────────

export interface LabSettings {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export async function getLabSettings() {
  const { data } = await api.get("/settings/lab");
  return data as LabSettings;
}

export async function updateLabSettings(body: Partial<LabSettings>) {
  const { data } = await api.patch("/settings/lab", body);
  return data as LabSettings;
}

// ─── Staff / NABL Sign-off Details ─────────────────────────────────────────

export interface StaffDetail {
  id: string;
  registrationNo: string | null;
  qualification: string | null;
  designation: string | null;
  signatureImageUrl: string | null;
  updatedAt: string;
}

export interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  role: { id: string; name: string; slug: string } | null;
  branch: { id: string; name: string } | null;
  staffDetail: StaffDetail | null;
}

export interface UpsertStaffDetailData {
  registrationNo?: string;
  qualification?: string;
  designation?: string;
  signatureImageUrl?: string;
}

export async function listStaff() {
  const { data } = await api.get("/users/staff");
  return data as StaffUser[];
}

export async function getStaffDetail(userId: string) {
  const { data } = await api.get(`/users/${userId}/staff-detail`);
  return data as StaffUser;
}

export async function upsertStaffDetail(
  userId: string,
  body: UpsertStaffDetailData,
) {
  const { data } = await api.put(`/users/${userId}/staff-detail`, body);
  return data as StaffDetail;
}

export async function removeStaffDetail(userId: string) {
  const { data } = await api.delete(`/users/${userId}/staff-detail`);
  return data as { message: string };
}

// ─── System Settings: User Management & RBAC ────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: string; name: string; slug: string } | null;
  branch: { id: string; name: string } | null;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  rolePermissions: {
    id: string;
    roleId: string;
    permissionId: string;
    isAllowed: boolean;
    permission: Permission;
  }[];
  _count?: { users: number };
}

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleId?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  roleId?: string;
  isActive?: boolean;
  password?: string;
  lastLoginAt?: Date | string;
}

export async function listUsers() {
  const { data } = await api.get("/users");
  return data as AdminUser[];
}

export async function createUser(body: CreateUserData) {
  const { data } = await api.post("/users", body);
  return data as AdminUser;
}

export async function updateUser(id: string, body: UpdateUserData) {
  const { data } = await api.put(`/users/${id}`, body);
  return data as AdminUser;
}

export async function deactivateUser(id: string) {
  const { data } = await api.delete(`/users/${id}`);
  return data as { message: string };
}

export async function listRoles() {
  const { data } = await api.get("/roles");
  return data as Role[];
}

export async function listPermissions() {
  const { data } = await api.get("/roles/permissions");
  return data as Permission[];
}

export async function setRolePermissions(roleId: string, permissionIds: string[]) {
  const { data } = await api.put(`/roles/${roleId}/permissions`, {
    permissionIds,
  });
  return data as Role;
}

export async function seedDefaultPermissions() {
  const { data } = await api.post("/roles/seed-permissions");
  return data as { message: string };
}


// ─── Inventory ─────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unit: string | null;
  minStock: number;
  quantityOnHand: number;
  supplierId: string | null;
  supplierName: string | null;
  isActive: boolean;
  lowStock: boolean;
  createdAt: string;
  requirementCount?: number;
}

export interface InventorySupplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { items: number };
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  itemName: string;
  type: "in" | "out";
  quantity: number;
  batchNo: string | null;
  expiryDate: string | null;
  unitCost: number | null;
  reference: string | null;
  notes: string | null;
  performedAt: string;
}

export interface TestRequirement {
  id: string;
  parameterId: string;
  parameterCode: string;
  parameterName: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  quantity: number;
}

export interface InventoryAlerts {
  lowStock: InventoryItem[];
  expiring: {
    id: string;
    itemId: string;
    itemName: string;
    sku: string;
    batchNo: string | null;
    expiryDate: string;
  }[];
  expired: {
    id: string;
    itemId: string;
    itemName: string;
    sku: string;
    batchNo: string | null;
    expiryDate: string;
  }[];
}

export async function getInventoryItems(params?: {
  search?: string;
  lowStock?: string;
  includeInactive?: string;
}) {
  const { data } = await api.get("/inventory/items", { params });
  return data as InventoryItem[];
}

export async function createInventoryItem(body: {
  name: string;
  sku: string;
  category?: string;
  unit?: string;
  minStock?: number;
  supplierId?: string;
}) {
  const { data } = await api.post("/inventory/items", body);
  return data as InventoryItem;
}

export async function updateInventoryItem(
  id: string,
  body: Partial<{
    name: string;
    sku: string;
    category: string;
    unit: string;
    minStock: number;
    supplierId: string;
    isActive: boolean;
  }>,
) {
  const { data } = await api.patch(`/inventory/items/${id}`, body);
  return data as InventoryItem;
}

export async function deleteInventoryItem(id: string) {
  const { data } = await api.delete(`/inventory/items/${id}`);
  return data as { message: string };
}

export async function stockIn(body: {
  itemId: string;
  quantity: number;
  batchNo?: string;
  expiryDate?: string;
  unitCost?: number;
  reference?: string;
  notes?: string;
}) {
  const { data } = await api.post("/inventory/stock/in", body);
  return data as InventoryItem;
}

export async function stockOut(body: {
  itemId: string;
  quantity: number;
  reference?: string;
  notes?: string;
}) {
  const { data } = await api.post("/inventory/stock/out", body);
  return data as InventoryItem;
}

export async function getInventoryTransactions(params?: {
  itemId?: string;
  type?: string;
}) {
  const { data } = await api.get("/inventory/transactions", { params });
  return data as InventoryTransaction[];
}

export async function getItemTransactions(itemId: string) {
  const { data } = await api.get(`/inventory/items/${itemId}/transactions`);
  return data as InventoryTransaction[];
}

export async function getInventoryAlerts() {
  const { data } = await api.get("/inventory/alerts");
  return data as InventoryAlerts;
}

// ─── QC — manual Westgard control runs ────────────────────────────────

export type QcLevel = "LOW" | "NORMAL" | "HIGH";
export type QcStatus = "PASS" | "WARN" | "REJECT";

export interface QcControl {
  id: string;
  testName: string;
  testCode: string | null;
  level: QcLevel;
  name: string;
  unit: string | null;
  assignedMean: number;
  assignedSd: number;
  isActive: boolean;
  runCount: number;
}

export interface QcRun {
  id: string;
  controlId: string;
  controlName: string;
  testName: string;
  measuredValue: number;
  sdDeviation: number | null;
  status: QcStatus;
  violations: string[];
  note: string | null;
  runDate: string;
}

export interface QcSummary {
  controls: number;
  today: { runs: number; PASS: number; WARN: number; REJECT: number };
  latest: {
    id: string;
    controlName: string;
    testName: string;
    measuredValue: number;
    status: QcStatus;
    violations: string[];
    runDate: string;
  } | null;
}

export async function getQcControls(search?: string) {
  const { data } = await api.get("/qc/controls", {
    params: search ? { search } : {},
  });
  return data as QcControl[];
}

export async function createQcControl(body: {
  testName: string;
  testCode?: string;
  level?: QcLevel;
  unit?: string;
  assignedMean: number;
  assignedSd: number;
}) {
  const { data } = await api.post("/qc/controls", body);
  return data as QcControl;
}

export async function getQcRuns(controlId?: string, limit = 50) {
  const { data } = await api.get("/qc/runs", {
    params: { ...(controlId ? { controlId } : {}), limit },
  });
  return data as QcRun[];
}

export async function enterQcRun(body: { controlId: string; value: number; note?: string }) {
  const { data } = await api.post("/qc/runs", body);
  return data as {
    run: QcRun;
    control: { id: string; name: string; testName: string; unit: string | null; mean: number; sd: number };
    evaluation: { status: QcStatus; violations: string[]; sdDeviation: number };
  };
}

export async function getQcSummary() {
  const { data } = await api.get("/qc/summary");
  return data as QcSummary;
}

export async function getInventorySuppliers(search?: string) {
  const { data } = await api.get("/inventory/suppliers", {
    params: search ? { search } : {},
  });
  return data as InventorySupplier[];
}

export async function createInventorySupplier(body: {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  const { data } = await api.post("/inventory/suppliers", body);
  return data as InventorySupplier;
}

export async function updateInventorySupplier(
  id: string,
  body: Partial<{
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    isActive: boolean;
  }>,
) {
  const { data } = await api.patch(`/inventory/suppliers/${id}`, body);
  return data as InventorySupplier;
}

export async function deleteInventorySupplier(id: string) {
  const { data } = await api.delete(`/inventory/suppliers/${id}`);
  return data as { message: string };
}

export async function getTestRequirements(params?: {
  itemId?: string;
  parameterId?: string;
}) {
  const { data } = await api.get("/inventory/requirements", { params });
  return data as TestRequirement[];
}

export async function setTestRequirement(body: {
  parameterId: string;
  itemId: string;
  quantity: number;
}) {
  const { data } = await api.post("/inventory/requirements", body);
  return data as TestRequirement;
}

export async function deleteTestRequirement(id: string) {
  const { data } = await api.delete(`/inventory/requirements/${id}`);
  return data as { message: string };
}

// ─── Portals ───────────────────────────────────────────────────────────

export type PortalKind = "patient" | "referrer";

export interface PortalOrder {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  emergency: boolean;
  createdAt: string;
  finalReportDate: string | null;
  reportReady: boolean;
  patientName: string | null;
  testCount: number;
  tests: { testName: string; status: string }[];
}

export interface PortalReportTest {
  testCode: string;
  testName: string;
  isProfile: boolean;
  result: string | null;
  unit: string | null;
  refRange: string | null;
  refLow: number | null;
  refHigh: number | null;
  notes: string | null;
  status: string;
  children: {
    testCode: string;
    testName: string;
    result: string | null;
    unit: string | null;
    refRange: string | null;
    refLow: number | null;
    refHigh: number | null;
    status: string;
  }[];
}

export interface PortalReport {
  orderNumber: string;
  status: string;
  priority: string;
  emergency: boolean;
  createdAt: string;
  sampleCollectDt: string | null;
  refNo: string | null;
  remarks: string | null;
  finalReportDate: string | null;
  verifiedAt: string | null;
  approvedAt: string | null;
  patient: {
    firstName: string;
    lastName: string;
    gender: string | null;
    dateOfBirth: string | null;
    ageYears: number | null;
    ageMonths: number | null;
    phone: string | null;
  };
  referrer: string | null;
  lab: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  tests: PortalReportTest[];
}

export interface ReportVerification {
  valid: boolean;
  orderNumber?: string;
  status?: string;
  labName?: string | null;
  reportDate?: string | null;
  patientName?: string;
  tests?: string[];
  message?: string;
}

export async function enrollPortalUser(body: {
  kind: PortalKind;
  entityId: string;
  email: string;
  password: string;
}) {
  const { data } = await api.post("/portals/enroll", body);
  return data as { message: string; email: string; role: string };
}

export async function revokePortalUser(body: { kind: PortalKind; entityId: string }) {
  const { data } = await api.post("/portals/revoke", body);
  return data as { message: string };
}

export async function resetPortalPassword(body: { userId: string; password: string }) {
  const { data } = await api.post("/portals/reset-password", body);
  return data as { message: string };
}

export async function getPatientPortalOrders() {
  const { data } = await api.get("/portals/patient/orders");
  return data as PortalOrder[];
}

export async function getPatientPortalReport(orderId: string) {
  const { data } = await api.get(`/portals/patient/orders/${orderId}`);
  return data as PortalReport;
}

export async function getReferrerPortalOrders() {
  const { data } = await api.get("/portals/referrer/orders");
  return data as PortalOrder[];
}

export async function getReferrerPortalReport(orderId: string) {
  const { data } = await api.get(`/portals/referrer/orders/${orderId}`);
  return data as PortalReport;
}

export async function verifyReportPublic(orderNumber: string) {
  const { data } = await api.get("/public/reports/verify", {
    params: { orderNumber },
  });
  return data as ReportVerification;
}
