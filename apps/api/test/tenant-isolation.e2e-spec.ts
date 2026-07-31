/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * DB-backed tenant isolation test.
 *
 * Boots the real NestJS application (all global interceptors included), creates
 * two organizations through the public register API, seeds data as Tenant A,
 * then asserts Tenant B cannot read/update/search Tenant A's data — and that
 * Tenant A's mutations left an audit trail.
 *
 * Requires a live PostgreSQL (the CI `test-api` job provides one via its
 * postgres service; migrations are applied before this suite runs).
 */
describe('Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const runId = Date.now();
  const password = 'E2ePass@123';

  const tenantA = {
    slug: `tenant-a-${runId}`,
    email: `a${runId}@e2e.local`,
    name: 'Tenant A Lab',
    patientFirstName: `Isol${runId}`,
  };
  const tenantB = {
    slug: `tenant-b-${runId}`,
    email: `b${runId}@e2e.local`,
    name: 'Tenant B Lab',
  };

  let tokenA = '';
  let tokenB = '';
  let userIdA = '';
  let orgIdA = '';
  let patientIdA = '';
  let orderIdA = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL must be set to run the tenant-isolation e2e suite',
      );
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.enableVersioning({
      type: VersioningType.URI,
      prefix: 'v',
      defaultVersion: '1',
    });
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Polls the audit_logs table (audit writes are fire-and-forget). */
  async function waitForAudit(where: {
    tenantId: string;
    entity: string;
    entityId: string;
  }): Promise<{ id: string; action: string } | undefined> {
    const deadline = Date.now() + 4_000;
    while (Date.now() < deadline) {
      const entry = await prisma.client.auditLog.findFirst({
        where,
        select: { id: true, action: true },
      });
      if (entry) return entry;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return undefined;
  }

  it('creates two isolated tenants via the public register API', async () => {
    const a = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: tenantA.email,
        password,
        firstName: 'E2E',
        lastName: 'TenantA',
        organizationSlug: tenantA.slug,
        organizationName: tenantA.name,
      })
      .expect(201);

    const b = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: tenantB.email,
        password,
        firstName: 'E2E',
        lastName: 'TenantB',
        organizationSlug: tenantB.slug,
        organizationName: tenantB.name,
      })
      .expect(201);

    tokenA = (a.body as { accessToken: string }).accessToken;
    tokenB = (b.body as { accessToken: string }).accessToken;
    userIdA = (a.body as { user: { id: string } }).user.id;
    expect(userIdA).toBeTruthy();
    expect(tokenA).toBeTruthy();
    expect(tokenB).toBeTruthy();
  });

  it('Tenant A registers a patient and an order', async () => {
    // Resolve Tenant A's organization id from its profile
    const profile = await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    orgIdA = (profile.body as { organization: { id: string } }).organization.id;
    expect(orgIdA).toBeTruthy();

    const patient = await request(app.getHttpServer())
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        firstName: tenantA.patientFirstName,
        lastName: 'PatientA',
        phone: `+91 ${runId}`,
      })
      .expect(201);
    patientIdA = (patient.body as { id: string }).id;
    expect(patientIdA).toBeTruthy();

    const order = await request(app.getHttpServer())
      .post('/api/v1/orders/register')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        patientId: patientIdA,
        tests: [{ code: 'BSF', name: 'Blood Sugar Fasting', rate: 80 }],
        amountPaid: 80,
        paymentMode: 'Cash',
      })
      .expect(201);
    // The register endpoint returns { orderId, orderNumber, ... }.
    orderIdA = (order.body as { orderId: string }).orderId;
    expect(orderIdA).toBeTruthy();
  });

  it('Tenant B cannot read Tenant A patient (404 — tenant scoping)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/patients/${patientIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('Tenant B cannot update Tenant A patient (404)', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/patients/${patientIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ phone: '+91 0000000000' })
      .expect(404);
  });

  it('Tenant B cannot read Tenant A order (404)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('Tenant B search never surfaces Tenant A data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/patients')
      .query({ search: tenantA.patientFirstName })
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect((res.body as unknown[]).length).toBe(0);
  });

  it('Tenant A can still read its own patient and order', async () => {
    const patient = await request(app.getHttpServer())
      .get(`/api/v1/patients/${patientIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect((patient.body as { id: string }).id).toBe(patientIdA);

    const order = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect((order.body as { id: string }).id).toBe(orderIdA);
  });

  it('Tenant A mutations are recorded in the audit trail', async () => {
    const patientAudit = await waitForAudit({
      tenantId: orgIdA,
      entity: 'patients',
      entityId: patientIdA,
    });
    expect(patientAudit).toBeDefined();
    expect(patientAudit?.action).toBe('POST');

    const orderAudit = await waitForAudit({
      tenantId: orgIdA,
      entity: 'orders',
      entityId: orderIdA,
    });
    expect(orderAudit).toBeDefined();
    expect(orderAudit?.action).toBe('POST');

    // Sanity: the audit actor is Tenant A's user, not an empty value.
    const actorEntry = await prisma.client.auditLog.findFirst({
      where: { tenantId: orgIdA, entity: 'patients', entityId: patientIdA },
      select: { actorId: true },
    });
    expect(actorEntry?.actorId).toBe(userIdA);
  });
});
