import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RegisterPatientOrderDto {
  // Existing patient (optional — if provided, skip patient creation)
  patientId?: string;

  // Header
  branch?: string;
  category?: string;
  sidDate?: string;
  refNo?: string;

  // Patient (only used when creating new patient)
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

  // Tests
  tests: Array<{ code: string; name: string; rate: number }>;

  // Billing
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
  subTotal?: number;
  totalAmount?: number;
  balance?: number;
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

  async register(tenantId: string, dto: RegisterPatientOrderDto) {
    const { tests, ...data } = dto;

    // 1. Use existing patient OR create new one
    let patient;
    if (data.patientId) {
      patient = await this.prisma.patient.findFirst({
        where: { id: data.patientId, tenantId },
      });
      if (!patient) {
        throw new NotFoundException('Patient not found');
      }
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

    // 2. Create order with billing
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

    // 3. Create order tests
    if (tests.length > 0) {
      await this.prisma.orderTest.createMany({
        data: tests.map((t) => ({
          orderId: order.id,
          testCode: t.code,
          testName: t.name,
          rate: t.rate,
        })),
      });
    }

    return {
      message: 'Patient registered successfully',
      patientId: patient.id,
      orderId: order.id,
      orderNumber,
    };
  }
}
