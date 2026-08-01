# THULIR03 — Laboratory Information Management System

A modern, production-grade **Laboratory Information Management System (LIMS)** for Indian diagnostic pathology labs. Designed to scale from a single lab to a multi-branch franchise network, with NABL/ISO 15189 accreditation readiness, ABDM integration, and DPDP Act 2023 compliance.

## Architecture

```
thulir03-lims/
├── apps/
│   ├── api/                    # NestJS REST API (TypeScript)
│   │   ├── prisma/             # Database schema & migrations
│   │   └── src/
│   │       ├── auth/           # JWT auth, register, login, TOTP MFA
│   │       ├── users/          # User management
│   │       ├── roles/          # RBAC role & permission management
│   │       ├── patients/       # Patient CRUD + search
│   │       ├── referrers/      # Doctor/referrer CRUD (migrated to parties)
│   │       ├── parties/        # Unified master-data parties (doctors, hospitals, corporates, insurers, labs, consultants)
│   │       ├── orders/         # Order registration, list/search, test results, verify → approve → report workflow
│   │       │   └── test-profiles.ts  # Profile defs (CBC, LFT, RFT, Lipid, Thyroid, Diabetes)
│   │       ├── masters/        # Test parameters, packages, referrer pricing, generic lookup masters
│   │       ├── users/          # User management + staff NABL sign-off details (registration no, signature)
│   │       ├── audit-logs/     # Audit trail viewer
│   │       ├── dashboard/      # Live stats + recent orders
│   │       ├── common/         # Guards (JwtAuth, Roles), interceptors, decorators
│   │       │   └── interceptors/     # TenantInterceptor + AuditInterceptor (global)
│   │       ├── prisma/         # Prisma service + tenant-filter extension
│   │       ├── main.ts         # Entry point
│   │       └── app.module.ts   # Root module
│   ├── web/                    # React + Vite + Tailwind CSS
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── LandingPage.tsx          # Public landing page
│   │       │   ├── Login.tsx                # Sign-in page
│   │       │   ├── Register.tsx             # Sign-up with org setup
│   │       │   ├── Dashboard.tsx            # Lab dashboard (live stats + recent orders)
│   │       │   ├── PatientRegistrationPage.tsx  # Full-screen registration (patient+tests+billing)
│   │       │   ├── PatientFormPage.tsx      # Patient create/edit
│   │       │   ├── PatientsPage.tsx         # Patient list + search
│   │       │   ├── ReferrerFormPage.tsx     # Referrer create/edit
│   │       │   ├── ReferrersPage.tsx        # Referrer list
│   │       │   ├── OrdersPage.tsx           # Orders list with search & expand + report link
│   │       │   ├── TestResultPage.tsx       # Result entry with flags (↑/↓) & profiles + verify button
│   │       │   ├── VerifyPage.tsx           # Technician verify queue (/verify)
│   │       │   ├── ApprovalsPage.tsx        # Pathologist approval queue (/approvals)
│   │       │   ├── ReportPage.tsx           # Printable clinical report + Print/Save-as-PDF (/orders/:id/report)
│   │       │   ├── MastersPage.tsx          # Masters one-panel tabs (parameters, packages, referrers, lookups)
│   │       │   ├── MastersParametersPage.tsx / MastersPackagesPage.tsx / LookupMasterPage.tsx
│   │       │   ├── ReferrerPricingPage.tsx  # Per-referrer rate cards
│   │       │   ├── StaffPage.tsx            # Staff NABL sign-off details
│   │       │   └── AuditLogsPage.tsx        # Audit trail viewer
│   │       ├── components/
│   │       │   └── ProtectedRoute.tsx       # Auth guard wrapper
│   │       ├── lib/
│   │       │   ├── api-client.ts   # Axios client with JWT + API functions
│   │       │   ├── auth.tsx        # AuthContext provider
│   │       │   └── utils.ts        # Tailwind class merging
│   │       ├── App.tsx             # Router + routes
│   │       ├── main.tsx            # Entry with BrowserRouter
│   │       └── index.css           # Tailwind v4 + clinical theme
│   └── instrument-middleware/  # Python FastAPI (ASTM/HL7)
│       ├── main.py             # FastAPI entry point
│       └── requirements.txt    # Python dependencies
├── docker/
│   ├── docker-compose.yml      # Development environment (db-migrate auto-runs Prisma migrations)
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── Dockerfile.middleware
├── .github/
│   ├── workflows/
│   │   └── ci.yml              # GitHub Actions CI/CD (lint, typecheck, migrate deploy, schema-drift check, tests)
│   └── dependabot.yml          # Auto-security updates
├── ecosystem.config.js         # PM2 config (API + Web)
└── .env.example                # Environment variables template
```

