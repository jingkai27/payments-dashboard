import { PaymentMethodService } from '../payment-method.service';
import { PaymentMethodError } from '../payment-method.types';

jest.mock('../../../shared/database/prisma', () => ({
  prisma: {
    customer: { findUnique: jest.fn() },
    paymentMethod: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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

describe('PaymentMethodService', () => {
  let service: PaymentMethodService;

  beforeEach(() => {
    jest.clearAllMocks();
    (PaymentMethodService as any).instance = null;
    service = PaymentMethodService.getInstance();
  });

  describe('create', () => {
    it('should create a card payment method', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: 'c-1' });
      (prisma.paymentMethod.create as jest.Mock).mockResolvedValue({
        id: 'pm-1', customerId: 'c-1', type: 'CARD', token: 'tok_test',
        last4: '4242', expiryMonth: 12, expiryYear: 2026, brand: 'visa',
        bankName: null, walletProvider: null, isDefault: false, isActive: true,
        metadata: {}, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.create({
        customerId: 'c-1', type: 'CARD',
        cardNumber: '4242424242424242', expiryMonth: 12, expiryYear: 2026,
      });

      expect(result.type).toBe('CARD');
      expect(result.last4).toBe('4242');
    });

    it('should throw when customer not found', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create({ customerId: 'nonexistent', type: 'CARD' })
      ).rejects.toThrow(PaymentMethodError);
    });

    it('should set as default and unset others', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: 'c-1' });
      (prisma.paymentMethod.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.paymentMethod.create as jest.Mock).mockResolvedValue({
        id: 'pm-1', customerId: 'c-1', type: 'CARD', token: 'tok_test',
        last4: null, expiryMonth: null, expiryYear: null, brand: null,
        bankName: null, walletProvider: null, isDefault: true, isActive: true,
        metadata: {}, createdAt: new Date(), updatedAt: new Date(),
      });

      await service.create({ customerId: 'c-1', type: 'CARD', isDefault: true });

      expect(prisma.paymentMethod.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'c-1', isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('deactivate', () => {
    it('should deactivate a payment method', async () => {
      (prisma.paymentMethod.findUnique as jest.Mock).mockResolvedValue({
        id: 'pm-1', customerId: 'c-1',
      });
      (prisma.paymentMethod.update as jest.Mock).mockResolvedValue({
        id: 'pm-1', customerId: 'c-1', type: 'CARD', token: 'tok_test',
        last4: '4242', expiryMonth: 12, expiryYear: 2026, brand: 'visa',
        bankName: null, walletProvider: null, isDefault: false, isActive: false,
        metadata: {}, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.deactivate('pm-1');
      expect(result.isActive).toBe(false);
    });

    it('should throw when payment method not found', async () => {
      (prisma.paymentMethod.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deactivate('nonexistent')).rejects.toThrow(PaymentMethodError);
    });
  });

  describe('list', () => {
    it('should list payment methods with pagination', async () => {
      (prisma.paymentMethod.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentMethod.count as jest.Mock).mockResolvedValue(0);

      const result = await service.list({ customerId: 'c-1', page: 1, limit: 20 });
      expect(result.paymentMethods).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });
});
