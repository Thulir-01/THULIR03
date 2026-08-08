import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Second step of the login flow — a short-lived MFA challenge + TOTP code. */
export class MfaLoginDto {
  @ApiProperty({
    description:
      'Short-lived challenge token returned by /auth/login when the account has TOTP enabled',
  })
  @IsString()
  mfaToken: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 8)
  token: string;
}
