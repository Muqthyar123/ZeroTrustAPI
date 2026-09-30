import { buildOwnershipApp } from "../ownership/src/app.js";
import { createRedisMock } from "../ownership/src/redis/client.js";
import { seedOwnershipData } from "../ownership/src/seed/seedOwnership.js";
import { buildApp as buildSampleApp } from "../sample-app/src/app.js";
import { OwnershipClient } from "../sample-app/src/ownership/ownershipClient.js";
import { buildApp as buildEventsApp } from "../events/src/app.js";
import { mockService } from "../events/src/services/mock.service.js";
import { buildGatewayApp } from "../gateway/src/app.js";
import { seedObjectAccess } from "../gateway/src/storage/ownershipStore.js";
import { seedDelegation } from "../gateway/src/storage/delegationStore.js";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

async function main() {
  console.log("==================================================================");
  console.log(" 🚀 STARTING ZEROTRUSTAPI LIVE FULL ARCHITECTURE (M1 + M2 + M3 + M4)");
  console.log("==================================================================");

  process.env.JWT_SECRET = process.env.JWT_SECRET || "development-secret";
  process.env.SAMPLE_APP_URL = process.env.SAMPLE_APP_URL || "http://127.0.0.1:3000";
  process.env.EVENTS_SERVICE_URL = process.env.EVENTS_SERVICE_URL || "http://127.0.0.1:5000/v1/events";

  // 1. Initialize Redis & Seed Data
  const redis = createRedisMock();
  const seedResult = await seedOwnershipData(redis);
  console.log(`[1/6] [Redis]            Seeded ${seedResult.ownershipsSeeded} ownership records & ${seedResult.delegationsSeeded} delegation.`);

  // Seed Gateway in-memory adapter stores
  await seedObjectAccess("orders", "101", { ownerUserId: "userA1", tenantId: "tenantA", orgId: "org1" });
  await seedObjectAccess("orders", "102", { ownerUserId: "userA1", tenantId: "tenantA", orgId: "org1" });
  await seedObjectAccess("orders", "201", { ownerUserId: "userB1", tenantId: "tenantB", orgId: "org1" });
  await seedObjectAccess("orders", "202", { ownerUserId: "userB1", tenantId: "tenantB", orgId: "org1" });
  await seedDelegation("userB1", "tenantA", "orders", { actions: ["read"], expiresAt: Math.floor(Date.now() / 1000) + 86400 });

  // 2. Start Ownership Service on Port 4000
  const ownershipApp = buildOwnershipApp({ redis, fastifyOpts: { logger: false } });
  await ownershipApp.listen({ port: 4000, host: "0.0.0.0" });
  console.log(`[2/6] [Ownership Service] LIVE on http://localhost:4000`);

  // 3. Start Sample App on Port 3000
  process.env.APP_MODE = process.env.APP_MODE || "vulnerable";
  const ownershipClient = new OwnershipClient({ baseUrl: "http://127.0.0.1:4000" });
  const sampleApp = buildSampleApp({ fastifyOpts: { logger: false }, ownershipClient });
  await sampleApp.listen({ port: 3000, host: "0.0.0.0" });
  console.log(`[3/6] [Sample App]        LIVE on http://localhost:3000 (APP_MODE=${process.env.APP_MODE.toUpperCase()})`);

  // 4. Start Events Service on Port 5000 & Seed Initial Events / Start SSE Streamer
  const eventsApp = buildEventsApp();
  await eventsApp.listen({ port: 5000, host: "0.0.0.0" });
  await mockService.seedInitialData();
  mockService.start(3000);
  console.log(`[4/6] [Events Service]    LIVE on http://localhost:5000 (Seeded + SSE Telemetry Active)`);

  // 5. Start Gateway Service on Port 8080
  const gatewayApp = buildGatewayApp({
    upstreamUrl: "http://127.0.0.1:3000",
    fastifyOpts: { logger: false },
  });
  await gatewayApp.listen({ port: 8080, host: "0.0.0.0" });
  console.log(`[5/6] [M1 Gateway]        LIVE on http://localhost:8080 (Zero-Trust Enforcement Proxy)`);

  // 6. Start Dashboard on Port 5173
  const dashboardRoot = path.resolve(projectRoot, "dashboard");
  const dashboardProc = spawn("npm", ["run", "preview", "--", "--port", "5173", "--host", "0.0.0.0"], {
    cwd: dashboardRoot,
    shell: true,
    stdio: "inherit",
  });

  console.log(`[6/6] [Dashboard UI]      LIVE on http://localhost:5173`);

  console.log("\n==================================================================");
  console.log(" ✨ ALL ZERO TRUST SERVICES ARE RUNNING AND READY FOR EVALUATION!");
  console.log("==================================================================");
  console.log(" 🌐 Security Dashboard UI  : http://localhost:5173");
  console.log(" 🛡️  M1 Zero-Trust Gateway : http://localhost:8080 (Protected)");
  console.log(" 📦 M2 Sample App API      : http://localhost:3000 (Upstream)");
  console.log(" 🔑 M2 Ownership Service   : http://localhost:4000");
  console.log(" 📊 M4 Events & Audit API  : http://localhost:5000");
  console.log("==================================================================");
  console.log("\n💡 TO RUN THE M3 BOLA SECURITY SCANNER LIVE:");
  console.log("   Against Protected Gateway (:8080):");
  console.log("   npx tsx scanner/src/cli.ts scan --target http://localhost:8080 --report http://localhost:5000\n");
  console.log("   Against Direct Vulnerable App (:3000):");
  console.log("   npx tsx scanner/src/cli.ts scan --target http://localhost:3000 --report http://localhost:5000\n");

  process.on("SIGINT", async () => {
    console.log("\nGracefully shutting down services...");
    dashboardProc.kill();
    await gatewayApp.close();
    await sampleApp.close();
    await eventsApp.close();
    await ownershipApp.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Failed to start services:", err);
  process.exit(1);
});
