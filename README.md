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
│   │       ├── common/         # Guards (JwtAuth, Roles), decorators
│   │       ├── prisma/         # Prisma database service
│   │       ├── main.ts         # Entry point
│   │       └── app.module.ts   # Root module
│   ├── web/                    # React + Vite + Tailwind CSS
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── Login.tsx       # Sign-in page
│   │       │   ├── Register.tsx    # Sign-up with org setup
│   │       │   └── Dashboard.tsx   # Lab admin dashboard
│   │       ├── components/
│   │       │   └── ProtectedRoute.tsx  # Auth guard wrapper
│   │       ├── lib/
│   │       │   ├── api.ts       # Axios client with JWT + auto-refresh
│   │       │   ├── auth.tsx     # AuthContext provider
│   │       │   ├── useAuth.ts   # useAuth hook
│   │       │   └── utils.ts     # Tailwind class merging
│   │       ├── App.tsx          # Router + routes
│   │       ├── main.tsx         # Entry with BrowserRouter
│   │       └── index.css        # Tailwind v4 + clinical theme
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

### 4. (Optional) Start instrument middleware
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

### Frontend Routes

| Path | Page | Auth Required |
|------|------|---------------|
| `/` | Landing page | No |
| `/login` | Sign-in form | No |
| `/register` | Registration form | No |
| `/dashboard` | Lab admin dashboard | Yes (JWT required) |

### Protected Routes
Frontend uses `ProtectedRoute` component — unauthenticated users are redirected to `/login` with their intended destination preserved.

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
| **Sprint 3** | Patients & Referrers CRUD | ⬜ Next |
| **Sprint 4** | Configurable Test Catalog | ⬜ |
| **Sprint 5** | Orders & Barcode Accessioning | ⬜ |
| **Sprint 6** | Result Entry & Verification | ⬜ |
| **Sprint 7** | PDF Report Generation | ⬜ |
| **Sprint 8** | Basic Billing | ⬜ |
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
