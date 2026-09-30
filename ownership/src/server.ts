import { buildOwnershipApp } from "./app.js";
import { config } from "./config.js";
import { getRedisClient } from "./redis/client.js";
import { seedOwnershipData } from "./seed/seedOwnership.js";

const redis = getRedisClient();
const app = buildOwnershipApp({
  fastifyOpts: { logger: true },
  redis,
});

const start = async () => {
  try {
    // Perform idempotent seed on startup
    try {
      const seedRes = await seedOwnershipData(redis);
      console.log(`[Ownership Service] Seeded initial data: ${seedRes.ownershipsSeeded} ownerships, ${seedRes.delegationsSeeded} delegation.`);
    } catch (seedErr) {
      console.warn("[Ownership Service] Warning: Redis seed could not connect immediately:", seedErr);
    }

    await app.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`Ownership Service running on http://${config.host}:${config.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
