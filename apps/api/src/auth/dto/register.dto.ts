import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'admin@thulir03.com' })
  @IsEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Krishna' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Moorthi' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: '+919999999999' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'city-lab' })
  @IsString()
  @IsOptional()
  organizationSlug?: string;

  @ApiPropertyOptional({ example: 'City Diagnostic Lab' })
  @IsString()
  @IsOptional()
  organizationName?: string;
}
