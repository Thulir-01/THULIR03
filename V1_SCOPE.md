# THULIR03 — V1 Scope (Small & Medium Lab, Manual / Semi-Auto First)

> **Strategy:** Launch V1 for **small labs → medium labs → big labs (later)**.
> V1 is built for labs using **manual & semi-automated analyzers** where results are
> **keyed in by hand**. Machine/system integration (HL7, LIS/EHR, middleware) is an
> **enterprise feature — explicitly OUT of V1**.
>
> Status legend: ✅ = already real & working · 🔧 = exists, needs polish ·
> 🆕 = new for V1 · 🚫 = out of V1 (enterprise, later)

---

## 0. Positioning & Principles

1. **Manual-first**: every workflow must work great with keyboard entry — no machine dependency.
2. **QC ≠ integration**: NABL mandates QC for every lab, even semi-auto. QC stays in V1 but as
   **manual control entry** (type control values → Westgard flags), never instrument-fetched.
3. **Speed over automation**: small labs win on *fast registration, fast result entry, fast report*.
4. **Honest UI**: no fake "integration" features. Enterprise options are muted or labeled "coming soon".
5. **Audit-ready**: every significant action lands in the Audit Trail (NABL trust).

---

## 1. Core Lab Workflow (P0 — mostly exists, polish for speed)

| # | Capability | Status | V1 detail |
|---|---|---|---|
| 1.1 | Walk-in patient registration | ✅ | Quick duplicate search + minimal fields. Polish: registration under 30s |
| 1.2 | Test masters (parameters, packages/profiles) | ✅ | Unit, ref range, sample type, TAT per test |
| 1.3 | Order creation + billing at registration | ✅ | Profiles expand to child tests; invoice/receipt printed at counter |
| 1.4 | Sample collection + barcode label | ✅ | Sample model exists (1 tube → many tests). 🔧 print-ready barcode label |
| 1.5 | **Manual result entry** | ✅ | Grid entry with auto H/L flags from ref ranges. 🔧 keyboard-first speed pass (arrow nav, auto-advance, Enter-to-save) |
| 1.6 | Critical value alert on entry | ✅ | Non-dismissible modal + mandatory comment before sign-off. Verify wired on every abnormal result |
| 1.7 | Technician verification queue | ✅ | 2-person sign-off chain (tech verify → pathologist sign) |
| 1.8 | Pathologist review & sign-off | ✅ | Review view + critical-value gate + audit trail |
| 1.9 | Report print (A4, lab header) | ✅ | 🔧 polish: clean NABL-style header, footers, page breaks |

## 2. Billing & Money (P0 — exists, polish)

| # | Capability | Status | V1 detail |
|---|---|---|---|
| 2.1 | Billing at registration + receipt | ✅ | Amount, discount, paid/cash-credit |
| 2.2 | Referrer pricing / commission | ✅ | Party pricing per test |
| 2.3 | Outstanding (credit) tracking | ✅ | Reports show total outstanding |
| 2.4 | Invoice/receipt print | ✅ | 🔧 polish GST-compatible format + "balance due" line |

## 3. Patient-Facing Report Delivery (P1 — NEW, killer feature for small labs)

| # | Capability | Status | V1 detail |
|---|---|---|---|
| 3.1 | **Report delivery via WhatsApp** | 🆕 | Generate PDF report + **wa.me share link** (no API needed) + QR-verify portal link |
| 3.2 | Verify-report portal (QR) | ✅ | Patient scans → authenticates report. Tie into 3.1 |
| 3.3 | SMS "report ready" (optional) | 🆕 P2 | Needs SMS provider — defer unless a lab asks |

## 4. Inventory (P1 — exists, extend)

| # | Capability | Status | V1 detail |
|---|---|---|---|
| 4.1 | Items, suppliers, transactions | ✅ | Stock in/out, batch, expiry |
| 4.2 | Low-stock + expiry alerts → Alerts Center | ✅ | Real feed already wired |
| 4.3 | Reagent auto-deduct per test | 🔧 optional | V1.1 — only if a pilot lab wants it |

## 5. QC — Manual First (P1 — NEW, replaces demo)

| # | Capability | Status | V1 detail |
|---|---|---|---|
| 5.1 | Control material + levels masters | 🆕 | Per test: normal/abnormal control, assigned mean/SD |
| 5.2 | **Manual QC entry** | 🆕 | Technician types daily control values (semi-auto friendly) |
| 5.3 | Westgard evaluation engine | 🆕 | 1:2s, 1:3s, 2:2s, R:4s, 4:1s, 10x → pass/warn/reject |
| 5.4 | Levey-Jennings charts (real data) | 🆕 | Reuse existing SVG plot; now fed by real QC runs |
| 5.5 | QC failure → real alert + audit | 🆕 | Reuse alerts-store + audit module (closed loop) |
| 5.6 | Settings rule config → real API | 🆕 | Move Westgard rule toggles from localStorage to backend |

