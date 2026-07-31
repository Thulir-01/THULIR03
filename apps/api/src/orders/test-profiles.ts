// THULIR03 — Test Profiles with Sub-parameters, Units & Reference Ranges
// Used at registration to auto-expand profiles into individual parameters

export interface TestParameter {
  code: string;
  name: string;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  refRange: string;
  sortOrder: number;
}

export interface TestProfile {
  code: string;
  name: string;
  rate: number;
  parameters: TestParameter[];
}

export const TEST_PROFILES: TestProfile[] = [
  // ─── COMPLETE BLOOD COUNT (CBC) ──────────────────────────────
  {
    code: 'CBC',
    name: 'Complete Blood Count',
    rate: 500,
    parameters: [
      {
        code: 'HB',
        name: 'Haemoglobin',
        unit: 'g/dL',
        refLow: 12.0,
        refHigh: 16.0,
        refRange: '12.0 – 16.0',
        sortOrder: 1,
      },
      {
        code: 'RBC',
        name: 'RBC Count',
        unit: '10^6/μL',
        refLow: 4.5,
        refHigh: 5.5,
        refRange: '4.5 – 5.5',
        sortOrder: 2,
      },
      {
        code: 'PCV',
        name: 'Packed Cell Volume',
        unit: '%',
        refLow: 36,
        refHigh: 48,
        refRange: '36 – 48',
        sortOrder: 3,
      },
      {
        code: 'MCV',
        name: 'Mean Corpuscular Volume',
        unit: 'fL',
        refLow: 80,
        refHigh: 100,
        refRange: '80 – 100',
        sortOrder: 4,
      },
      {
        code: 'MCH',
        name: 'Mean Corpuscular Hb',
        unit: 'pg',
        refLow: 27,
        refHigh: 34,
        refRange: '27 – 34',
        sortOrder: 5,
      },
      {
        code: 'MCHC',
        name: 'Mean Corpuscular Hb Conc',
        unit: 'g/dL',
        refLow: 32,
        refHigh: 36,
        refRange: '32 – 36',
        sortOrder: 6,
      },
      {
        code: 'WBC',
        name: 'Total WBC Count',
        unit: '10^3/μL',
        refLow: 4.0,
        refHigh: 11.0,
        refRange: '4.0 – 11.0',
        sortOrder: 7,
      },
      {
        code: 'PLT',
        name: 'Platelet Count',
        unit: '10^3/μL',
        refLow: 150,
        refHigh: 400,
        refRange: '150 – 400',
        sortOrder: 8,
      },
      {
        code: 'NEUT',
        name: 'Neutrophils',
        unit: '%',
        refLow: 40,
        refHigh: 80,
        refRange: '40 – 80',
        sortOrder: 9,
      },
      {
        code: 'LYMPH',
        name: 'Lymphocytes',
        unit: '%',
        refLow: 20,
        refHigh: 40,
        refRange: '20 – 40',
        sortOrder: 10,
      },
      {
        code: 'MONO',
        name: 'Monocytes',
        unit: '%',
        refLow: 2,
        refHigh: 10,
        refRange: '2 – 10',
        sortOrder: 11,
      },
      {
        code: 'EOS',
        name: 'Eosinophils',
        unit: '%',
        refLow: 0,
        refHigh: 6,
        refRange: '0 – 6',
        sortOrder: 12,
      },
      {
        code: 'BASO',
        name: 'Basophils',
        unit: '%',
        refLow: 0,
        refHigh: 2,
        refRange: '0 – 2',
        sortOrder: 13,
      },
    ],
  },

  // ─── LIVER FUNCTION TEST (LFT) ───────────────────────────────
  {
    code: 'LFT',
    name: 'Liver Function Test',
    rate: 600,
    parameters: [
      {
        code: 'TP',
        name: 'Total Protein',
        unit: 'g/dL',
        refLow: 6.4,
        refHigh: 8.3,
        refRange: '6.4 – 8.3',
        sortOrder: 1,
      },
      {
        code: 'ALB',
        name: 'Albumin',
        unit: 'g/dL',
        refLow: 3.5,
        refHigh: 5.0,
        refRange: '3.5 – 5.0',
        sortOrder: 2,
      },
      {
        code: 'GLOB',
        name: 'Globulin',
        unit: 'g/dL',
        refLow: 2.0,
        refHigh: 3.5,
        refRange: '2.0 – 3.5',
        sortOrder: 3,
      },
      {
        code: 'TBIL',
        name: 'Total Bilirubin',
        unit: 'mg/dL',
        refLow: 0.1,
        refHigh: 1.2,
        refRange: '0.1 – 1.2',
        sortOrder: 4,
      },
      {
        code: 'DBIL',
        name: 'Direct Bilirubin',
        unit: 'mg/dL',
        refLow: 0,
        refHigh: 0.3,
        refRange: '0 – 0.3',
        sortOrder: 5,
      },
      {
        code: 'ALT',
        name: 'ALT (SGPT)',
        unit: 'U/L',
        refLow: 7,
        refHigh: 56,
        refRange: '7 – 56',
        sortOrder: 6,
      },
      {
        code: 'AST',
        name: 'AST (SGOT)',
        unit: 'U/L',
        refLow: 5,
        refHigh: 40,
        refRange: '5 – 40',
        sortOrder: 7,
      },
      {
        code: 'ALP',
        name: 'Alkaline Phosphatase',
        unit: 'U/L',
        refLow: 44,
        refHigh: 147,
        refRange: '44 – 147',
        sortOrder: 8,
      },
      {
        code: 'GGT',
        name: 'Gamma GT',
        unit: 'U/L',
        refLow: 0,
        refHigh: 55,
        refRange: '0 – 55',
        sortOrder: 9,
      },
    ],
  },

  // ─── RENAL FUNCTION TEST (RFT) ───────────────────────────────
  {
    code: 'RFT',
    name: 'Renal Function Test',
    rate: 400,
    parameters: [
      {
        code: 'BUN',
        name: 'Blood Urea Nitrogen',
        unit: 'mg/dL',
        refLow: 7,
        refHigh: 20,
        refRange: '7 – 20',
        sortOrder: 1,
      },
      {
        code: 'CREAT',
        name: 'Creatinine',
        unit: 'mg/dL',
        refLow: 0.6,
        refHigh: 1.2,
        refRange: '0.6 – 1.2',
        sortOrder: 2,
      },
      {
        code: 'URIC',
        name: 'Uric Acid',
        unit: 'mg/dL',
        refLow: 2.5,
        refHigh: 7.0,
        refRange: '2.5 – 7.0',
        sortOrder: 3,
      },
      {
        code: 'NA',
        name: 'Sodium',
        unit: 'mEq/L',
        refLow: 136,
        refHigh: 145,
        refRange: '136 – 145',
        sortOrder: 4,
      },
      {
        code: 'K',
        name: 'Potassium',
        unit: 'mEq/L',
        refLow: 3.5,
        refHigh: 5.1,
        refRange: '3.5 – 5.1',
        sortOrder: 5,
      },
      {
        code: 'CL',
        name: 'Chloride',
        unit: 'mEq/L',
        refLow: 98,
        refHigh: 106,
        refRange: '98 – 106',
        sortOrder: 6,
      },
    ],
  },

  // ─── LIPID PROFILE ───────────────────────────────────────────
  {
    code: 'LIPID',
    name: 'Lipid Profile',
    rate: 500,
    parameters: [
      {
        code: 'TC',
        name: 'Total Cholesterol',
        unit: 'mg/dL',
        refLow: 0,
        refHigh: 200,
        refRange: '< 200',
        sortOrder: 1,
      },
      {
        code: 'TG',
        name: 'Triglycerides',
        unit: 'mg/dL',
        refLow: 0,
        refHigh: 150,
        refRange: '< 150',
        sortOrder: 2,
      },
      {
        code: 'HDL',
        name: 'HDL Cholesterol',
        unit: 'mg/dL',
        refLow: 40,
        refHigh: 60,
        refRange: '40 – 60',
        sortOrder: 3,
      },
      {
        code: 'LDL',
        name: 'LDL Cholesterol',
        unit: 'mg/dL',
        refLow: 0,
        refHigh: 130,
        refRange: '< 130',
        sortOrder: 4,
      },
      {
        code: 'VLDL',
        name: 'VLDL Cholesterol',
        unit: 'mg/dL',
        refLow: 0,
        refHigh: 30,
        refRange: '< 30',
        sortOrder: 5,
      },
      {
        code: 'TC_HDL',
        name: 'TC/HDL Ratio',
        unit: '',
        refLow: 0,
        refHigh: 4.5,
        refRange: '< 4.5',
        sortOrder: 6,
      },
    ],
  },

  // ─── THYROID PROFILE ─────────────────────────────────────────
  {
    code: 'THYROID',
    name: 'Thyroid Profile',
    rate: 600,
    parameters: [
      {
        code: 'TSH',
        name: 'TSH',
        unit: 'μIU/mL',
        refLow: 0.4,
        refHigh: 4.5,
        refRange: '0.4 – 4.5',
        sortOrder: 1,
      },
      {
        code: 'T3',
        name: 'Triiodothyronine (T3)',
        unit: 'ng/dL',
        refLow: 80,
        refHigh: 200,
        refRange: '80 – 200',
        sortOrder: 2,
      },
      {
        code: 'T4',
        name: 'Thyroxine (T4)',
        unit: 'μg/dL',
        refLow: 5.0,
        refHigh: 12.0,
        refRange: '5.0 – 12.0',
        sortOrder: 3,
      },
    ],
  },

  // ─── DIABETES PROFILE ────────────────────────────────────────
  {
    code: 'DIABETES',
    name: 'Diabetes Profile',
    rate: 400,
    parameters: [
      {
        code: 'FBS',
        name: 'Fasting Blood Sugar',
        unit: 'mg/dL',
        refLow: 70,
        refHigh: 110,
        refRange: '70 – 110',
        sortOrder: 1,
      },
      {
        code: 'PPBS',
        name: 'Post Prandial Blood Sugar',
        unit: 'mg/dL',
        refLow: 0,
        refHigh: 140,
        refRange: '< 140',
        sortOrder: 2,
      },
      {
        code: 'HBA1C',
        name: 'HbA1c',
        unit: '%',
        refLow: 0,
        refHigh: 5.7,
        refRange: '< 5.7',
        sortOrder: 3,
      },
    ],
  },

  // ─── SINGLE TESTS (standalone) ──────────────────────────────
];

// Lookup helper: returns profile definition, or null if it's a single test
export function findProfile(code: string): TestProfile | undefined {
  return TEST_PROFILES.find((p) => p.code === code);
}

// Checks if a test code is a profile (has sub-parameters)
export function isProfile(code: string): boolean {
  return TEST_PROFILES.some((p) => p.code === code);
}
