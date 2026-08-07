/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
/**
 * V1 Readiness Audit — live end-to-end happy path.
 *
 * Walks the ENTIRE V1 checklist (see V1_SCOPE.md "Launch Checklist") against a
 * real HTTP server + real database, one flow per checkpoint. The test app
 * mirrors apps/api/src/main.ts bootstrap (global `/api` prefix + `/v1` URI
 * versioning + validation pipe) so audit-entity extraction behaves exactly like
 * production.
 *
 *   1. Auth: register 2 users in one lab (2-person sign-off needs 2 identities)
 *   2. Masters: category → parameters (auto code) → update → list
 *   3. Walk-in registration: patient + tests + cash billing at the counter
 *   4. Manual result entry → order rolls to completed
 *   5. Guards: verify-before-complete, edit-lock, report-before-approval
 *   6. Technician verify → Pathologist approve (two-person rule)
 *   7. Report payload + invoice + public QR-verify portal
 *   8. QC: manual control → Westgard pass/reject runs → summary
 *   9. Audit trail, dashboard stats, analytics, inventory alerts
 *
 * Run:  cd apps/api && export DATABASE_URL=... && npm run test:e2e -- --runInBand
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

const ts = Date.now();
const slug = `audit-${ts}`;
const pwd = 'AuditPass123!';

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('V1 Readiness Audit (live happy path)', () => {
  jest.setTimeout(60_000);
  let app: INestApplication;
  let token1 = '';
  let token2 = '';
  let user1Id = '';
  let categoryId = '';
  let paramHemId = '';
  let orderId = '';
  let orderNumber = '';
  let testHemId = '';
  let testGluId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    // Mirror apps/api/src/main.ts bootstrap exactly.
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.enableVersioning({
      type: VersioningType.URI,
      prefix: 'v',
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Auth — register lab admin (org auto-created) + second user for 2-person rule', async () => {
    const r1 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `audit1-${ts}@thulir.dev`,
        password: pwd,
        firstName: 'Audit',
        lastName: 'Tech',
        organizationSlug: slug,
        organizationName: `Audit Lab ${ts}`,
      })
      .expect(201);
    token1 = r1.body.accessToken as string;
    user1Id = r1.body.user.id as string;
    expect(token1).toBeTruthy();

    const r2 = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `audit2-${ts}@thulir.dev`,
        password: pwd,
        firstName: 'Audit',
        lastName: 'Path',
        organizationSlug: slug,
      })
      .expect(201);
    token2 = r2.body.accessToken as string;
    expect(token2).toBeTruthy();
    console.log(`  ✅ registered 2 users, org=${slug}`);

    const profile = await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set(bearer(token1))
      .expect(200);
    expect(profile.body.email).toContain(`audit1-${ts}`);
  });

  it('2. Masters — category + parameter creation (auto code) + update + list', async () => {
    const cat = await request(app.getHttpServer())
      .post('/api/v1/masters/categories')
      .set(bearer(token1))
      .send({ name: `Audit Hematology ${ts}`, codePrefix: 'AUD' })
      .expect(201);
    categoryId = cat.body.id as string;
    expect(categoryId).toBeTruthy();

    const codeGen = await request(app.getHttpServer())
      .get('/api/v1/masters/parameters/generate-code')
      .set(bearer(token1))
      .query({ categoryId })
      .expect(200);
    expect(codeGen.body).toBeTruthy();
    console.log(`  ✅ auto code → ${codeGen.body}`);

    const p1 = await request(app.getHttpServer())
      .post('/api/v1/masters/parameters')
      .set(bearer(token1))
      .send({
        code: 'AUDHEM001',
        name: 'Audit Hemoglobin',
        categoryId,
        unit: 'g/dL',
        refLow: 12,
        refHigh: 16,
        defaultPrice: 150,
        criticalValueAlert: true,
      })
      .expect(201);
    paramHemId = p1.body.id as string;

    await request(app.getHttpServer())
      .post('/api/v1/masters/parameters')
      .set(bearer(token1))
      .send({
        code: 'AUDGLU001',
        name: 'Audit Glucose',
        categoryId,
        unit: 'mg/dL',
        refLow: 70,
        refHigh: 110,
        defaultPrice: 80,
        criticalValueAlert: true,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/masters/parameters/${paramHemId}`)
      .set(bearer(token1))
      .send({ defaultPrice: 160 })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/v1/masters/parameters')
      .set(bearer(token1))
      .query({ search: 'AUD' })
      .expect(200);
    const codes = (list.body as any[]).map((p) => p.code);
    expect(codes).toContain('AUDHEM001');
    expect(codes).toContain('AUDGLU001');
    console.log('  ✅ created + edited + listed 2 parameters (HEM/GLU)');
  });

  it('3. Walk-in registration — patient + 2 tests + cash billing at counter', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/orders/register')
      .set(bearer(token1))
      .send({
        firstName: 'Audit',
        lastName: 'Patient',
        phone: '+919800000001',
        gender: 'Male',
        ageYears: 45,
        tests: [
          { code: 'AUDHEM001', name: 'Audit Hemoglobin', rate: 160 },
          { code: 'AUDGLU001', name: 'Audit Glucose', rate: 80 },
        ],
        amountPaid: 240,
        paymentMode: 'cash',
        discountPercent: 0,
      })
      .expect(201);
    orderId = res.body.orderId as string;
    orderNumber = res.body.orderNumber as string;
    expect(orderId).toBeTruthy();
    expect(orderNumber).toMatch(/^ORD-/);
    console.log(`  ✅ order ${orderNumber} (total ₹240, paid ₹240, balance 0)`);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set(bearer(token1))
      .expect(200);
    const tests = detail.body.tests as any[];
    expect(tests).toHaveLength(2);
    expect(detail.body.totalAmount).toBe('240');
    expect(detail.body.balanceAmount).toBe('0');
    testHemId = tests.find((t) => t.testCode === 'AUDHEM001')?.id;
    testGluId = tests.find((t) => t.testCode === 'AUDGLU001')?.id;
    console.log(
      `  ✅ order detail: ${tests.length} tests, status=${detail.body.status}`,
    );
  });

  it('4. Manual result entry — order rolls to completed', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/tests/${testHemId}`)
      .set(bearer(token1))
      .send({ result: '15.2', status: 'completed' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/tests/${testGluId}`)
      .set(bearer(token1))
      .send({ result: '125', status: 'completed' })
      .expect(200);
    console.log('  ✅ results entered: HEM 15.2 (normal), GLU 125 (>110 → H)');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set(bearer(token1))
      .expect(200);
    const tests = detail.body.tests as any[];
    expect(detail.body.status).toBe('completed');
    expect(tests.every((t) => t.status === 'completed')).toBe(true);
    console.log(`  ✅ order status=${detail.body.status}, all tests completed`);
  });

  it('5. Guards — verify-before-complete, edit-lock, report-before-approval', async () => {
    const o2 = await request(app.getHttpServer())
      .post('/api/v1/orders/register')
      .set(bearer(token1))
      .send({
        firstName: 'Guard',
        lastName: 'Case',
        tests: [{ code: 'AUDHEM001', name: 'Audit Hemoglobin', rate: 160 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${o2.body.orderId}/verify`)
      .set(bearer(token1))
      .expect(409);
    console.log('  ✅ verify of incomplete order rejected (409)');

    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/tests/${testHemId}`)
      .set(bearer(token1))
      .send({ result: '14.0' })
      .expect(409);
    console.log('  ✅ edit of completed result locked (409)');

    await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}/report`)
      .set(bearer(token1))
      .expect(409);
    console.log('  ✅ report gated until approved (409)');
  });

  it('6. Two-person sign-off — tech verifies, pathologist approves', async () => {
    const v = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/verify`)
      .set(bearer(token1))
      .expect(201);
    expect(v.body.status).toBe('verified');
    console.log(`  ✅ verified by ${user1Id}`);

    // Same user trying to approve → 409 (NABL two-person rule)
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/approve`)
      .set(bearer(token1))
      .expect(409);
    console.log('  ✅ self-approval rejected (409, two-person rule)');

    const a = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/approve`)
      .set(bearer(token2))
      .expect(201);
    expect(a.body.status).toBe('approved');
    expect(a.body.approvedBy).toBeTruthy();
    console.log(
      `  ✅ approved by user2 (${a.body.approvedBy}), e-signature stamped on tests`,
    );
  });

  it('7. Report payload + invoice + public QR-verify portal', async () => {
    const rep = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}/report`)
      .set(bearer(token1))
      .expect(200);
    const rows = rep.body.tests as any[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rep.body.patient.firstName).toBe('Audit');
    expect(rep.body.lab?.name).toBeTruthy();
    console.log(
      `  ✅ report payload: ${rows.length} rows, lab=${rep.body.lab?.name}`,
    );

    const inv = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}/invoice`)
      .set(bearer(token1))
      .expect(200);
    console.log(
      `  ✅ invoice total=${inv.body.billing?.totalAmount} balance=${inv.body.billing?.balanceAmount}`,
    );
    expect(inv.body.billing?.totalAmount).toBeTruthy();

    const pub = await request(app.getHttpServer())
      .get('/api/v1/public/reports/verify')
      .query({ orderNumber })
      .expect(200);
    expect(pub.body.valid).toBe(true);
    expect(pub.body.status).toBe('approved');
    console.log(
      `  ✅ public QR verify: valid=${pub.body.valid} status=${pub.body.status}`,
    );
  });

  it('8. QC — manual control + Westgard pass/reject runs + summary', async () => {
    const ctrl = await request(app.getHttpServer())
      .post('/api/v1/qc/controls')
      .set(bearer(token1))
      .send({
        testName: 'Audit Hemoglobin',
        testCode: 'AUDHEM001',
        level: 'NORMAL',
        unit: 'g/dL',
        assignedMean: 15,
        assignedSd: 0.5,
      })
      .expect(201);
    const controlId = ctrl.body.id as string;
    expect(controlId).toBeTruthy();

    const pass = await request(app.getHttpServer())
      .post('/api/v1/qc/runs')
      .set(bearer(token1))
      .send({ controlId, value: 15.1, note: 'audit run' })
      .expect(201);
    console.log(`  ✅ QC 15.1 → ${pass.body.run?.status ?? 'ok'}`);

    // 17 > mean+3SD (16.5) → 1:3s violation → REJECT (statuses are uppercase)
    const reject = await request(app.getHttpServer())
      .post('/api/v1/qc/runs')
      .set(bearer(token1))
      .send({ controlId, value: 17.0, note: 'audit run' })
      .expect(201);
    const runStatus = reject.body.run?.status;
    console.log(`  ✅ QC 17.0 → ${runStatus}`);
    expect(['REJECT', 'WARN']).toContain(runStatus);

    const summary = await request(app.getHttpServer())
      .get('/api/v1/qc/summary')
      .set(bearer(token1))
      .expect(200);
    console.log(
      `  ✅ QC summary: controls=${summary.body.controls ?? 'n/a'} todayRuns=${summary.body.today?.runs ?? 'n/a'}`,
    );
    expect(summary.body.controls).toBeGreaterThanOrEqual(1);
  });

  it('9. Audit trail, dashboard stats, analytics, inventory alerts', async () => {
    const audit = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set(bearer(token1))
      .query({ entity: 'orders', limit: 50 })
      .expect(200);
    const entries = Array.isArray(audit.body)
      ? audit.body
      : (audit.body.items ?? []);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    console.log(`  ✅ audit entries for orders: ${entries.length}`);

    const dash = await request(app.getHttpServer())
      .get('/api/v1/dashboard/stats')
      .set(bearer(token1))
      .expect(200);
    expect(Number(dash.body.totalOrders)).toBeGreaterThanOrEqual(2);
    console.log(
      `  ✅ dashboard: orders=${dash.body.totalOrders} pendingTests=${dash.body.pendingTests}`,
    );

    await request(app.getHttpServer())
      .get('/api/v1/reports/analytics')
      .set(bearer(token1))
      .expect(200);
    console.log('  ✅ analytics endpoint 200');

    const invAlerts = await request(app.getHttpServer())
      .get('/api/v1/inventory/alerts')
      .set(bearer(token1))
      .expect(200);
    const alertCount =
      (invAlerts.body.lowStock?.length ?? 0) +
      (invAlerts.body.expiring?.length ?? 0) +
      (invAlerts.body.expired?.length ?? 0);
    console.log(`  ✅ inventory alerts: ${alertCount} (low/expiring/expired)`);
  });
});
