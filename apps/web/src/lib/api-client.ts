import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

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
}) {
  const { data } = await api.patch(`/orders/${orderId}/tests/${testId}`, body);
  return data;
}

// ─── Dashboard Stats ──────────────────────────────────────────────

export async function getDashboardStats(_orgId: string) {
  const [patients, referrers, _profile] = await Promise.all([
    getPatients(),
    getReferrers(),
    getProfile(),
  ]);
  return {
    totalPatients: patients.length,
    totalReferrers: referrers.length,
    recentPatients: patients.slice(0, 5),
    recentReferrers: referrers.slice(0, 5),
  };
}
