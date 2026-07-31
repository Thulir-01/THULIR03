import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { findProfile, isProfile } from './test-profiles';

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

  async findAll(tenantId: string, search?: string) {
    const where: any = { tenantId, deletedAt: null };
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: search, mode: 'insensitive' } } },
        { patient: { phone: { contains: search } } },
        { refNo: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.order.findMany({
      where,
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true, gender: true, dateOfBirth: true },
        },
        tests: {
          select: { id: true, testCode: true, testName: true, rate: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findOne(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, title: true, phone: true, gender: true, dateOfBirth: true },
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

    // 1. Patient
    let patient: any;
    if (data.patientId) {
      patient = await this.prisma.patient.findFirst({ where: { id: data.patientId, tenantId } });
      if (!patient) throw new NotFoundException('Patient not found');
    } else {
      patient = await this.prisma.patient.create({
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
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const subTotal = tests.reduce((s, t) => s + t.rate, 0);
    const discAmt = subTotal * ((data.discountPercent ?? 0) / 100);
    const totalAmt = subTotal + (data.otherCharges ?? 0) - discAmt;
    const balance = totalAmt - (data.amountPaid ?? 0);

    const order = await this.prisma.order.create({
      data: {
        tenantId,
        patientId: patient.id,
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
        sampleCollectDt: data.sampleCollectDate ? new Date(data.sampleCollectDate) : null,
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
        finalReportDate: data.finalReportDate ? new Date(data.finalReportDate) : null,
        billHf: data.billHf ?? false,
        consolidatedBill: data.consolidatedBill ?? false,
        remarks: data.remarks ?? null,
      },
    });

    // 3. Create order tests — expand profiles into sub-parameters
    for (const t of tests) {
      const profile = findProfile(t.code);
      if (profile) {
        // Create parent profile row
        const parentTest = await this.prisma.orderTest.create({
          data: {
            orderId: order.id,
            testCode: profile.code,
            testName: profile.name,
            isProfile: true,
            rate: profile.rate,
            status: 'pending',
            sortOrder: 0,
          },
        });
        // Create child parameters
        for (const param of profile.parameters) {
          await this.prisma.orderTest.create({
            data: {
              orderId: order.id,
              parentTestId: parentTest.id,
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
            },
          });
        }
      } else {
        // Single test
        await this.prisma.orderTest.create({
          data: {
            orderId: order.id,
            testCode: t.code,
            testName: t.name,
            isProfile: false,
            rate: t.rate,
            status: 'pending',
            sortOrder: 0,
          },
        });
      }
    }

    return {
      message: 'Patient registered successfully',
      patientId: patient.id,
      orderId: order.id,
      orderNumber,
    };
  }

  async updateTestResult(tenantId: string, orderId: string, testId: string, body: { result?: string; unit?: string; refRange?: string; status?: string }) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId } });
    if (!order) throw new NotFoundException('Order not found');

    const test = await this.prisma.orderTest.findFirst({ where: { id: testId, orderId } });
    if (!test) throw new NotFoundException('Test not found');

    const updated = await this.prisma.orderTest.update({
      where: { id: testId },
      data: {
        result: body.result ?? test.result,
        unit: body.unit ?? test.unit,
        refRange: body.refRange ?? test.refRange,
        status: body.status ?? test.status,
      },
    });

    // Check if ALL tests in the order are completed → update order status
    const allTests = await this.prisma.orderTest.findMany({ where: { orderId } });
    const allDone = allTests.every(t => t.status === 'completed');
    if (allDone) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'completed' } });
    }

    // If this is a child test, update parent test status too
    if (test.parentTestId) {
      const siblings = await this.prisma.orderTest.findMany({ where: { parentTestId: test.parentTestId } });
      const allSiblingsDone = siblings.every(t => t.status === 'completed');
      if (allSiblingsDone) {
        await this.prisma.orderTest.update({ where: { id: test.parentTestId }, data: { status: 'completed' } });
      }
    }

    return updated;
  }
}
