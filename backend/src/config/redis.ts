import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

class RedisManager {
  private client: Redis | null = null;
  private isAvailable = false;

  constructor() {
    if (redisUrl) {
      try {
        this.client = new Redis(redisUrl, {
          maxRetriesPerRequest: 2,
          retryStrategy(times) {
            if (times > 5) return null;
            return Math.min(times * 100, 2000);
          },
          lazyConnect: true,
          connectTimeout: 5000,
        });

        this.client.on('error', (err) => {
          this.isAvailable = false;
          // Silent warning to prevent log spam in test/local environments
        });

        this.client.on('connect', () => {
          this.isAvailable = true;
        });

        this.client.connect().then(() => {
          this.isAvailable = true;
        }).catch(() => {
          this.isAvailable = false;
        });
      } catch {
        this.client = null;
        this.isAvailable = false;
      }
    }
  }

  get isConnected(): boolean {
    return this.isAvailable && this.client !== null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      if (mode && duration) {
        return await (this.client as any).set(key, value, mode, duration);
      }
      return await this.client.set(key, value);
    } catch {
      return null;
    }
  }

  async del(...keys: string[]): Promise<number> {
    if (!this.isConnected || !this.client || !keys.length) return 0;
    try {
      return await this.client.del(...keys);
    } catch {
      return 0;
    }
  }

  async incr(key: string): Promise<number | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      return await this.client.incr(key);
    } catch {
      return null;
    }
  }

  async pexpire(key: string, milliseconds: number): Promise<number | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      return await this.client.pexpire(key, milliseconds);
    } catch {
      return null;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected || !this.client) return [];
    try {
      return await this.client.keys(pattern);
    } catch {
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }
}

export const redis = new RedisManager();
