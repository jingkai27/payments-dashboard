import { Router, Request, Response } from 'express';
import { checkDatabaseHealth, checkRedisHealth } from '../shared/database/index.js';

const router = Router();

interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
}

interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  timestamp: string;
  checks: {
    database: {
      status: 'up' | 'down';
      latency?: number;
    };
    redis: {
      status: 'up' | 'down';
      latency?: number;
    };
  };
}

// GET /api/v1/health - Basic health check
router.get('/', (_req: Request, res: Response) => {
  const response: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] ?? '1.0.0',
    uptime: process.uptime(),
  };

  res.status(200).json(response);
});

// GET /api/v1/health/ready - Readiness check (DB + Redis)
router.get('/ready', async (_req: Request, res: Response) => {
  const dbStart = Date.now();
  const dbHealthy = await checkDatabaseHealth();
  const dbLatency = Date.now() - dbStart;

  const redisStart = Date.now();
  const redisHealthy = await checkRedisHealth();
  const redisLatency = Date.now() - redisStart;

  const isReady = dbHealthy && redisHealthy;

  const response: ReadinessResponse = {
    status: isReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: dbHealthy ? 'up' : 'down',
        latency: dbHealthy ? dbLatency : undefined,
      },
      redis: {
        status: redisHealthy ? 'up' : 'down',
        latency: redisHealthy ? redisLatency : undefined,
      },
    },
  };

  res.status(isReady ? 200 : 503).json(response);
});

export default router;
