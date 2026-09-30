import { Redis } from "ioredis";
import RedisMock from "ioredis-mock";
import { config } from "../config.js";

let redisInstance: Redis | null = null;

export function getRedisClient(customUrl?: string): Redis {
  if (!redisInstance) {
    const url = customUrl || config.redisUrl;
    redisInstance = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 100, 2000);
      },
    });
  }

  return redisInstance;
}

export function createRedisMock(): Redis {
  return new (RedisMock as unknown as new () => Redis)();
}

export function setRedisInstance(client: Redis | null) {
  redisInstance = client;
}
