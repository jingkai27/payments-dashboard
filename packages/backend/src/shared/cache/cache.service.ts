import { getRedisClient } from '../database/redis.js';
import { logger } from '../utils/logger.js';

export class CacheService {
  private static instance: CacheService | null = null;
  private readonly keyPrefix: string;

  private constructor(keyPrefix = 'payment:') {
    this.keyPrefix = keyPrefix;
  }

  public static getInstance(keyPrefix = 'payment:'): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService(keyPrefix);
    }
    return CacheService.instance;
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const client = getRedisClient();
      const value = await client.get(this.getKey(key));
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error', { key, error: (error as Error).message });
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<boolean> {
    try {
      const client = getRedisClient();
      await client.set(this.getKey(key), JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error: (error as Error).message });
      return false;
    }
  }

  async setWithTTL<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    try {
      const client = getRedisClient();
      await client.set(this.getKey(key), JSON.stringify(value), 'EX', ttlSeconds);
      return true;
    } catch (error) {
      logger.error('Cache setWithTTL error', { key, ttlSeconds, error: (error as Error).message });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const client = getRedisClient();
      await client.del(this.getKey(key));
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, error: (error as Error).message });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const client = getRedisClient();
      const result = await client.exists(this.getKey(key));
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error: (error as Error).message });
      return false;
    }
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T | null> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    try {
      const value = await factory();
      if (ttlSeconds) {
        await this.setWithTTL(key, value, ttlSeconds);
      } else {
        await this.set(key, value);
      }
      return value;
    } catch (error) {
      logger.error('Cache getOrSet factory error', { key, error: (error as Error).message });
      return null;
    }
  }

  async increment(key: string, amount = 1): Promise<number | null> {
    try {
      const client = getRedisClient();
      const result = await client.incrby(this.getKey(key), amount);
      return result;
    } catch (error) {
      logger.error('Cache increment error', { key, error: (error as Error).message });
      return null;
    }
  }

  async decrement(key: string, amount = 1): Promise<number | null> {
    try {
      const client = getRedisClient();
      const result = await client.decrby(this.getKey(key), amount);
      return result;
    } catch (error) {
      logger.error('Cache decrement error', { key, error: (error as Error).message });
      return null;
    }
  }

  async setExpiry(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const client = getRedisClient();
      await client.expire(this.getKey(key), ttlSeconds);
      return true;
    } catch (error) {
      logger.error('Cache setExpiry error', { key, error: (error as Error).message });
      return false;
    }
  }

  async getTTL(key: string): Promise<number | null> {
    try {
      const client = getRedisClient();
      const ttl = await client.ttl(this.getKey(key));
      return ttl;
    } catch (error) {
      logger.error('Cache getTTL error', { key, error: (error as Error).message });
      return null;
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    try {
      const client = getRedisClient();
      const keys = await client.keys(this.getKey(pattern));
      if (keys.length === 0) {
        return 0;
      }
      const result = await client.del(...keys);
      return result;
    } catch (error) {
      logger.error('Cache deletePattern error', { pattern, error: (error as Error).message });
      return 0;
    }
  }
}

export const cacheService = CacheService.getInstance();
