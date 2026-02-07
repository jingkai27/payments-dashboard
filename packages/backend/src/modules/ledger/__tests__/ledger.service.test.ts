import { LedgerService } from '../ledger.service';
import { LedgerError, AccountCode } from '../ledger.types';

// Must use jest.fn() directly inside the mock factory due to hoisting
jest.mock('../../../shared/database/prisma', () => ({
  prisma: {
    transaction: {
      findUnique: jest.fn(),
    },
    ledgerEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../shared/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../config', () => ({
  config: { env: { NODE_ENV: 'test', LOG_LEVEL: 'error' } },
}));

// Import after mock
import { prisma } from '../../../shared/database/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('LedgerService', () => {
  let service: LedgerService;

  beforeEach(() => {
    jest.clearAllMocks();
    (LedgerService as any).instance = null;
    service = LedgerService.getInstance();
  });

  describe('recordEntries', () => {
    it('should create balanced ledger entries', async () => {
      const transactionId = 'txn-123';

      (mockPrisma.transaction.findUnique as jest.Mock).mockResolvedValue({
        id: transactionId,
        merchantId: 'merchant-1',
      });

      const entry1 = {
        id: 'entry-1', transactionId, accountCode: AccountCode.CASH,
        entryType: 'DEBIT', amount: 1000n, currency: 'USD',
        balance: null, description: 'Payment', metadata: {}, createdAt: new Date(),
      };
      const entry2 = {
        id: 'entry-2', transactionId, accountCode: AccountCode.MERCHANT_PAYABLE,
        entryType: 'CREDIT', amount: 1000n, currency: 'USD',
        balance: null, description: 'Payable', metadata: {}, createdAt: new Date(),
      };

      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([entry1, entry2]);

      const result = await service.recordEntries(transactionId, [
        { transactionId, accountCode: AccountCode.CASH, entryType: 'DEBIT' as const, amount: 1000n, currency: 'USD' as const, description: 'Payment' },
        { transactionId, accountCode: AccountCode.MERCHANT_PAYABLE, entryType: 'CREDIT' as const, amount: 1000n, currency: 'USD' as const, description: 'Payable' },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]!.entryType).toBe('DEBIT');
      expect(result[1]!.entryType).toBe('CREDIT');
    });

    it('should throw when transaction not found', async () => {
      (mockPrisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.recordEntries('nonexistent', [])).rejects.toThrow(LedgerError);
    });

    it('should throw when entries are not balanced', async () => {
      (mockPrisma.transaction.findUnique as jest.Mock).mockResolvedValue({ id: 'txn-123' });

      await expect(
        service.recordEntries('txn-123', [
          { transactionId: 'txn-123', accountCode: '1000', entryType: 'DEBIT' as const, amount: 1000n, currency: 'USD' as const },
          { transactionId: 'txn-123', accountCode: '2100', entryType: 'CREDIT' as const, amount: 500n, currency: 'USD' as const },
        ])
      ).rejects.toThrow('not balanced');
    });
  });

  describe('getAccountBalance', () => {
    it('should compute balance from grouped entries', async () => {
      (mockPrisma.ledgerEntry.groupBy as jest.Mock).mockResolvedValue([
        { currency: 'USD', entryType: 'DEBIT', _sum: { amount: 5000n } },
        { currency: 'USD', entryType: 'CREDIT', _sum: { amount: 3000n } },
      ]);

      const balances = await service.getAccountBalance(AccountCode.CASH);

      expect(balances).toHaveLength(1);
      expect(balances[0]!.balance).toBe(2000n);
      expect(balances[0]!.debitTotal).toBe(5000n);
      expect(balances[0]!.creditTotal).toBe(3000n);
    });

    it('should return empty array when no entries', async () => {
      (mockPrisma.ledgerEntry.groupBy as jest.Mock).mockResolvedValue([]);
      const balances = await service.getAccountBalance(AccountCode.CASH);
      expect(balances).toHaveLength(0);
    });
  });

  describe('getLedgerSummary', () => {
    it('should report balanced ledger', async () => {
      (mockPrisma.ledgerEntry.groupBy as jest.Mock).mockResolvedValue([
        { accountCode: '1000', currency: 'USD', entryType: 'DEBIT', _sum: { amount: 5000n } },
        { accountCode: '2100', currency: 'USD', entryType: 'CREDIT', _sum: { amount: 5000n } },
      ]);

      const summary = await service.getLedgerSummary();
      expect(summary.isBalanced).toBe(true);
      expect(summary.totalDebits).toBe(5000n);
      expect(summary.totalCredits).toBe(5000n);
    });

    it('should report unbalanced ledger', async () => {
      (mockPrisma.ledgerEntry.groupBy as jest.Mock).mockResolvedValue([
        { accountCode: '1000', currency: 'USD', entryType: 'DEBIT', _sum: { amount: 5000n } },
        { accountCode: '2100', currency: 'USD', entryType: 'CREDIT', _sum: { amount: 3000n } },
      ]);

      const summary = await service.getLedgerSummary();
      expect(summary.isBalanced).toBe(false);
    });
  });

  describe('listEntries', () => {
    it('should list entries with pagination', async () => {
      (mockPrisma.ledgerEntry.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.ledgerEntry.count as jest.Mock).mockResolvedValue(0);

      const result = await service.listEntries({ page: 1, limit: 20 });
      expect(result.entries).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });
});
