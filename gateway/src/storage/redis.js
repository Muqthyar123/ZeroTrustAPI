const Redis = require("ioredis");

let redisClient = null;

/**
 * Gets or initializes the Redis client instance.
 * Reads environment variable process.env.REDIS_URL.
 * Configured safely to fail fast when Redis is unavailable.
 *
 * @returns {Redis|null} Redis client instance.
 */
function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

  try {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      retryStrategy: (times) => {
        // Limited retry strategy for safe offline handling
        if (times > 3) {
          return null;
        }
        return Math.min(times * 100, 1000);
      }
    });

    redisClient.on("error", (err) => {
      // Log operational error without exposing credentials or secrets
      // Suppress unhandled exceptions when offline
    });

    return redisClient;
  } catch (err) {
    redisClient = null;
    return null;
  }
}

/**
 * Safely closes the Redis connection if initialized.
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (_) {
      redisClient.disconnect();
    } finally {
      redisClient = null;
    }
  }
}

module.exports = {
  getRedisClient,
  closeRedis
};
