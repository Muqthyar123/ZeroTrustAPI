import { getRedisClient } from "../redis/client.js";
import { seedOwnershipData } from "./seedOwnership.js";

async function main() {
  const redis = getRedisClient();
  try {
    const result = await seedOwnershipData(redis);
    console.log(`Successfully seeded: ${result.ownershipsSeeded} ownerships, ${result.delegationsSeeded} delegation.`);
  } catch (error) {
    console.error("Error seeding ownership data:", error);
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}

main();
