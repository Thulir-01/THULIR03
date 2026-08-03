import { createHash, randomUUID } from 'crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

/** The JSON shape of an order test row as returned over the API — the fields
 *  Result Entry renders. Used by the read-time enrichment pass. */
interface OrderTestView {
  testCode: string;
  unit: string | null;
  refRange: string | null;
  refLow: number | null;
  refHigh: number | null;
  children?: OrderTestView[];
}
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { findProfile } from './test-profiles';
import { resolveEffectivePrice } from '../masters/price-resolver';

/** Render a master's numeric ref range as a display string, e.g. "4.5 – 11". */
function formatRefRange(
  refLow: number | null,
  refHigh: number | null,
): string | null {
  if (refLow === null && refHigh === null) return null;
  if (refLow !== null && refHigh !== null) return `${refLow} – ${refHigh}`;
  if (refLow !== null) return `≥ ${refLow}`;
  return `≤ ${refHigh}`;
}

export interface RegisterPatientOrderDto {
  patientId?: string;
  title?: string;
  firstName?: string;
  lastName?: string;
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
  branch?: string;
  category?: string;
  sidDate?: string;
  refNo?: string;
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

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    search?: string,
    limit?: number,
    offset?: number,
  ) {
    const where: Prisma.OrderWhereInput = { tenantId, deletedAt: null };
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: search, mode: 'insensitive' } } },
        { patient: { phone: { contains: search } } },
        { refNo: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.client.order.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        tests: {
          select: {
            id: true,
            testCode: true,
            testName: true,
            rate: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit ?? 50, 200),
      skip: Math.max(offset ?? 0, 0),
    });
  }

  async findOne(tenantId: string, orderId: string) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        tests: {
          where: { parentTestId: null },
          include: {
            children: {
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Read-time enrichment: older orders (booked before unit/ref snapshots
    // existed) may have null unit/refRange on their test rows. Fill those in
    // from the parameter master so Result Entry always shows real values,
    // not blanks — the master remains the single source of truth.
    await this.enrichMissingTestMeta(
      tenantId,
      order.tests as unknown as OrderTestView[],
    );

    // Resolve the verifier's display name so approval screens can tell staff
    // who verified the results (NABL two-person hand-off: the verifier cannot
    // be the approver, so knowing who to hand off to matters).
    let verifiedByUser: { id: string; name: string } | null = null;
    if (order.verifiedBy) {
      const verifier = await this.prisma.client.user.findFirst({
        where: { id: order.verifiedBy },
        select: { id: true, firstName: true, lastName: true },
      });
      if (verifier) {
        verifiedByUser = {
          id: verifier.id,
          name: `${verifier.firstName} ${verifier.lastName}`.trim(),
        };
      }
    }
    return { ...order, verifiedByUser };
  }

  /**
   * Fill null unit/refRange/refLow/refHigh on order test rows (recursively,
   * so profile children are covered too) from the matching master parameter.
   * Operates on plain JSON-ish shapes (the values we return over the API),
   * so it only needs the fields Result Entry consumes.
   */
  private async enrichMissingTestMeta(
    tenantId: string,
    tests: OrderTestView[],
  ) {
    const missing = new Set<string>();
    const walk = (list: OrderTestView[]) => {
      for (const t of list) {
        if (!t.unit || !t.refRange) missing.add(t.testCode);
        if (t.children?.length) walk(t.children);
      }
    };
    walk(tests);
    if (missing.size === 0) return;
    const masters = await this.prisma.client.testParameter.findMany({
      where: { tenantId, code: { in: [...missing] } },
    });
    const byCode = new Map(masters.map((m) => [m.code, m]));
    const fill = (list: OrderTestView[]) => {
      for (const t of list) {
        const m = byCode.get(t.testCode);
        if (m && (!t.unit || !t.refRange)) {
          if (!t.unit) t.unit = m.unit;
          if (!t.refRange) {
            t.refRange = formatRefRange(
              m.refLow ? Number(m.refLow) : null,
              m.refHigh ? Number(m.refHigh) : null,
            );
          }
          if (t.refLow === null && m.refLow) t.refLow = Number(m.refLow);
          if (t.refHigh === null && m.refHigh) t.refHigh = Number(m.refHigh);
        }
        if (t.children?.length) fill(t.children);
      }
    };
    fill(tests);
  }

  async register(tenantId: string, dto: RegisterPatientOrderDto) {
    const { tests, ...data } = dto;

    // Collision-safe order number: UUID-derived (8 hex chars) instead of
    // Date.now(), so two submissions in the same millisecond can't clash.
    const orderNumber = `ORD-${randomUUID()
      .replace(/-/g, '')
      .slice(0, 8)
      .toUpperCase()}`;
    // Referrer pricing — resolve line-item prices server-side via the shared
    // rule in masters/price-resolver.ts when the named referrer has a pricing
    // mode. Falls back to client-supplied rates for walk-ins / default mode.
    let referrerPricing: {
      referrerId: string;
      pricingMode: string | null;
      discountPercent: number | null;
    } | null = null;
    if (data.referrer) {
      const found = await this.prisma.client.party.findFirst({
        where: {
          tenantId,
          partyType: 'doctor',
          name: data.referrer,
          deletedAt: null,
        },
        include: { doctorDetail: true },
      });
      if (found) {
        referrerPricing = {
          referrerId: found.id,
          pricingMode: found.doctorDetail?.pricingMode ?? 'default',
          discountPercent: found.doctorDetail?.discountPercent
            ? Number(found.doctorDetail.discountPercent)
            : null,
        };
      }
    }
    // Always load active parameters — used both for referrer pricing AND for
    // snapshotting unit/ref-range onto order tests, so Result Entry shows the
    // values the test was booked under even for single (non-profile) tests.
    const parameterByCode = new Map<
      string,
      {
        id: string;
        defaultPrice: number;
        unit: string | null;
        refLow: number | null;
        refHigh: number | null;
      }
    >();
    const params = await this.prisma.client.testParameter.findMany({
      where: { tenantId, isActive: true },
    });
    for (const p of params) {
      parameterByCode.set(p.code, {
        id: p.id,
        defaultPrice: Number(p.defaultPrice),
        unit: p.unit ?? null,
        refLow: p.refLow ? Number(p.refLow) : null,
        refHigh: p.refHigh ? Number(p.refHigh) : null,
      });
    }
    const packageByCode = new Map<
      string,
      { id: string; pricingMode: string; fixedPrice: number | null }
    >();
    const overrides = new Map<string, number>();
    if (referrerPricing) {
      const [pkgs, priceRows] = await Promise.all([
        this.prisma.client.testPackage.findMany({
          where: { tenantId, isActive: true },
        }),
        referrerPricing.pricingMode === 'custom'
          ? this.prisma.client.referrerPrice.findMany({
              where: {
                partyId: referrerPricing.referrerId,
                tenantId,
              },
            })
          : Promise.resolve([]),
      ]);
      for (const p of pkgs) {
        packageByCode.set(p.code, {
          id: p.id,
          pricingMode: p.pricingMode,
          fixedPrice: p.fixedPrice ? Number(p.fixedPrice) : null,
        });
      }
      for (const row of priceRows) {
        if (row.parameterId) {
          overrides.set(`param:${row.parameterId}`, Number(row.price));
        }
        if (row.packageId) {
          overrides.set(`pkg:${row.packageId}`, Number(row.price));
        }
      }
    }
    const effectiveRates = new Map<string, number>();
    for (const t of tests) {
      const profile = findProfile(t.code);
      const defaultPrice = profile?.rate ?? t.rate;
      const pkg = packageByCode.get(t.code);
      const fixedPrice =
        pkg?.pricingMode === 'fixed' ? (pkg.fixedPrice ?? null) : null;
      const overridePrice = pkg
        ? (overrides.get(`pkg:${pkg.id}`) ?? null)
        : (overrides.get(`param:${parameterByCode.get(t.code)?.id ?? ''}`) ??
          null);
      effectiveRates.set(
        t.code,
        resolveEffectivePrice({
          code: t.code,
          defaultPrice,
          fixedPrice,
          referrer: referrerPricing
            ? {
                pricingMode: referrerPricing.pricingMode,
                discountPercent: referrerPricing.discountPercent,
              }
            : null,
          overridePrice,
        }),
      );
    }
    const subTotal = tests.reduce(
      (s, t) => s + (effectiveRates.get(t.code) ?? t.rate),
      0,
    );
    const discAmt = subTotal * ((data.discountPercent ?? 0) / 100);
    const totalAmt = subTotal + (data.otherCharges ?? 0) - discAmt;
    const balance = totalAmt - (data.amountPaid ?? 0);

    // Single transaction: patient + order + order tests commit together.
    // If any step fails (network blip, crash), nothing is left behind —
    // no orphan patients, no orders without tests.
    return this.prisma.client.$transaction(
      async (tx) => {
        // 1. Patient
        let patient: { id: string } | null = null;
        if (data.patientId) {
          patient = await tx.patient.findFirst({
            where: { id: data.patientId, tenantId },
          });
          if (!patient) throw new NotFoundException('Patient not found');
        } else {
          patient = await tx.patient.create({
            data: {
              tenantId,
              title: data.title ?? null,
              firstName: data.firstName ?? '',
              lastName: data.lastName ?? '',
              dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
              ageYears: data.ageYears ?? null,
              ageMonths: data.ageMonths ?? null,
              gender: data.gender ?? null,
              phone: data.phone ?? null,
              email: data.email ?? null,
            },
          });
        }

        // 2. Order
        const order = await tx.order.create({
          data: {
            tenantId,
            patientId: patient.id,
            referrerPartyId: referrerPricing?.referrerId ?? null,
            orderNumber,
            category: data.category ?? null,
            sidDate: data.sidDate ? new Date(data.sidDate) : null,
            refNo: data.refNo ?? null,
            source: data.source ?? null,
            insuranceDetails: data.insurance ?? null,
            collectionBoy: data.collectionBoy ?? null,
            patientType: data.patientType ?? null,
            ward: data.ward ?? null,
            ipOpNo: data.ipOpNo ?? null,
            bedNo: data.bedNo ?? null,
            clinicalRemarks: data.clinicalRemarks ?? null,
            sampleCollectDt: data.sampleCollectDate
              ? new Date(data.sampleCollectDate)
              : null,
            billAmount: subTotal,
            otherCharges: data.otherCharges ?? 0,
            discountPercent: data.discountPercent ?? 0,
            discountAmount: discAmt,
            discountAuth: data.discountAuth ?? null,
            totalAmount: totalAmt,
            amountPaid: data.amountPaid ?? 0,
            balanceAmount: balance,
            paymentMode: data.paymentMode ?? null,
            bankName: data.bankName ?? null,
            paymentRef: data.paymentRef ?? null,
            paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
            paymentRemarks: data.paymentRemarks ?? null,
            deliveryMode: data.deliveryMode ?? null,
            emergency: data.emergency ?? false,
            finalReportDate: data.finalReportDate
              ? new Date(data.finalReportDate)
              : null,
            billHf: data.billHf ?? false,
            consolidatedBill: data.consolidatedBill ?? false,
            remarks: data.remarks ?? null,
          },
        });

        // 3. Sample — one default tube per order; all tests hang off it.
        // Sample status lives on the Sample row so one physical tube can
        // never hold contradictory test statuses.
        const sample = await tx.sample.create({
          data: {
            tenantId,
            orderId: order.id,
            sampleNo: `SPL-${randomUUID()
              .replace(/-/g, '')
              .slice(0, 8)
              .toUpperCase()}`,
            sampleCollectDt: order.sampleCollectDt,
            status: 'pending',
          },
        });

        // 4. Create order tests — expand profiles into sub-parameters.
        // Batched with createMany (3 round trips instead of one per
        // parameter) so registration stays fast even for 13-parameter
        // profiles like CBC.
        type ParentSeed = {
          tenantId: string;
          orderId: string;
          sampleId: string;
          testCode: string;
          testName: string;
          isProfile: boolean;
          rate: number;
          status: string;
          sortOrder: number;
        };
        type ChildSeed = ParentSeed & {
          parentTestId: string;
          unit?: string | null;
          refRange?: string | null;
          refLow?: number | null;
          refHigh?: number | null;
        };
        type SingleSeed = ParentSeed & {
          unit?: string | null;
          refRange?: string | null;
          refLow?: number | null;
          refHigh?: number | null;
        };
        const parentSeeds: ParentSeed[] = [];
        const childSegments: ChildSeed[][] = [];
        const singleSeeds: SingleSeed[] = [];

        for (const t of tests) {
          const profile = findProfile(t.code);
          if (profile) {
            parentSeeds.push({
              tenantId,
              orderId: order.id,
              sampleId: sample.id,
              testCode: profile.code,
              testName: profile.name,
              isProfile: true,
              rate: effectiveRates.get(profile.code) ?? profile.rate,
              status: 'pending',
              sortOrder: 0,
            });
            childSegments.push(
              profile.parameters.map((param) => ({
                tenantId,
                orderId: order.id,
                sampleId: sample.id,
                parentTestId: '', // filled in after parents return
                testCode: param.code,
                testName: param.name,
                isProfile: false,
                rate: 0,
                status: 'pending',
                unit: param.unit,
                refRange: param.refRange,
                refLow: param.refLow,
                refHigh: param.refHigh,
                sortOrder: param.sortOrder,
              })),
            );
          } else {
            // Snapshot unit + ref range from the parameter master (the same
            // source Result Entry renders read-only) so single tests show
            // real values, not blanks.
            const meta = parameterByCode.get(t.code);
            singleSeeds.push({
              tenantId,
              orderId: order.id,
              sampleId: sample.id,
              testCode: t.code,
              testName: t.name,
              isProfile: false,
              rate: effectiveRates.get(t.code) ?? t.rate,
              status: 'pending',
              sortOrder: 0,
              unit: meta?.unit ?? null,
              refRange: formatRefRange(
                meta?.refLow ?? null,
                meta?.refHigh ?? null,
              ),
              refLow: meta?.refLow ?? null,
              refHigh: meta?.refHigh ?? null,
            });
          }
        }

        if (parentSeeds.length > 0) {
          const parents = await tx.orderTest.createManyAndReturn({
            data: parentSeeds,
          });
          for (let i = 0; i < parents.length && i < childSegments.length; i++) {
            const parentId = parents[i].id;
            for (const child of childSegments[i]) {
              child.parentTestId = parentId;
            }
          }
        }
        const allChildren = childSegments.flat();
        if (allChildren.length > 0) {
          await tx.orderTest.createMany({ data: allChildren });
        }
        if (singleSeeds.length > 0) {
          await tx.orderTest.createMany({ data: singleSeeds });
        }

        return {
          message: 'Patient registered successfully',
          patientId: patient.id,
          orderId: order.id,
          orderNumber,
        };
      },
      { timeout: 30000 },
    );
  }

  /**
   * Technician verify: confirms every result in the order is entered and
   * correct, moving the order from `completed` → `verified`. Only allowed
   * when all tests are completed — an incomplete order cannot be verified.
   */
  async verifyOrder(tenantId: string, orderId: string, actorUserId: string) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      include: { tests: { select: { status: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'completed') {
      throw new ConflictException(
        `Order is "${order.status}" — only completed orders can be verified`,
      );
    }
    if (!order.tests.every((t) => t.status === 'completed')) {
      throw new ConflictException(
        'All test results must be completed before verifying',
      );
    }
    const now = new Date();
    return this.prisma.client.order.update({
      where: { id: orderId },
      data: { status: 'verified', verifiedBy: actorUserId, verifiedAt: now },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        verifiedBy: true,
        verifiedAt: true,
      },
    });
  }

  /**
   * Pathologist approval: the NABL sign-off. Only allowed from `verified`.
   * Stamps every test row with the pathologist's e-signature (verifiedBy /
   * verifiedAt / signatureHash) so the report carries an immutable sign-off,
   * sets finalReportDate, and moves the order to `approved` — the only state
   * a printable report is available from.
   */
  async approveOrder(tenantId: string, orderId: string, actorUserId: string) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'verified') {
      throw new ConflictException(
        `Order is "${order.status}" — only verified orders can be approved`,
      );
    }
    // NABL two-person sign-off: the user who verified the results cannot also
    // approve them — even a lab_admin who verified must hand off to someone
    // else. A single person signing both steps would defeat the audit trail.
    if (order.verifiedBy === actorUserId) {
      throw new ConflictException(
        'Two-person sign-off required — the user who verified this order cannot also approve it',
      );
    }
    const now = new Date();
    // Deterministic signature hash: order + actor + timestamp, so the report
    // (and later the QR verification portal) can re-derive it to confirm an
    // original, un-tampered report.
    const signatureHash = createHash('sha256')
      .update(`${order.id}:${actorUserId}:${now.toISOString()}`)
      .digest('hex');

    return this.prisma.client.$transaction(
      async (tx) => {
        await tx.orderTest.updateMany({
          where: { orderId },
          data: {
            verifiedBy: actorUserId,
            verifiedAt: now,
            signatureHash,
          },
        });
        return tx.order.update({
          where: { id: orderId },
          data: {
            status: 'approved',
            approvedBy: actorUserId,
            approvedAt: now,
            finalReportDate: now,
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            approvedBy: true,
            approvedAt: true,
            finalReportDate: true,
          },
        });
      },
      { timeout: 30000 },
    );
  }

  /**
   * Report payload — everything the printable clinical report needs: patient
   * demographics, all tests with results/units/ref-ranges, and the verify /
   * approve actors (resolved to names + pathologist signature image). Only
   * available for approved orders; anything else is a 409.
   */
  async getReportData(tenantId: string, orderId: string) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      include: {
        patient: {
          select: {
            title: true,
            firstName: true,
            lastName: true,
            gender: true,
            dateOfBirth: true,
            ageYears: true,
            ageMonths: true,
            phone: true,
          },
        },
        referrerParty: { select: { name: true } },
        tests: {
          where: { parentTestId: null },
          select: {
            testCode: true,
            testName: true,
            isProfile: true,
            result: true,
            unit: true,
            refRange: true,
            refLow: true,
            refHigh: true,
            notes: true,
            status: true,
            children: {
              orderBy: { sortOrder: 'asc' },
              select: {
                testCode: true,
                testName: true,
                result: true,
                unit: true,
                refRange: true,
                refLow: true,
                refHigh: true,
                notes: true,
                status: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'approved') {
      throw new ConflictException(
        `Report is only available for approved orders (current: "${order.status}")`,
      );
    }

    const [verifiedByUser, approvedByUser, organization] = await Promise.all([
      order.verifiedBy
        ? this.prisma.client.user.findFirst({
            where: { id: order.verifiedBy },
            select: {
              firstName: true,
              lastName: true,
              staffDetail: { select: { signatureImageUrl: true } },
            },
          })
        : null,
      order.approvedBy
        ? this.prisma.client.user.findFirst({
            where: { id: order.approvedBy },
            select: {
              firstName: true,
              lastName: true,
              staffDetail: {
                select: {
                  signatureImageUrl: true,
                  designation: true,
                  registrationNo: true,
                },
              },
            },
          })
        : null,
      // The tenant IS the lab organization — used for the printable
      // letterhead (name / address / phone / email).
      this.prisma.client.organization.findFirst({
        where: { id: tenantId, deletedAt: null },
        select: { name: true, address: true, phone: true, email: true },
      }),
    ]);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      sampleCollectDt: order.sampleCollectDt,
      refNo: order.refNo,
      remarks: order.remarks,
      priority: order.priority,
      emergency: order.emergency,
      patient: order.patient,
      referrer: order.referrerParty?.name ?? null,
      verifiedAt: order.verifiedAt,
      approvedAt: order.approvedAt,
      finalReportDate: order.finalReportDate,
      verifiedBy: verifiedByUser
        ? {
            name: `${verifiedByUser.firstName} ${verifiedByUser.lastName}`,
            signatureImageUrl:
              verifiedByUser.staffDetail?.signatureImageUrl ?? null,
          }
        : null,
      approvedBy: approvedByUser
        ? {
            name: `${approvedByUser.firstName} ${approvedByUser.lastName}`,
            designation: approvedByUser.staffDetail?.designation ?? null,
            registrationNo: approvedByUser.staffDetail?.registrationNo ?? null,
            signatureImageUrl:
              approvedByUser.staffDetail?.signatureImageUrl ?? null,
          }
        : null,
      lab: organization
        ? {
            name: organization.name,
            address: organization.address ?? null,
            phone: organization.phone ?? null,
            email: organization.email ?? null,
          }
        : null,
      tests: order.tests,
    };
  }

  /** Invoice / receipt print payload. Unlike the clinical report this is
   *  available for ANY order (billing happens at registration, before the
   *  report is approved) — the receipt doubles as the collection proof. */
  async getInvoiceData(tenantId: string, orderId: string) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      include: {
        patient: {
          select: {
            title: true,
            firstName: true,
            lastName: true,
            gender: true,
            dateOfBirth: true,
            ageYears: true,
            ageMonths: true,
            phone: true,
            email: true,
          },
        },
        referrerParty: { select: { name: true } },
        tests: {
          where: { parentTestId: null },
          select: {
            testCode: true,
            testName: true,
            isProfile: true,
            rate: true,
            status: true,
            children: {
              orderBy: { sortOrder: 'asc' },
              select: {
                testCode: true,
                testName: true,
                rate: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      priority: order.priority,
      emergency: order.emergency,
      refNo: order.refNo,
      deliveryMode: order.deliveryMode,
      consolidatedBill: order.consolidatedBill,
      patient: order.patient,
      referrer: order.referrerParty?.name ?? null,
      tests: order.tests,
      billing: {
        billAmount: order.billAmount,
        otherCharges: order.otherCharges,
        discountPercent: order.discountPercent,
        discountAmount: order.discountAmount,
        discountAuth: order.discountAuth,
        totalAmount: order.totalAmount,
        amountPaid: order.amountPaid,
        balanceAmount: order.balanceAmount,
        paymentMode: order.paymentMode,
        bankName: order.bankName,
        paymentRef: order.paymentRef,
        paymentDate: order.paymentDate,
        paymentRemarks: order.paymentRemarks,
      },
    };
  }

  async updateTestResult(
    tenantId: string,
    orderId: string,
    testId: string,
    body: {
      result?: string;
      unit?: string;
      refRange?: string;
      status?: string;
      notes?: string;
    },
  ) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const test = await this.prisma.client.orderTest.findFirst({
      where: { id: testId, orderId },
    });
    if (!test) throw new NotFoundException('Test not found');

    // Edit-lock: once a result is completed it becomes immutable at the data
    // layer. The full retract/verify workflow (Sprint 6) will provide the
    // explicit way to reopen a result; until then, edits to a completed
    // result are rejected so a verified value can never silently change.
    const triesToEditValue =
      body.result !== undefined ||
      body.unit !== undefined ||
      body.refRange !== undefined;
    if (test.status === 'completed' && triesToEditValue) {
      throw new ConflictException(
        `Result for "${test.testName}" is completed and locked — retract it before amending`,
      );
    }

    // All writes (test update → order roll-up → parent roll-up) must commit
    // together — same transactional pattern as register().
    return this.prisma.client.$transaction(
      async (tx) => {
        const updated = await tx.orderTest.update({
          where: { id: testId },
          data: {
            result: body.result ?? test.result,
            unit: body.unit ?? test.unit,
            refRange: body.refRange ?? test.refRange,
            status: body.status ?? test.status,
            notes: body.notes ?? test.notes,
          },
        });

        // Check if ALL tests in the order are completed → update order status
        const allTests = await tx.orderTest.findMany({
          where: { orderId },
        });
        const allDone = allTests.every((t) => t.status === 'completed');
        if (allDone) {
          await tx.order.update({
            where: { id: orderId },
            data: { status: 'completed' },
          });
        }

        // If this is a child test, update parent test status too
        if (test.parentTestId) {
          const siblings = await tx.orderTest.findMany({
            where: { parentTestId: test.parentTestId },
          });
          const allSiblingsDone = siblings.every(
            (t) => t.status === 'completed',
          );
          if (allSiblingsDone) {
            await tx.orderTest.update({
              where: { id: test.parentTestId },
              data: { status: 'completed' },
            });
          }
        }

        return updated;
      },
      { timeout: 30000 },
    );
  }
}