## Tech Stack

| Layer              | Technology                                                  |
|--------------------|-------------------------------------------------------------|
| Frontend           | React 19 + TypeScript + Vite 8 + Tailwind CSS 4             |
| Core API           | NestJS 11 (TypeScript), REST + OpenAPI 3 + Swagger          |
| Database           | PostgreSQL 16+ with Prisma ORM 7 + app-layer tenant isolation |
| Auth               | JWT + refresh tokens, Passport, bcryptjs, TOTP MFA          |
| Cache/Queue        | Redis + BullMQ (planned)                                    |
| Object Storage     | S3-compatible (MinIO for dev)                               |
| Instrument Middle  | Python FastAPI + hl7apy (ASTM E1394 / HL7 v2.x)             |
| Process Manager    | PM2 (auto-restart for API + Web)                            |
| Deployment         | Docker Compose → Kubernetes-ready, GitHub Actions CI/CD     |

## Quick Start (Development)

### Prerequisites
- Node.js 22+
- Python 3.10+
- Docker & Docker Compose (for database services)

### 1. Start infrastructure
```bash
docker compose -f docker/docker-compose.yml up -d postgres redis minio
# The db-migrate service applies Prisma migrations automatically once Postgres is healthy.
# The API service waits for db-migrate to complete successfully before starting.
```

### 2. Set up the API
```bash
cd apps/api
npm ci
npx prisma generate
npx prisma migrate deploy   # or rely on the compose db-migrate service
npm run start:dev
```
API runs at **http://localhost:3001** — Swagger docs at **http://localhost:3001/api/docs**

### 3. Start the web app
```bash
cd apps/web
npm ci
npm run dev
```
Web app runs at **http://localhost:5173** (proxies `/api` to the API server)

### 4. (Optional) Run both with PM2
```bash
npm install -g pm2
pm2 start ecosystem.config.js   # starts thulir03-api + thulir03-web
pm2 save                        # persist process list
```

### 5. (Optional) Start instrument middleware
```bash
cd apps/instrument-middleware
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
Middleware runs at **http://localhost:8000**

## Auth Setup & Default Flow

Sprint 2 implements JWT-based authentication with role-based access control (RBAC).

### Registration (first-time setup)
The first user registered becomes a **Lab Admin** with full system access.
System roles are auto-created: `lab_admin`, `pathologist`, `technician`, `lab_manager`, `receptionist`.

### Auth API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/register` | Register new user + org |
| `POST` | `/api/v1/auth/login` | Login with email + password |
| `POST` | `/api/v1/auth/refresh` | Refresh expired JWT |
| `GET` | `/api/v1/auth/profile` | Get current user profile |
| `POST` | `/api/v1/auth/totp/generate` | Generate TOTP secret |
| `POST` | `/api/v1/auth/totp/enable` | Enable TOTP MFA |

