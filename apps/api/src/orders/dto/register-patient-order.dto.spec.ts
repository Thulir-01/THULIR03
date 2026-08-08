import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterPatientOrderDto } from './register-patient-order.dto';

/**
 * Bug #2 regression suite. The old DTO was a plain interface with no runtime
 * metadata, so the ValidationPipe never checked billing fields — a
 * discountPercent of 500 produced a negative bill. These tests run the exact
 * class-validator pipeline the ValidationPipe uses (plainToInstance + validate)
 * and prove the financial fields are now rejected server-side.
 */
describe('RegisterPatientOrderDto (billing validation)', () => {
  const validPayload = () => ({
    firstName: 'Ravi',
    lastName: 'Kumar',
    ageYears: 45,
    gender: 'Male',
    tests: [{ code: 'HEM', name: 'Hemoglobin', rate: 100 }],
    otherCharges: 0,
    discountPercent: 10,
    amountPaid: 90,
    paymentMode: 'cash',
    emergency: false,
  });

  const validatePayload = (overrides: Record<string, unknown>) =>
    validate(
      plainToInstance(RegisterPatientOrderDto, {
        ...validPayload(),
        ...overrides,
      }),
    );

  it('accepts a well-formed registration payload', async () => {
    const errors = await validatePayload({});
    expect(errors).toEqual([]);
  });

  it('rejects discountPercent above 100 (would drive the bill negative)', async () => {
    const errors = await validatePayload({ discountPercent: 500 });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('discountPercent');
    expect(Object.keys(errors[0].constraints ?? {})).toContain('max');
  });

  it('rejects a negative discountPercent', async () => {
    const errors = await validatePayload({ discountPercent: -5 });
    expect(errors.some((e) => e.property === 'discountPercent')).toBe(true);
  });

  it('rejects negative otherCharges', async () => {
    const errors = await validatePayload({ otherCharges: -5 });
    expect(errors.some((e) => e.property === 'otherCharges')).toBe(true);
  });

  it('rejects a negative amountPaid', async () => {
    const errors = await validatePayload({ amountPaid: -1 });
    expect(errors.some((e) => e.property === 'amountPaid')).toBe(true);
  });

  it('rejects an order with no tests', async () => {
    const errors = await validatePayload({ tests: [] });
    expect(errors.some((e) => e.property === 'tests')).toBe(true);
  });

  it('rejects a negative test rate', async () => {
    const errors = await validatePayload({
      tests: [{ code: 'HEM', name: 'Hemoglobin', rate: -10 }],
    });
    expect(errors.some((e) => e.property === 'tests')).toBe(true);
  });
});
