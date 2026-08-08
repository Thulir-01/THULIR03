import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  organizationId: string;
  /** 'mfa' tokens are short-lived login challenges, never bearer credentials. */
  type: 'access' | 'refresh' | 'mfa';
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Normalize the email so the same address can't be registered twice
    // with different casing (findUnique on email is case-sensitive).
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.client.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    let org = await this.prisma.client.organization.findFirst({
      where: { slug: dto.organizationSlug || 'default' },
    });
    if (!org) {
      org = await this.prisma.client.organization.create({
        data: {
          name: dto.organizationName || 'Default Lab',
          slug: dto.organizationSlug || 'default',
        },
      });
    }

    let role = await this.prisma.client.role.findFirst({
      where: { slug: 'lab_admin' },
    });
    if (!role) {
      role = await this.prisma.client.role.create({
        data: {
          name: 'Lab Admin',
          slug: 'lab_admin',
          description: 'Full access to lab operations',
          isSystem: true,
        },
      });
      await this.prisma.client.role.createMany({
        data: [
          {
            name: 'Pathologist',
            slug: 'pathologist',
            description: 'Result verification & reporting',
            isSystem: true,
          },
          {
            name: 'Technician',
            slug: 'technician',
            description: 'Sample processing & result entry',
            isSystem: true,
          },
          {
            name: 'Lab Manager',
            slug: 'lab_manager',
            description: 'Operations management',
            isSystem: true,
          },
          {
            name: 'Receptionist',
            slug: 'receptionist',
            description: 'Patient registration & billing',
            isSystem: true,
          },
        ],
      });
    }

    const user = await this.prisma.client.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        organizationId: org.id,
        roleId: role.id,
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    return this.generateTokens(user.id, user.email, role.slug, org.id);
  }

  async login(dto: LoginDto) {
    // Case-insensitive lookup: Gmail-style addresses are case-insensitive,
    // and autofill often capitalizes the stored lowercase email.
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.client.user.findUnique({
      where: { email },
      include: { role: true, organization: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // MFA gate: when TOTP is enabled, the password alone must NOT mint
    // tokens. Issue a short-lived, single-purpose challenge token instead;
    // the real access/refresh pair is only minted after /auth/totp/verify-login
    // presents a valid code from the authenticator app.
    if (user.totpEnabled && user.totpSecret) {
      const mfaToken = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role?.slug || 'unknown',
          organizationId: user.organizationId,
          type: 'mfa' as const,
        },
        { expiresIn: '2m' },
      );
      return { requiresTotp: true, mfaToken };
    }

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(
      user.id,
      user.email,
      user.role?.slug || 'unknown',
      user.organizationId,
    );
  }

  /**
   * Second step of login for TOTP-enabled accounts. Verifies the short-lived
   * challenge token from step 1 AND the TOTP code; only then are the real
   * access/refresh tokens minted. Brute-force protection lives on the route
   * (@Throttle) and in the code's short validity window.
   */
  async completeMfaLogin(mfaToken: string, token: string) {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(mfaToken);
    } catch {
      throw new UnauthorizedException('MFA session expired — sign in again');
    }
    if (payload.type !== 'mfa') {
      throw new UnauthorizedException('Invalid MFA session');
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    if (!user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('MFA is not configured for this account');
    }

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
    if (!verified) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.generateTokens(
      user.id,
      user.email,
      user.role?.slug || 'unknown',
      user.organizationId,
    );
  }

  async getProfile(userId: string) {
    return this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        totpEnabled: true,
        lastLoginAt: true,
        role: { select: { id: true, name: true, slug: true } },
        organization: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async generateTotpSecret(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new BadRequestException('User not found');

    const secret = speakeasy.generateSecret({
      name: `THULIR03:${user.email}`,
    });

    const otpauthUrl = secret.otpauth_url ?? '';
    const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);
    const base32Secret = secret.base32 ?? '';
    return { secret: base32Secret, qrCodeUrl };
  }

  async enableTotp(userId: string, token: string, secret: string) {
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });
    if (!verified) {
      throw new BadRequestException('Invalid TOTP token');
    }
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpEnabled: true },
    });
    return { message: 'TOTP enabled successfully' };
  }

  async verifyTotp(userId: string, token: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });
    if (!user?.totpSecret) {
      throw new BadRequestException('TOTP not configured');
    }
    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
    return { verified };
  }

  private generateTokens(
    userId: string,
    email: string,
    role: string,
    organizationId: string,
  ) {
    // Distinct token types: an access token can never be replayed against
    // /auth/refresh (and a refresh token can never be used as a bearer token).
    const base: Omit<TokenPayload, 'type'> = {
      sub: userId,
      email,
      role,
      organizationId,
    };

    const accessToken = this.jwtService.sign(
      { ...base, type: 'access' as const },
      { expiresIn: '15m' },
    );
    const refreshToken = this.jwtService.sign(
      { ...base, type: 'refresh' as const },
      { expiresIn: '7d' },
    );

    return { accessToken, refreshToken, user: { id: userId, email, role } };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify<TokenPayload>(token);
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const user = await this.prisma.client.user.findUnique({
        where: { id: payload.sub },
        include: { role: true },
      });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }
      return this.generateTokens(
        user.id,
        user.email,
        user.role?.slug || 'unknown',
        user.organizationId,
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
