export const config = {
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  port: Number(process.env.OWNERSHIP_PORT || process.env.PORT) || 4000,
  host: process.env.HOST || "0.0.0.0",
  jwtSecret: process.env.JWT_SECRET || "development-secret",
};
