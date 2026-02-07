import { MerchantService } from '../merchant.service';
import { MerchantError } from '../merchant.types';

jest.mock('../../../shared/database/prisma', () => ({
  prisma: {
    merchant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('../../../shared/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../config', () => ({
  config: { env: { NODE_ENV: 'test', LOG_LEVEL: 'error' } },
}));

import { prisma } from '../../../shared/database/prisma';

describe('MerchantService', () => {
  let service: MerchantService;

  beforeEach(() => {
    jest.clearAllMocks();
    (MerchantService as any).instance = null;
    service = MerchantService.getInstance();
  });

  describe('createMerchant', () => {
    it('should create a merchant', async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.merchant.create as jest.Mock).mockResolvedValue({
        id: 'm-1', name: 'Test Corp', legalName: 'Test Corporation Ltd',
        email: 'test@corp.com', defaultCurrency: 'USD', settings: {},
        metadata: {}, isActive: true, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.createMerchant({
        name: 'Test Corp', legalName: 'Test Corporation Ltd', email: 'test@corp.com',
      });

      expect(result.name).toBe('Test Corp');
      expect(result.email).toBe('test@corp.com');
    });

    it('should throw when email already exists', async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(
        service.createMerchant({ name: 'Test', legalName: 'Test Ltd', email: 'existing@corp.com' })
      ).rejects.toThrow(MerchantError);
    });
  });

  describe('getMerchant', () => {
    it('should return merchant when found', async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
        id: 'm-1', name: 'Test', legalName: 'Test Ltd', email: 'test@corp.com',
        defaultCurrency: 'USD', settings: {}, metadata: {}, isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.getMerchant('m-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('m-1');
    });

    it('should return null when not found', async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await service.getMerchant('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listMerchants', () => {
    it('should return paginated results', async () => {
      (prisma.merchant.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.merchant.count as jest.Mock).mockResolvedValue(0);

      const result = await service.listMerchants({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(0);
      expect(result.pagination.page).toBe(1);
    });
  });

  describe('createCustomer', () => {
    it('should create a customer for a merchant', async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({ id: 'm-1' });
      (prisma.customer.create as jest.Mock).mockResolvedValue({
        id: 'c-1', merchantId: 'm-1', externalId: 'ext-123',
        email: 'customer@test.com', name: 'Jane Doe', metadata: {},
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.createCustomer({
        merchantId: 'm-1', externalId: 'ext-123',
        email: 'customer@test.com', name: 'Jane Doe',
      });

      expect(result.merchantId).toBe('m-1');
      expect(result.email).toBe('customer@test.com');
    });

    it('should throw when merchant not found', async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createCustomer({ merchantId: 'nonexistent' })
      ).rejects.toThrow(MerchantError);
    });
  });

  describe('updateMerchant', () => {
    it('should update merchant fields', async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue({
        id: 'm-1', email: 'old@corp.com',
      });
      (prisma.merchant.update as jest.Mock).mockResolvedValue({
        id: 'm-1', name: 'Updated Corp', legalName: 'Updated Corp Ltd',
        email: 'old@corp.com', defaultCurrency: 'EUR', settings: {},
        metadata: {}, isActive: true, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.updateMerchant('m-1', { name: 'Updated Corp', defaultCurrency: 'EUR' });
      expect(result.name).toBe('Updated Corp');
    });

    it('should throw when merchant not found', async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateMerchant('nonexistent', { name: 'test' })
      ).rejects.toThrow(MerchantError);
    });
  });
});
