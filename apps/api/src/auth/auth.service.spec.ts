/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: { verify: jest.fn() },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,QR'),
}));

describe('AuthService', () => {
  let service: AuthService;

  const userFindUnique = jest.fn();
  const userCreate = jest.fn();
  const userUpdate = jest.fn();
  const orgFindFirst = jest.fn();
  const orgCreate = jest.fn();
  const roleFindFirst = jest.fn();
  const roleCreate = jest.fn();
  const roleCreateMany = jest.fn();
  const jwtSign = jest.fn();
  const jwtVerify = jest.fn();

  const prismaMock = {
    client: {
      user: {
        findUnique: userFindUnique,
        create: userCreate,
        update: userUpdate,
      },
      organization: { findFirst: orgFindFirst, create: orgCreate },
      role: {
        findFirst: roleFindFirst,
        create: roleCreate,
        createMany: roleCreateMany,
      },
    },
  } as unknown as PrismaService;

  const jwtMock = {
    sign: jwtSign,
    verify: jwtVerify,
  } as unknown as JwtService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    const dto = {
      email: 'new@lab.com',
      password: 'Secret@123',
      firstName: 'New',
      lastName: 'User',
      phone: '+91 90000 00000',
    } as unknown as RegisterDto;

    it('rejects duplicate emails', async () => {
      userFindUnique.mockResolvedValue({ id: 'u1' });
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('creates org, system role and user, then returns tokens', async () => {
      userFindUnique.mockResolvedValue(null);
      orgFindFirst.mockResolvedValue(null);
      orgCreate.mockResolvedValue({ id: 'org-1' });
      roleFindFirst.mockResolvedValue(null);
      roleCreate.mockResolvedValue({ id: 'role-1', slug: 'lab_admin' });
      roleCreateMany.mockResolvedValue({ count: 5 });
      userCreate.mockResolvedValue({ id: 'user-1' });
      jwtSign.mockReturnValue('signed-token');

      const result = await service.register(dto);

      expect(userCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new@lab.com',
            organizationId: 'org-1',
            roleId: 'role-1',
          }),
        }),
      );
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(jwtSign).toHaveBeenCalledTimes(2);
    });
  });

  describe('login', () => {
    const dto = { email: 'a@lab.com', password: 'wrong' };

    it('rejects unknown email', async () => {
      userFindUnique.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects wrong password', async () => {
      userFindUnique.mockResolvedValue({
        id: 'u1',
        passwordHash: 'hash',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens and records lastLoginAt on success', async () => {
      userFindUnique.mockResolvedValue({
        id: 'u1',
        passwordHash: 'hash',
        isActive: true,
        role: { slug: 'lab_admin' },
        organizationId: 'org-1',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtSign.mockReturnValue('signed-token');

      const result = await service.login(dto);

      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        }),
      );
      expect(result.user.role).toBe('lab_admin');
    });
  });

  describe('refreshToken', () => {
    it('rejects an invalid refresh token', async () => {
      jwtVerify.mockImplementation(() => {
        throw new Error('jwt expired');
      });
      await expect(service.refreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a refresh token for a deactivated user', async () => {
      jwtVerify.mockReturnValue({ sub: 'u1', type: 'refresh' });
      userFindUnique.mockResolvedValue({ id: 'u1', isActive: false });
      await expect(service.refreshToken('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('issues a fresh token pair for a valid refresh token', async () => {
      jwtVerify.mockReturnValue({
        sub: 'u1',
        email: 'a@lab.com',
        type: 'refresh',
      });
      userFindUnique.mockResolvedValue({
        id: 'u1',
        isActive: true,
        role: { slug: 'lab_admin' },
        organizationId: 'org-1',
      });
      jwtSign.mockReturnValue('fresh-token');

      const result = await service.refreshToken('valid-token');
      expect(result.accessToken).toBe('fresh-token');
      expect(jwtSign).toHaveBeenCalledTimes(2);
    });
  });

  describe('TOTP MFA', () => {
    it('generateTotpSecret returns a base32 secret and QR code', async () => {
      userFindUnique.mockResolvedValue({ id: 'u1', email: 'a@lab.com' });
      (speakeasy.generateSecret as jest.Mock).mockReturnValue({
        base32: 'SECRETBASE32',
        otpauth_url: 'otpauth://totp/THULIR03:a@lab.com?secret=SECRETBASE32',
      });

      const result = await service.generateTotpSecret('u1');

      expect(result.secret).toBe('SECRETBASE32');
      expect(result.qrCodeUrl).toContain('data:image/png;base64');
    });

    it('enableTotp rejects an invalid TOTP token', async () => {
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);
      await expect(
        service.enableTotp('u1', '000000', 'SECRETBASE32'),
      ).rejects.toThrow(BadRequestException);
    });

    it('enableTotp persists the secret when the token verifies', async () => {
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
      userUpdate.mockResolvedValue({ id: 'u1' });

      const result = await service.enableTotp('u1', '123456', 'SECRETBASE32');

      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({
            totpSecret: 'SECRETBASE32',
            totpEnabled: true,
          }),
        }),
      );
      expect(result.message).toContain('enabled');
    });

    it('verifyTotp fails when TOTP is not configured', async () => {
      userFindUnique.mockResolvedValue({ id: 'u1', totpSecret: null });
      await expect(service.verifyTotp('u1', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('verifyTotp returns verification result', async () => {
      userFindUnique.mockResolvedValue({
        id: 'u1',
        totpSecret: 'SECRETBASE32',
      });
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const result = await service.verifyTotp('u1', '123456');
      expect(result.verified).toBe(true);
    });
  });
});
