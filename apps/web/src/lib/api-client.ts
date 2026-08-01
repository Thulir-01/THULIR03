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

// ─── Referrers (Doctors) ─────────────────────────────────────────

export interface Referrer {
  id: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  clinicName: string | null;
  registration: string | null;
  commission: number | null;
  pricingMode: string | null;
  discountPercent: number | null;
  isActive: boolean;
  createdAt: string;
  _count?: { orders: number };
}

export interface CreateReferrerData {
  name: string;
  specialty?: string;
  phone?: string;
  email?: string;
  clinicName?: string;
  registration?: string;
  commission?: number;
  pricingMode?: string;
  discountPercent?: number | null;
}

export async function getReferrers(search?: string) {
  const { data } = await api.get('/referrers', {
    params: search ? { search } : {},
  });
  return data as Referrer[];
}

export async function getReferrer(id: string) {
  const { data } = await api.get(`/referrers/${id}`);
  return data;
}

export async function createReferrer(body: CreateReferrerData) {
  const { data } = await api.post('/referrers', body);
  return data;
}

export async function updateReferrer(id: string, body: Partial<CreateReferrerData>) {
  const { data } = await api.put(`/referrers/${id}`, body);
  return data;
}

export async function deleteReferrer(id: string) {
  const { data } = await api.delete(`/referrers/${id}`);
  return data;
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

// ─── Audit Logs ──────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  tenantId: string | null;
  actorId: string | null;
  actorName: string | null;
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
