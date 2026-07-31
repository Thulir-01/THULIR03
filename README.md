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
│   │       ├── referrers/      # Doctor/referrer CRUD
│   │       ├── orders/         # Order registration, list/search, test results
│   │       │   └── test-profiles.ts  # Profile defs (CBC, LFT, RFT, Lipid, Thyroid, Diabetes)
│   │       ├── common/         # Guards (JwtAuth, Roles), decorators
│   │       ├── prisma/         # Prisma database service
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
│   │       │   ├── OrdersPage.tsx           # Orders list with search & expand
│   │       │   └── TestResultPage.tsx       # Result entry with flags (↑/↓) & profiles
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
│   ├── docker-compose.yml      # Development environment
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── Dockerfile.middleware
├── .github/
│   ├── workflows/
│   │   └── ci.yml              # GitHub Actions CI/CD
│   └── dependabot.yml          # Auto-security updates
├── ecosystem.config.js         # PM2 config (API + Web)
└── .env.example                # Environment variables template
```

## Tech Stack

| Layer              | Technology                                                  |
|--------------------|-------------------------------------------------------------|
| Frontend           | React 19 + TypeScript + Vite 8 + Tailwind CSS 4             |
| Core API           | NestJS 11 (TypeScript), REST + OpenAPI 3 + Swagger          |
| Database           | PostgreSQL 16+ with Prisma ORM 7 + Row-Level Security       |
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
```

### 2. Set up the API
```bash
cd apps/api
npm ci
npx prisma generate
npx prisma db push
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
| `/referrers` | Referrer list | Yes |

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

## Development Commands

```bash
# Root monorepo commands
npm run dev:api      # Start API dev server
npm run dev:web      # Start web dev server
npm run build        # Build all apps
npm run test         # Run all tests
npm run lint         # Lint all apps

# Docker
npm run docker:up    # Start all containers
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
| **Sprint 5** | Invoice / Receipt print | ⬜ Next |
| **Sprint 6** | PDF Report Generation | ⬜ |
| **Sprint 7** | Reports & Analytics | ⬜ |
| **Sprint 8** | Configurable Test Catalog from UI | ⬜ |
| **Sprint 9** | Phase 1 UI/Hardening Pass | ⬜ |
| **Sprint 10+** | Instrument middleware, QC, inventory, portals, compliance, launch | ⬜ |

Full 24-sprint build plan available in the project brief.

## Design Principles

- **State machine integrity** — All sample/result transitions enforced server-side
- **Immutable records** — Verified results cannot be edited; amendments create linked records
- **Configuration-first** — Test catalogs, workflows, roles, pricing configurable from UI, no deploys
- **Multi-tenant by default** — Pooled database + Postgres Row-Level Security
- **Full audit trail** — Every write to clinical/financial data creates an audit log entry
- **Clinical UX** — Colour reserved for clinical meaning only; progressive disclosure; role-specific dashboards

## License

Proprietary — see LICENSE file for details.
