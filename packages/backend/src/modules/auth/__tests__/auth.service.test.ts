import { AuthService } from '../auth.service';
import { AuthError } from '../auth.types';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn(),
}));

jest.mock('../../../shared/database/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../../config', () => ({
  config: {
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-at-least-32-chars-long',
      LOG_LEVEL: 'error',
    },
  },
}));

jest.mock('../../../shared/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../shared/database/prisma';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    (AuthService as any).instance = null;
    service = AuthService.getInstance();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-1', email: 'test@example.com', passwordHash: 'hashed-password',
        firstName: 'John', lastName: 'Doe', role: 'VIEWER', isActive: true,
        lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.register({
        email: 'test@example.com', password: 'password123',
        firstName: 'John', lastName: 'Doe',
      });

      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
    });

    it('should throw when email already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          email: 'test@example.com', password: 'password123',
          firstName: 'John', lastName: 'Doe',
        })
      ).rejects.toThrow(AuthError);
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1', email: 'test@example.com', passwordHash: 'hashed-password',
        firstName: 'John', lastName: 'Doe', role: 'VIEWER', isActive: true,
        lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.login({ email: 'test@example.com', password: 'password123' });

      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw for invalid password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1', email: 'test@example.com', passwordHash: 'hashed-password',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({ email: 'nope@example.com', password: 'password123' })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw for disabled account', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1', email: 'test@example.com', passwordHash: 'hashed',
        isActive: false,
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'password123' })
      ).rejects.toThrow('Account is disabled');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const payload = { userId: 'user-1', email: 'test@example.com', role: 'VIEWER' };
      (jwt.verify as jest.Mock).mockReturnValue(payload);

      const result = service.verifyToken('valid-token');
      expect(result).toEqual(payload);
    });

    it('should throw for invalid token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('invalid'); });

      expect(() => service.verifyToken('bad')).toThrow('Invalid or expired token');
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1', email: 'test@example.com', firstName: 'John',
        lastName: 'Doe', role: 'VIEWER', isActive: true,
        lastLoginAt: null, createdAt: new Date(),
      });

      const result = await service.getProfile('user-1');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw when user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(AuthError);
    });
  });
});
