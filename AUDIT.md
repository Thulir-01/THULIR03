# THULIR03 Repository Audit

Date: 2026-08-03

## Scope

Full repository audit covering project structure, build/test/lint health, dependency audit reachability, security-sensitive implementation points, and operational readiness for the NestJS API, React/Vite web app, and Python instrument middleware.

## Executive Summary

- The repository is a multi-app LIMS workspace with a NestJS/Prisma API, React/Vite web client, Python instrument middleware, Docker Compose support, and PM2 process definitions.
- Web production build passes, with a bundle-size warning for the main JavaScript chunk.
- API unit tests pass after generating the Prisma client locally with a valid `DATABASE_URL`.
- API TypeScript build fails if the Prisma client has not been generated; after generating it, the remaining build blocker is a strict type mismatch in `orders.service.ts` around `OrderTestView` numeric fields versus Prisma Decimal fields.
- API lint currently fails with a large number of type-aware ESLint errors, mostly cascading from unresolved/generated Prisma client typing and strict unsafe-access rules.
- `npm audit` could not complete for both API and web because the registry audit endpoint returned HTTP 403 in this environment.
- Security hardening exists for Helmet, production JWT secret validation, throttling, response audit redaction, and tenant filtering; however, browser token storage in `localStorage`, permissive default CORS, plaintext dev database credentials, and cleartext TOTP secret storage remain notable risks to track.

## Validation Commands Run

| Area | Command | Result | Notes |
| --- | --- | --- | --- |
| Repo instructions | `find .. -name AGENTS.md -print` | Pass | Only `apps/api/node_modules/ts-loader/AGENTS.md` was found, outside edited source scope. |
| API build, pre-generate | `npm run build:api` | Fail | Missing generated Prisma client and strict TypeScript errors. |
| Web build | `npm run build:web` | Pass with warning | Vite reported one chunk larger than 500 kB. |
| API unit tests, pre-generate | `cd apps/api && npm test -- --runInBand` | Fail | Suites importing `prisma.service.ts` could not resolve `../../generated/prisma/client`. |
| Root lint | `npm run lint` | Fail | API ESLint reported 1,430 errors and 50 warnings; web lint did not run because API lint failed first. |
| API dependency audit | `cd apps/api && npm audit --audit-level=moderate` | Blocked | npm audit endpoint returned HTTP 403 Forbidden. |
| Web dependency audit | `cd apps/web && npm audit --audit-level=moderate` | Blocked | npm audit endpoint returned HTTP 403 Forbidden. |
| Python syntax check | `python3 -m py_compile apps/instrument-middleware/main.py` | Pass | Middleware module compiles. |
| Prisma client generation | `cd apps/api && DATABASE_URL='postgresql://thulir:thulir_pass@localhost:5432/thulir_lims' npx prisma generate` | Pass | Generated ignored local Prisma client artifacts. |
| API tests, post-generate | `cd apps/api && npm test -- --runInBand` | Pass | 11 suites and 100 tests passed. |
| API build, post-generate | `npm run build:api` | Fail | Remaining blocker: `OrderTestView[]` expects `number | null`, while generated Prisma order tests use `Decimal | null` for reference ranges. |

## Findings

### 1. API build is not clean

**Severity:** High

The API build fails without generated Prisma client artifacts. This is expected for a fresh checkout unless `npx prisma generate` is run, but it means CI and developer setup must always include generation before type checking.

After generating the Prisma client, the API build still fails on `orders.service.ts` because `enrichMissingTestMeta()` receives order test rows whose `refLow` and `refHigh` values are Prisma Decimal objects, while the local `OrderTestView` interface expects `number | null`.

**Recommendation:** Update the local view/interface or normalize Decimal values at the service boundary so TypeScript build can pass without unsafe casts hiding the shape mismatch.

### 2. API tests depend on generated Prisma client

**Severity:** High

Initial Jest execution failed because multiple service specs import `prisma.service.ts`, which imports `../../generated/prisma/client`. Running Prisma generate with a `DATABASE_URL` resolved this locally, and all API unit tests then passed.

**Recommendation:** Add an explicit pretest/prebuild generation step or document/enforce it in CI before `npm run build` and `npm test`.

### 3. API lint is currently noisy and failing

**Severity:** Medium

Root lint stops in the API package and reports 1,430 errors and 50 warnings. Most reported issues are type-aware unsafe assignment/member access errors around Prisma model access and async methods with no `await`.

**Recommendation:** First fix generated-client availability for lint, then decide whether Prisma service typing should be strengthened, typed helper aliases should be introduced, or selected `@typescript-eslint` rules should be tuned for generated ORM boundaries.

### 4. Web build passes, but bundle-size warning should be watched

**Severity:** Medium

The web app builds successfully. Vite reports the generated main JavaScript asset is larger than 500 kB after minification.

**Recommendation:** Use route-level lazy loading for large page modules, split report/printing/barcode dependencies where practical, and configure chunking deliberately if the size is acceptable.

### 5. Dependency audit could not be completed in this environment

**Severity:** Medium

Both API and web `npm audit` commands failed because the npm registry audit endpoint returned HTTP 403 Forbidden.

**Recommendation:** Re-run `npm audit --audit-level=moderate` in CI or a network environment with registry audit access. Treat the README's zero-vulnerability claim as unverified by this audit run.

### 6. Security posture has useful hardening but some residual risks

**Severity:** Medium

Observed positives:

- API startup rejects weak/default JWT secrets in production.
- Helmet is enabled for security headers.
- Global validation uses whitelist and forbid-non-whitelisted behavior.
- Throttler is configured as a global guard.
- Audit payload redaction skips password, secret, and token-like keys.
- Prisma tenant filtering has dedicated tests.

Residual risks to track:

- CORS defaults to `*` when `CORS_ORIGIN` is unset, while credentials are enabled.
- Access and refresh tokens are stored in browser `localStorage`, increasing impact of any XSS issue.
- TOTP secrets appear to be stored in the database as cleartext application strings.
- Development Docker Compose contains predictable database credentials and a development JWT secret; acceptable for local use only, but should never be promoted as production defaults.

### 7. Middleware is skeletal

**Severity:** Low

The Python instrument middleware compiles, but still contains a TODO to parse and forward ASTM/HL7 payloads to the core API or queueing layer.

**Recommendation:** Add protocol parsing tests and an integration contract before wiring the middleware into production workflows.

## Suggested Next Actions

1. Fix the `OrderTestView` / Prisma Decimal mismatch so `npm run build:api` passes after Prisma generation.
2. Add `prisma generate` to the API prebuild/pretest flow or root CI pipeline.
3. Re-run API lint after generated-client setup and reduce unsafe Prisma boundary errors.
4. Re-run dependency audit where npm audit endpoint access is allowed.
5. Consider replacing `localStorage` token persistence with hardened cookie/session storage or a documented XSS mitigation strategy.
6. Add web code splitting for large route modules if bundle growth continues.
