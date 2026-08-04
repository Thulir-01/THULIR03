// Lightweight mock API client for frontend development.
// Replace with real API integration when backend details are available.

export interface PatientResult {
  id: string;
  firstName: string;
  lastName?: string;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  email?: string | null;
  _count?: { orders: number };
}

const MOCK_PATIENTS: PatientResult[] = [
  { id: "pat_1", firstName: "Ravi", lastName: "Kumar", phone: "9876543210", gender: "male", dateOfBirth: "1986-05-12T00:00:00Z", email: "ravi@example.com", _count: { orders: 5 } },
  { id: "pat_2", firstName: "Priya", lastName: "Sharma", phone: "9123456780", gender: "female", dateOfBirth: "1990-11-02T00:00:00Z", email: "priya@example.com", _count: { orders: 2 } },
  { id: "pat_3", firstName: "Suresh", lastName: "Rajan", phone: "9001122334", gender: "male", dateOfBirth: "1975-02-20T00:00:00Z", email: null, _count: { orders: 12 } },
];

export async function getPatients(q: string): Promise<PatientResult[]> {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 200));
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return MOCK_PATIENTS.filter(p => {
    return (
      p.firstName.toLowerCase().includes(s) ||
      (p.lastName && p.lastName.toLowerCase().includes(s)) ||
      (p.phone && p.phone.includes(s))
    );
  });
}

export interface RegisterPayload {
  patientId?: string;
  firstName?: string;
  lastName?: string;
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
  tests?: Array<{ code: string; name: string; rate: number }>;
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

export async function registerPatient(payload: RegisterPayload): Promise<{ orderNumber: string }> {
  // Simulate validation and network latency
  await new Promise((r) => setTimeout(r, 400));

  if (!payload.tests || payload.tests.length === 0) {
    const err: any = new Error("At least one test must be selected");
    err.response = { status: 400, data: { message: "At least one test must be selected" } };
    throw err;
  }

  // Create fake order number
  const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

  return { orderNumber };
}
