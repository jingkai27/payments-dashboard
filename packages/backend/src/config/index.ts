import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // FX Service
  FX_PROVIDER_API_KEY: z.string().optional(),
  FX_PROVIDER_BASE_URL: z.string().default('https://v6.exchangerate-api.com/v6'),
  FX_DEFAULT_SPREAD: z.string().transform(Number).default('0.005'),
  FX_CACHE_TTL_SECONDS: z.string().transform(Number).default('3600'),
  FX_RATE_VALIDITY_MINUTES: z.string().transform(Number).default('15'),

  // Provider Simulation
  PROVIDER_SIMULATE_LATENCY_MS: z.string().transform(Number).default('100'),
  PROVIDER_FAILURE_RATE: z.string().transform(Number).default('0.02'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }

  return result.data;
};

export const config = {
  get env() {
    return parseEnv();
  },

  get isDevelopment() {
    return this.env.NODE_ENV === 'development';
  },

  get isProduction() {
    return this.env.NODE_ENV === 'production';
  },

  get isTest() {
    return this.env.NODE_ENV === 'test';
  },
};

export type Config = ReturnType<typeof parseEnv>;