## 6. Masters & Configuration (NEW — unified LIMS master hub)

| # | Capability | Status | V1 detail |
|---|---|---|---|
| 6.1 | **Hospital / Clinic master** | 🆕 | Name, code, address lookup, contact matrix, PAN, report branding (header/footer images, margins), Options flags (inactive, upload results, no SMS/email, outsource, WhatsApp report…), Settings (auto-invoice + period, preferred doctor, collection boy, report display mode), billing (credit/cash, days, limit, web password delivery) |
| 6.2 | **Sample Type master** | 🆕 | Collection method, container type/color, storage, shelf life, pre-analytical reqs, options (requires requisition, auto-ID, reject on hemolysis, composite) |
| 6.3 | **Method master** | 🆕 | Standard body (ASTM/ISO/EPA/APHA), category, reference doc, version control, default parameter set, safety precautions |
| 6.4 | **Instrument master** | 🆕 | Name, model, asset tag, location/status, assigned staff, calibration frequency/due dates, requires-QC, downtime warning |
| 6.5 | **Client / Lab master (B2B)** | 🆕 | Contact, billing/shipping address, GST/PAN, payment terms, currency, outsource partner, credit, commission, custom branding, invoice template |
| 6.6 | **Parameter master extension** | 🆕 | Acceptance criteria (limits + limit type), critical-value alert, auto-approve, requires approval, visible on report, calculation formula |

> All masters share one UI pattern: **Left = who/what they are (data entry) · Right = how the system treats them (options/settings/billing)**. Global search, active/inactive filter, auto code generation, referential-integrity delete checks, and audit trail per record.

## 7. Admin & Compliance (P2 — exists)

| # | Capability | Status | V1 detail |
|---|---|---|---|
| 7.1 | Staff / users / roles / RBAC | ✅ | Pathologist, Tech, Manager, Viewer |
| 7.2 | Audit log viewer | ✅ | Search, filters, before/after, export |
| 7.3 | Lab settings (name, address, reg bodies) | ✅ | Real `/settings/lab` |
| 7.4 | **Integrations tab** | 🔧 | **Mute to "Enterprise · Coming soon"** — no fake API keys UI |
| 7.5 | System settings / user management | ✅ | MFA status, deactivate, permission matrix |

## 8. Dashboards & Analytics (P2 — exists, extend)

| # | Capability | Status | V1 detail |
|---|---|---|---|
| 8.1 | Command-center dashboard | ✅ | Health gauge, pending reviews, alerts |
| 8.2 | Daily revenue / outstanding | ✅ | 🔧 extend: TAT by department, pending by status |

---

## 🚫 Explicitly OUT of V1 (enterprise — revisit for big labs)

- HL7 / FHIR / LIS / EHR integrations
- Instrument middleware (Python app stays dormant)
- API keys for third-party integrations
- Instrument onboarding / analyzer mapping
- Barcode **hardware** scanners (simulated scan can stay hidden behind "Advanced")
- Multi-branch consolidation
- Payment gateway (only if a pilot lab demands it)
- Native mobile app (PWA-first; tablet flows already exist)

---

## ✅ V1 Launch Checklist (Definition of Done)

The following happy path must work end-to-end with **real data**:

1. Walk-in → register patient (< 30s) → order tests → billing at counter → receipt
2. Sample collected → barcode label printed → tube linked to order
3. Technician enters results by hand → H/L flags auto-appear → critical value triggers
   **non-dismissible alert** with mandatory comment
4. Critical value + QC violations raise **real alerts** in Alerts Center
5. Technician verifies → Pathologist reviews & signs off (2-person rule) → audit logged
6. Report generated → printed OR **sent via WhatsApp** with QR verify link
7. Inventory expiry/low-stock → alert → reorder tracked
8. Daily dashboard shows pending, TAT, revenue, outstanding honestly

---

## 📦 Recommended Build Order

| Phase | Focus | Effort |
|---|---|---|
| **P0** | UI realignment (Integrations muted, manual-first language, Dashboard "Manual QC Entry" action) + result-entry speed pass + critical-value wiring check | Small |
| **P1a** | **Manual QC module** (schema + API + entry + L-J charts + alerts + audit) | Large |
| **P1b** | **Report delivery** (PDF + WhatsApp share + QR portal tie-in) | Medium |
| **P2** | Analytics extensions, inventory auto-deduct (optional), billing polish | Medium |
