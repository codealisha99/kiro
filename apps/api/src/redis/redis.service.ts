import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>("REDIS_URL", "redis://localhost:6379");
    this.client = new Redis(url, { lazyConnect: true });
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log("Connected to Redis");
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
    this.logger.log("Disconnected from Redis");
  }

  getClient(): Redis {
    return this.client;
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      return this.client.set(key, value, "EX", ttlSeconds);
    }
    return this.client.set(key, value);
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async del(...keys: string[]) {
    return this.client.del(...keys);
  }
}
