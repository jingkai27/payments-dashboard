import request from 'supertest';
import { createApp } from '../../app';
import * as database from '../../shared/database';

// Mock database functions
jest.mock('../../shared/database', () => ({
  checkDatabaseHealth: jest.fn(),
  checkRedisHealth: jest.fn(),
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    env: {
      NODE_ENV: 'test',
      PORT: 3000,
      CORS_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test-secret-key-at-least-32-chars',
      ENCRYPTION_KEY: 'test-encryption-key-32-chars-ok',
      RATE_LIMIT_WINDOW_MS: 900000,
      RATE_LIMIT_MAX_REQUESTS: 100,
      LOG_LEVEL: 'error',
    },
    isDevelopment: false,
    isProduction: false,
    isTest: true,
  },
}));

describe('Health Routes', () => {
  const app = createApp();

  describe('GET /api/v1/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('should return ready when all services are up', async () => {
      (database.checkDatabaseHealth as jest.Mock).mockResolvedValue(true);
      (database.checkRedisHealth as jest.Mock).mockResolvedValue(true);

      const response = await request(app).get('/api/v1/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body.checks.database.status).toBe('up');
      expect(response.body.checks.redis.status).toBe('up');
    });

    it('should return not_ready when database is down', async () => {
      (database.checkDatabaseHealth as jest.Mock).mockResolvedValue(false);
      (database.checkRedisHealth as jest.Mock).mockResolvedValue(true);

      const response = await request(app).get('/api/v1/health/ready');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'not_ready');
      expect(response.body.checks.database.status).toBe('down');
      expect(response.body.checks.redis.status).toBe('up');
    });

    it('should return not_ready when redis is down', async () => {
      (database.checkDatabaseHealth as jest.Mock).mockResolvedValue(true);
      (database.checkRedisHealth as jest.Mock).mockResolvedValue(false);

      const response = await request(app).get('/api/v1/health/ready');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'not_ready');
      expect(response.body.checks.database.status).toBe('up');
      expect(response.body.checks.redis.status).toBe('down');
    });
  });
});
