import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Types ────────────────────────────────────────────────────────────────

export type QcLevel = 'LOW' | 'NORMAL' | 'HIGH';
export type QcStatus = 'PASS' | 'WARN' | 'REJECT';

export interface CreateQcControlDto {
  testName: string;
  testCode?: string;
  level?: QcLevel;
  unit?: string;
  assignedMean: number;
  assignedSd: number;
}

export interface EnterQcRunDto {
  controlId: string;
  value: number;
  note?: string;
}

export interface QcControlRow {
  id: string;
  testName: string;
  testCode: string | null;
  level: QcLevel;
  name: string;
  unit: string | null;
  assignedMean: number;
  assignedSd: number;
  isActive: boolean;
  runCount: number;
}

export interface QcRunRow {
  id: string;
  controlId: string;
  controlName: string;
  testName: string;
  measuredValue: number;
  sdDeviation: number | null;
  status: QcStatus;
  violations: string[];
  note: string | null;
  runDate: Date;
}

// ─── Westgard multi-rule engine ────────────────────────────────────────────
// Documented approximations for single-analyte manual entry:
//   1:2s  |z| > 2                          → warn
//   1:3s  |z| > 3                          → reject
//   2:2s  2 consecutive same-side  > 2 SD  → reject
//   R:4s  2 consecutive opposite-side >2SD → reject (range across runs)
//   4:1s  4 consecutive same-side  > 1 SD  → reject
//   10x   10 consecutive same-side of mean → reject (systematic drift)
export function evaluateWestgard(
  mean: number,
  sd: number,
  value: number,
  prev: number[],
): { status: QcStatus; violations: string[]; sdDeviation: number } {
  if (sd <= 0) throw new BadRequestException('assignedSd must be positive');
  const z = (value - mean) / sd;
  // Convert previous measured values to z-scores so multi-rule checks compare
  // SD units consistently (raw values like 100 must not be compared to 2/1).
  const all = [...prev.map((v) => (v - mean) / sd).slice(-9), z];
  const violations: string[] = [];

  if (Math.abs(z) > 3) violations.push('1:3s');
  else if (Math.abs(z) > 2) violations.push('1:2s');

  if (all.length >= 2) {
    const [a, b] = all.slice(-2);
    if ((a > 2 && b > 2) || (a < -2 && b < -2)) violations.push('2:2s');
    if ((a > 2 && b < -2) || (a < -2 && b > 2)) violations.push('R:4s');
  }
  if (all.length >= 4) {
    const last4 = all.slice(-4);
    if (last4.every((x) => x > 1) || last4.every((x) => x < -1)) violations.push('4:1s');
  }
  if (all.length >= 10) {
    const last10 = all.slice(-10);
    if (last10.every((x) => x > 0) || last10.every((x) => x < 0)) violations.push('10x');
  }

  const unique = [...new Set(violations)];
  const rejectRules = new Set(['1:3s', '2:2s', 'R:4s', '4:1s', '10x']);
  const status: QcStatus = unique.some((r) => rejectRules.has(r))
    ? 'REJECT'
    : unique.length > 0
      ? 'WARN'
      : 'PASS';
  return { status, violations: unique, sdDeviation: Math.round(z * 100) / 100 };
}

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable()
export class QcService {
  constructor(private prisma: PrismaService) {}

  async findControls(orgId: string, search?: string): Promise<QcControlRow[]> {
    const controls = await this.prisma.client.qcControl.findMany({
      where: {
        tenantId: orgId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { testName: { contains: search, mode: 'insensitive' } },
                { testCode: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { runs: true } } },
      orderBy: [{ testName: 'asc' }, { level: 'asc' }],
    });
    return controls.map((c) => ({
      id: c.id,
      testName: c.testName,
      testCode: c.testCode,
      level: c.level as QcLevel,
      name: c.name,
      unit: c.unit,
      assignedMean: Number(c.assignedMean),
      assignedSd: Number(c.assignedSd),
      isActive: c.isActive,
      runCount: c._count.runs,
    }));
  }

