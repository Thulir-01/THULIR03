import { randomUUID } from 'crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { findProfile } from './test-profiles';
import { resolveEffectivePrice } from '../masters/price-resolver';

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
    return order;
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
    const parameterByCode = new Map<
      string,
      { id: string; defaultPrice: number }
    >();
    const packageByCode = new Map<
      string,
      { id: string; pricingMode: string; fixedPrice: number | null }
    >();
    const overrides = new Map<string, number>();
    if (referrerPricing) {
      const [params, pkgs, priceRows] = await Promise.all([
        this.prisma.client.testParameter.findMany({
          where: { tenantId, isActive: true },
        }),
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
      for (const p of params) {
        parameterByCode.set(p.code, {
          id: p.id,
          defaultPrice: Number(p.defaultPrice),
        });
      }
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
        const parentSeeds: ParentSeed[] = [];
        const childSegments: ChildSeed[][] = [];
        const singleSeeds: ParentSeed[] = [];

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