### Clinical API Endpoints (Sprint 3 + 4)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/patients` | List patients (searchable) |
| `POST` | `/api/v1/patients` | Create patient |
| `GET` | `/api/v1/patients/:id` | Get patient |
| `PATCH` | `/api/v1/patients/:id` | Update patient |
| `GET` | `/api/v1/referrers` | List referrers |
| `POST` | `/api/v1/referrers` | Create referrer |
| `POST` | `/api/v1/orders/register` | Register order — patient + tests + billing in 1 transaction (profiles auto-expand) |
| `GET` | `/api/v1/orders` | List orders (search by order#, patient name, phone) |
| `GET` | `/api/v1/orders/:id` | Get order detail with all test parameters |
| `PATCH` | `/api/v1/orders/:orderId/tests/:testId` | Save test result (auto-completes parent profile + order) |
| `POST` | `/api/v1/orders/:id/verify` | **Technician verify** — only from `completed`; moves order to `verified` |
| `POST` | `/api/v1/orders/:id/approve` | **Pathologist approve** — stamps NABL e-signature on every test; unlocks report |
| `GET` | `/api/v1/orders/:id/report` | Clinical report data (patient, results, verified/approved signatories) — only after approval |
| `GET` | `/api/v1/users/staff` | List users with staff sign-off details |
| `GET/PUT/DELETE` | `/api/v1/users/:id/staff-detail` | Get / upsert / remove staff details (reg no, qualification, signature) |
| `GET/POST/PATCH/DELETE` | `/api/v1/masters/parameters` | Test parameter catalog CRUD |
| `GET/POST/PATCH/DELETE` | `/api/v1/masters/packages` | Test package CRUD |
| `GET/PUT/DELETE` | `/api/v1/masters/referrers/:referrerId/prices` | Per-referrer rate cards |
| `GET/POST/PATCH/DELETE` | `/api/v1/masters/lookup/:type` | Generic lookup masters (sample_type, container, unit, method, payment_mode, rejection_reason, discount_scheme, tax_rate) |

### Frontend Routes

| Path | Page | Auth Required |
|------|------|---------------|
| `/` | Landing page | No |
| `/login` | Sign-in form | No |
| `/register` | Registration form | No |
| `/dashboard` | Lab admin dashboard (live stats + recent orders) | Yes (JWT required) |
| `/registration` | Patient registration — search, tests, billing | Yes |
| `/patients` | Patient list | Yes |
| `/orders` | Orders list | Yes |
| `/results` | Test result entry with flags | Yes |
| `/verify` | Technician verify queue | Yes |
| `/approvals` | Pathologist approval queue | Yes (pathologist/admin/manager) |
| `/orders/:orderId/report` | Printable clinical report + Print/Save-as-PDF | Yes |
| `/referrers` | Referrer list | Yes |
| `/masters` | Masters panel (parameters, packages, referrers, lookups) | Yes (admin/manager/pathologist) |
| `/staff` | Staff NABL sign-off details | Yes (admin/manager) |
| `/audit` | Audit trail viewer | Yes |

### Protected Routes
Frontend uses `ProtectedRoute` component — unauthenticated users are redirected to `/login` with their intended destination preserved.

## Feature Highlights

### Test Profiles (Sprint 4)
Profiles auto-expand into individual parameters on registration:
- **CBC** (13 params): HB, RBC, PCV, MCV, MCH, MCHC, WBC, PLT, NEUT, LYMPH, MONO, EOS, BASO
- **LFT** (9), **RFT** (6), **Lipid** (6), **Thyroid** (3), **Diabetes** (3)
- Each parameter carries unit + reference range (refLow/refHigh)

### Flag Arrows in Result Entry
- Result **above** refHigh → 🔺 HIGH flag (↑)
- Result **below** refLow → 🔻 LOW flag (↓)
- In range → no flag
- Parent profile auto-completes when all children are saved; order auto-completes when all tests are done

### Tenant Isolation (Sprint 4.5)
- A **Prisma client extension** (`tenant-filter.extension.ts`) auto-injects the authenticated organization's id (`tenantId`) into **every** query on tenant-scoped models (`Patient`, `DoctorReferrer`, `Order`, `AuditLog`) — reads are scoped, writes are forced to the context org, and a caller-supplied `tenantId` is always overridden, so isolation cannot be bypassed by a service bug.
- The per-request context comes from `TenantInterceptor` (global), which wraps each authenticated request in an `AsyncLocalStorage` scope.

### Full Audit Trail (Sprint 4.5)
- `AuditLogInterceptor` (global) writes an `audit_logs` row for every `POST`/`PATCH`/`PUT`/`DELETE` on clinical endpoints: actor, action, entity, entity id, sanitized response payload, IP + user agent.
- Audit writes are fire-and-forget — a failed audit never fails the business request.

### Masters Catalog (Sprint 5.7 – 5.9)
- **Test parameters** — one master record per lab test: category, unit, reference range (low/high), TAT, methodology, default price, auto-code generation (`HEM-001`) via `MastersSequence`.
- **Test packages** — named bundles with price (fixed or sum-of-parts), auto-code (`PKG-004`).
- **Referrer pricing** — per-referrer rate cards (referrer X pays ₹250 for CBC, walk-in pays ₹400).
- **Generic lookup masters** — one tenant-scoped table, 8 types (sample_type, container_type, unit, method, payment_mode, rejection_reason, discount_scheme, tax_rate) with metadata JSONB, soft delete, auto-code per type (`CT-001`), one config-driven UI tab per type.
- **Quick enable/disable** — one-click row toggle + bulk status endpoint.

### Staff NABL Sign-off Details (Sprint 6.1)
- `StaffDetail` — 1:1 extension of `User`: registration no, qualification, designation, signature image URL — tenant-scoped, ready to stamp verified reports.

### Verify → Approve → Report Workflow (Sprint 6.2)
- **State machine enforced server-side**: `pending → completed → verified → approved`.
  - Result entry auto-completes tests → order `completed`.
  - **Technician** verifies (`/verify` queue) — only from `completed`.
  - **Pathologist** approves (`/approvals` queue) — stamps the NABL e-signature hash on every test, sets `finalReportDate`, unlocks the report.
  - Report endpoint refuses anything not `approved` (409). Re-verify / re-approve blocked (409).
- **Printable clinical report** (`/orders/:id/report`) — letterhead, patient/order meta, flagged results table (H/L markers), dual signature block, browser **Print / Save-as-PDF**.

## Development Commands

```bash
# Root monorepo commands
npm run dev:api      # Start API dev server
npm run dev:web      # Start web dev server
npm run build        # Build all apps
npm run test         # Run all tests
npm run lint         # Lint all apps

# Docker
npm run docker:up    # Start all containers (db-migrate applies migrations first)
npm run docker:down  # Stop all containers
```

## Environment Variables

Key environment variables (see `.env.example` for full list):

| Variable          | Description                    | Default                          |
|-------------------|--------------------------------|----------------------------------|
| `DATABASE_URL`    | PostgreSQL connection string   | `postgresql://thulir:thulir_pass@localhost:5432/thulir_lims` |
| `REDIS_URL`       | Redis connection URL           | `redis://localhost:6379`         |
| `JWT_SECRET`      | JWT signing secret             | *(change in production)*         |
| `API_PORT`        | NestJS server port             | `3001`                           |
| `VITE_API_URL`    | Web app API proxy target       | `http://localhost:3001`          |

## Build Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **Sprint 1** | Project scaffolding, monorepo, Docker, CI/CD | ✅ Complete |
| **Sprint 2** | **Auth & RBAC** — JWT auth, TOTP MFA, role management, login/signup UI | ✅ **Complete** |
| **Sprint 3** | **Patients, Referrers & Orders** — CRUD, registration flow (patient+tests+billing), patient search, orders list, dashboard live stats | ✅ **Complete** |
| **Sprint 4** | **Test Results Entry** — profile sub-parameters, reference ranges, flag arrows (↑/↓), auto-complete | ✅ **Complete** |
| **Sprint 4.5** | **Foundation Hardening** — Prisma tenant-isolation extension (auto-injects org id on every query), full audit trail (audit_logs on all writes), auth/TOTP + tenant-isolation tests, CI schema-drift check, compose auto-migrate | ✅ **Complete** |
| **Sprint 5** | **Perf & Consistency** — registration wrapped in `$transaction` (no orphan patients), UUID-derived order numbers (no collisions), tenant_id indexes on patients/orders/referrers, bcrypt cost 10, dashboard COUNT endpoint | ✅ **Complete** |
| **Sprint 5.1** | **Audit Fixes** — hot-reload dev script, unified web API client (silent token refresh), helmet headers, rate limiting (5/min login), JWT access/refresh type separation, pagination, user org index, dependency-vuln cleanup | ✅ **Complete** |
| **Sprint 5.2** | **Go-live hardening** — zero dependency vulnerabilities, NABL signature fields reserved, JWT secret startup guard | ✅ **Complete** |
| **Sprint 5.5** | **Result edit-lock + audit fixes** — verified results immutable, before-capture audit, registration transaction | ✅ **Complete** |
| **Sprint 5.6** | **Sample entity + batched registration** — OrderTest tenant scoping + backfill, collision-safe batch registration | ✅ **Complete** |
| **Sprint 5.7** | **Masters catalog + parties foundation** — test parameters/packages/referrer pricing, referrers migrated into unified parties | ✅ **Complete** |
| **Sprint 5.8–5.9** | **Masters codegen + lookup system** — auto-code generation, quick enable/disable, ref-range snapshot into orders, Referrers tab, generic LookupMaster (8 types) | ✅ **Complete** |
| **Sprint 6.1** | **StaffDetail** — NABL sign-off details (registration no, qualification, signature) for report verification | ✅ **Complete** |
| **Sprint 6.2** | **Verify → Approve → Report workflow** — technician verify queue, pathologist approval queue, printable clinical report (Print/Save-as-PDF) | ✅ **Complete** |
| **Sprint 7** | Invoice / Receipt print — API `getInvoiceData`, printable Tax Invoice vs Payment Receipt page, per-parameter rates, billing summary | ✅ **Complete** |
| **Sprint 8** | Reports & Analytics — revenue (billed/collected/outstanding), 14-day daily series chart, top test volumes, referrer payouts | ✅ **Complete** |
| **Sprint 9** | **Phase 1 UI/Hardening pass** — shared UI kit (`PageHeader`, `PageStates` Loading/Empty/Error+retry, `StatCard`), removed duplicate per-page top bars, semantic-token sweep across all screens, error handling + retry everywhere | ✅ **Complete** |
| **Sprint 10** | Referrer-wise rate cards + party detail screens (hospitals, corporates, insurers, labs, consultants) | ⬜ Next |
| **Sprint 11+** | Instrument middleware, QC, inventory, portals, compliance, launch | ⬜ |

Full 24-sprint build plan available in the project brief.

## Go-Live Readiness (medical multi-tenant checklist)

- **Encryption at rest** — confirm the production Postgres host (disk/volume) has encryption enabled; dev Docker volumes don't need it, prod does.
- **Encryption in transit** — production `DATABASE_URL` must use `sslmode=require` (the dev/pooled URL is plaintext by design). Browser↔API should be HTTPS.
- **DPDP Act 2023 (India)** — consent-capture + data-retention/erasure design decided before go-live. The schema keeps soft-delete (`deletedAt`) and audit rows, which support erasure requests with documented medical-record retention exceptions.
- **Audit trail** — wired (Sprint 4.5): every clinical/financial write produces an `audit_logs` row via a global interceptor. New modules inherit it automatically.
- **Backups** — automated, encrypted, with a tested restore process. Suggested retention: 30 daily + 12 monthly.
- **Secrets** — the API refuses to boot in `NODE_ENV=production` with a weak/default `JWT_SECRET` (see `main.ts` `assertSecureStartup`). Generate with `openssl rand -hex 32`.
- **NABL readiness** — result e-signature fields (`verifiedBy`, `verifiedAt`, `signatureHash`) are reserved on `order_tests`, and the **verify → approve → report workflow is live** (Sprint 6.2): technicians verify, pathologists approve with the NABL e-signature stamp, staff registration numbers + signatures feed the printable report. Critical-value alerting is future work.
- **RLS note** — tenant isolation is enforced at the app layer by the Prisma tenant-filter extension (tested by the e2e suite). Postgres RLS is deliberately not enabled: Prisma 7 has no native RLS support and the pooled Supabase connection makes per-request `SET LOCAL` unreliable. Revisit when Prisma ships native RLS.
- **Redis** — `docker-compose` provisions Redis for future background jobs (report generation, critical-value alerts); nothing consumes it yet, and rate limiting is in-memory via `@nestjs/throttler`.

## Design Principles

- **State machine integrity** — All sample/result transitions enforced server-side
- **Immutable records** — Verified results cannot be edited; amendments create linked records
- **Configuration-first** — Test catalogs, workflows, roles, pricing configurable from UI, no deploys
- **Multi-tenant by default** — App-layer tenant isolation enforced by a Prisma client extension that auto-injects the authenticated organization's id (`tenantId`) into every query, so services cannot accidentally read or write another tenant's data. Postgres Row-Level Security is deliberately **not** enabled (Prisma 7 has no native RLS support) and is reserved for a future hardening pass
- **Full audit trail** — Every write to clinical/financial data creates an audit log entry
- **Clinical UX** — Colour reserved for clinical meaning only; progressive disclosure; role-specific dashboards

## License

Proprietary — see LICENSE file for details.
