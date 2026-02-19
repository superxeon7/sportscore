import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number): number | null {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connection established');
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing Redis connection...');
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }

  /**
   * Retrieve the underlying ioredis client for advanced operations.
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Get a value by key, optionally parsing it as JSON.
   */
  async get<T = string>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * Set a value by key. Objects are automatically JSON-serialized.
   * @param key   The cache key
   * @param value The value to store
   * @param ttl   Time-to-live in seconds (optional)
   */
  async set<T = string>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      await this.client.set(key, serialized, 'EX', ttl);
    } else {
      await this.client.set(key, serialized);
    }
  }

  /**
   * Delete one or more keys.
   */
  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }
    return this.client.del(...keys);
  }

  /**
   * Check if a key exists.
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Set the expiration (TTL) on an existing key, in seconds.
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  /**
   * Get the remaining TTL of a key, in seconds.
   * Returns -2 if the key does not exist, -1 if no TTL is set.
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * Increment a numeric value stored at key by 1 (or a given amount).
   */
  async incr(key: string, amount = 1): Promise<number> {
    if (amount === 1) {
      return this.client.incr(key);
    }
    return this.client.incrby(key, amount);
  }

  /**
   * Delete all keys matching a glob pattern.
   * Uses SCAN internally to avoid blocking the server.
   */
  async delByPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        deletedCount += await this.client.del(...keys);
      }
    } while (cursor !== '0');

    return deletedCount;
  }
}