  async createControl(orgId: string, _userId: string, dto: CreateQcControlDto): Promise<QcControlRow> {
    const testName = dto.testName.trim();
    if (!testName) throw new BadRequestException('testName is required');
    if (!Number.isFinite(dto.assignedMean)) throw new BadRequestException('assignedMean is required');
    if (!Number.isFinite(dto.assignedSd) || dto.assignedSd <= 0) {
      throw new BadRequestException('assignedSd must be a positive number');
    }
    const level = dto.level ?? 'NORMAL';
    const name = dto.testCode
      ? `${dto.testCode} ${level} Control`
      : `${testName} ${level} Control`;

    const dup = await this.prisma.client.qcControl.findFirst({
      where: { tenantId: orgId, testName, level },
    });
    if (dup) throw new BadRequestException(`A ${level} control already exists for ${testName}`);

    const c = await this.prisma.client.qcControl.create({
      data: {
        tenantId: orgId,
        testName,
        testCode: dto.testCode?.trim() || null,
        level,
        name,
        unit: dto.unit?.trim() || null,
        assignedMean: dto.assignedMean,
        assignedSd: dto.assignedSd,
      },
    });
    return {
      id: c.id,
      testName: c.testName,
      testCode: c.testCode,
      level: c.level as QcLevel,
      name: c.name,
      unit: c.unit,
      assignedMean: Number(c.assignedMean),
      assignedSd: Number(c.assignedSd),
      isActive: c.isActive,
      runCount: 0,
    };
  }

  async listRuns(orgId: string, controlId?: string, limit?: number): Promise<QcRunRow[]> {
    const take = Number.isFinite(Number(limit))
      ? Math.min(Math.max(Math.floor(Number(limit)), 1), 200)
      : 50;
    const runs = await this.prisma.client.qcRun.findMany({
      where: { tenantId: orgId, ...(controlId ? { controlId } : {}) },
      include: { control: { select: { name: true, testName: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return runs.map((r) => ({
      id: r.id,
      controlId: r.controlId,
      controlName: r.control.name,
      testName: r.control.testName,
      measuredValue: Number(r.measuredValue),
      sdDeviation: r.sdDeviation === null ? null : Number(r.sdDeviation),
      status: r.status as QcStatus,
      violations: Array.isArray(r.violations) ? (r.violations as string[]) : [],
      note: r.note,
      runDate: r.runDate,
    }));
  }

  async enterRun(orgId: string, userId: string, dto: EnterQcRunDto) {
    if (!Number.isFinite(dto.value)) throw new BadRequestException('value is required');
    const control = await this.prisma.client.qcControl.findFirst({
      where: { id: dto.controlId, tenantId: orgId },
    });
    if (!control) throw new NotFoundException('Control not found');

    const mean = Number(control.assignedMean);
    const sd = Number(control.assignedSd);
    const prevRuns = await this.prisma.client.qcRun.findMany({
      where: { tenantId: orgId, controlId: control.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { measuredValue: true },
    });
    const prev = prevRuns.map((p) => Number(p.measuredValue));
    const evalResult = evaluateWestgard(mean, sd, dto.value, prev);

    const run = await this.prisma.client.qcRun.create({
      data: {
        tenantId: orgId,
        controlId: control.id,
        measuredValue: dto.value,
        sdDeviation: evalResult.sdDeviation,
        status: evalResult.status,
        violations: evalResult.violations.length > 0 ? evalResult.violations : undefined,
        note: dto.note?.trim() || null,
        enteredById: userId,
      },
    });

    return {
      run: {
        id: run.id,
        controlId: run.controlId,
        measuredValue: Number(run.measuredValue),
        sdDeviation: run.sdDeviation === null ? null : Number(run.sdDeviation),
        status: run.status as QcStatus,
        violations: Array.isArray(run.violations) ? (run.violations as string[]) : [],
        note: run.note,
        runDate: run.runDate,
      },
      control: { id: control.id, name: control.name, testName: control.testName, unit: control.unit, mean, sd },
      evaluation: evalResult,
    };
  }

  async summary(orgId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const controls = await this.prisma.client.qcControl.count({ where: { tenantId: orgId } });
    const todayRuns = await this.prisma.client.qcRun.findMany({
      where: { tenantId: orgId, createdAt: { gte: start } },
      select: { status: true },
    });
    const byStatus = { PASS: 0, WARN: 0, REJECT: 0 };
    for (const r of todayRuns) {
      const s = r.status as QcStatus;
      if (s in byStatus) byStatus[s]++;
    }
    const latest = await this.prisma.client.qcRun.findFirst({
      where: { tenantId: orgId },
      include: { control: { select: { name: true, testName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      controls,
      today: { runs: todayRuns.length, ...byStatus },
      latest: latest
        ? {
            id: latest.id,
            controlName: latest.control.name,
            testName: latest.control.testName,
            measuredValue: Number(latest.measuredValue),
            status: latest.status as QcStatus,
            violations: Array.isArray(latest.violations) ? (latest.violations as string[]) : [],
            runDate: latest.runDate,
          }
        : null,
    };
  }
}
