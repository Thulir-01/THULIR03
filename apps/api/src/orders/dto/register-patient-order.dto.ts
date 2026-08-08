import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Validated DTO for `POST /orders/register`.
 *
 * This used to be a plain TypeScript interface. Interfaces have no runtime
 * metadata, so the global `ValidationPipe` silently skipped them and billing
 * fields (`discountPercent`, `otherCharges`, `amountPaid`) arrived completely
 * unchecked — e.g. `discountPercent: 500` produced a negative bill on a
 * printed legal tax invoice. As a class with class-validator decorators the
 * pipe now rejects invalid financial values with a 400 before the service
 * runs, and `whitelist`/`forbidNonWhitelisted` strip or reject unknown keys.
 */
export class RegisterOrderTestDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  rate: number;
}

export class RegisterPatientOrderDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ageYears?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ageMonths?: number;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  referrer?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  insurance?: string;

  @IsOptional()
  @IsString()
  collectionBoy?: string;

  @IsOptional()
  @IsString()
  patientType?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  ipOpNo?: string;

  @IsOptional()
  @IsString()
  bedNo?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  sidDate?: string;

  @IsOptional()
  @IsString()
  refNo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RegisterOrderTestDto)
  tests: RegisterOrderTestDto[];

  @IsOptional()
  @IsString()
  sampleCollectDate?: string;

  /** Billing — the fields that previously bypassed all validation. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  otherCharges?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsString()
  discountAuth?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @IsOptional()
  @IsString()
  paymentMode?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  paymentRef?: string;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  paymentRemarks?: string;

  @IsOptional()
  @IsString()
  deliveryMode?: string;

  @IsOptional()
  @IsString()
  clinicalRemarks?: string;

  @IsOptional()
  @IsBoolean()
  emergency?: boolean;

  @IsOptional()
  @IsString()
  finalReportDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsBoolean()
  billHf?: boolean;

  @IsOptional()
  @IsBoolean()
  consolidatedBill?: boolean;
}
