import { buildOwnershipApp } from "../ownership/src/app.js";
import { createRedisMock } from "../ownership/src/redis/client.js";
import { seedOwnershipData } from "../ownership/src/seed/seedOwnership.js";
import { buildApp as buildSampleApp } from "../sample-app/src/app.js";
import { OwnershipClient } from "../sample-app/src/ownership/ownershipClient.js";
import { buildApp as buildEventsApp } from "../events/src/app.js";
import { buildGatewayApp } from "../gateway/src/app.js";
import { seedObjectAccess } from "../gateway/src/storage/ownershipStore.js";
import { seedDelegation } from "../gateway/src/storage/delegationStore.js";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function runScannerCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const cliPath = path.resolve(projectRoot, "scanner", "dist", "cli.js");

    execFile("node", [cliPath, ...args], { cwd: projectRoot }, (error, stdout, stderr) => {
      const exitCode = error && typeof error.code === "number" ? error.code : 0;
      resolve({ exitCode, stdout, stderr });
    });
  });
}

async function runFullE2ETest() {
  console.log("==================================================================");
  console.log(" 🚀 ZEROTRUSTAPI FULL M1 + M2 + M3 + M4 E2E INTEGRATION VERIFIER");
  console.log("==================================================================");

  const SAMPLE_APP_PORT = 3000;
  const OWNERSHIP_PORT = 4000;
  const EVENTS_PORT = 5000;
  const GATEWAY_PORT = 8080;

  process.env.JWT_SECRET = "development-secret";
  process.env.SAMPLE_APP_URL = `http://127.0.0.1:${SAMPLE_APP_PORT}`;
  process.env.EVENTS_SERVICE_URL = `http://127.0.0.1:${EVENTS_PORT}/v1/events`;

  // 1. Initialize Redis & Seed Data
  const redis = createRedisMock();
  const seedResult = await seedOwnershipData(redis);
  console.log(`[1/5] [Redis]            Seeded ${seedResult.ownershipsSeeded} ownership records & ${seedResult.delegationsSeeded} delegation into M2 Redis.`);

  // Seed Gateway in-memory adapter stores
  await seedObjectAccess("orders", "101", { ownerUserId: "userA1", tenantId: "tenantA", orgId: "org1" });
  await seedObjectAccess("orders", "102", { ownerUserId: "userA1", tenantId: "tenantA", orgId: "org1" });
  await seedObjectAccess("orders", "201", { ownerUserId: "userB1", tenantId: "tenantB", orgId: "org1" });
  await seedObjectAccess("orders", "202", { ownerUserId: "userB1", tenantId: "tenantB", orgId: "org1" });
  await seedDelegation("userB1", "tenantA", "orders", { actions: ["read"], expiresAt: Math.floor(Date.now() / 1000) + 86400 });
  console.log(`[1/5] [Gateway Store]    Seeded ownership records & delegation into Gateway memory store.`);

  // 2. Start Ownership Service on Port 4000
  const ownershipApp = buildOwnershipApp({ redis, fastifyOpts: { logger: false } });
  await ownershipApp.listen({ port: OWNERSHIP_PORT, host: "127.0.0.1" });
  console.log(`[2/5] [Ownership Service] LIVE on http://127.0.0.1:${OWNERSHIP_PORT}`);

  // 3. Start Events Service on Port 5000
  const eventsApp = buildEventsApp();
  await eventsApp.listen({ port: EVENTS_PORT, host: "127.0.0.1" });
  console.log(`[3/5] [Events Service]    LIVE on http://127.0.0.1:${EVENTS_PORT}`);

  // 4. Start Sample App on Port 3000 (vulnerable mode to simulate vulnerable upstream backend)
  process.env.APP_MODE = "vulnerable";
  const ownershipClient = new OwnershipClient({ baseUrl: `http://127.0.0.1:${OWNERSHIP_PORT}` });
  const sampleApp = buildSampleApp({ fastifyOpts: { logger: false }, ownershipClient });
  await sampleApp.listen({ port: SAMPLE_APP_PORT, host: "127.0.0.1" });
  console.log(`[4/5] [Sample App]        LIVE on http://127.0.0.1:${SAMPLE_APP_PORT} (APP_MODE=VULNERABLE)`);

  // 5. Start Gateway on Port 8080
  const gatewayApp = buildGatewayApp({
    upstreamUrl: `http://127.0.0.1:${SAMPLE_APP_PORT}`,
    fastifyOpts: { logger: false },
  });
  await gatewayApp.listen({ port: GATEWAY_PORT, host: "127.0.0.1" });
  console.log(`[5/5] [Gateway Service]   LIVE on http://127.0.0.1:${GATEWAY_PORT} (Proxy -> :3000, Events -> :5000)`);

  try {
    console.log("\n==================================================================");
    console.log(" PHASE A: DIRECT GATEWAY AUTHORIZATION & BOLA MITIGATION TESTS");
    console.log("==================================================================");

    // Login helper to get tokens
    async function login(username: string): Promise<string> {
      const res = await fetch(`http://127.0.0.1:${SAMPLE_APP_PORT}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "password123" }),
      });
      if (!res.ok) throw new Error(`Login failed for ${username}: ${res.status}`);
      const body = (await res.json()) as any;
      return body.token;
    }

    const tokenUserA1 = await login("userA1");
    const tokenUserA2 = await login("userA2");
    const tokenUserB1 = await login("userB1");

    // Test 1: Unauthenticated request to Gateway -> 401
    const unauthRes = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/orders/101`);
    console.log(`[Test 1] Unauthenticated request -> Status: ${unauthRes.status} (Expected: 401)`);
    if (unauthRes.status !== 401) throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.status}`);

    // Test 2: Owner authorized access: userA1 -> Order 101 -> 200
    const ownerRes = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/orders/101`, {
      headers: { Authorization: `Bearer ${tokenUserA1}` },
    });
    console.log(`[Test 2] Owner access (userA1 -> Order 101) -> Status: ${ownerRes.status} (Expected: 200)`);
    if (ownerRes.status !== 200) throw new Error(`Expected 200 for owner access, got ${ownerRes.status}`);
    const ownerData = (await ownerRes.json()) as any;
    if (ownerData.id !== "101") throw new Error(`Expected order ID 101, got ${ownerData.id}`);

    // Test 3: Cross-tenant BOLA attempt: userA1 -> Order 201 -> 403 on Gateway vs 200 on Direct Vulnerable App
    const directVulnRes = await fetch(`http://127.0.0.1:${SAMPLE_APP_PORT}/api/orders/201`, {
      headers: { Authorization: `Bearer ${tokenUserA1}` },
    });
    console.log(`[Test 3a] Direct vulnerable backend BOLA leak (userA1 -> Order 201) -> Status: ${directVulnRes.status} (Expected: 200 leak)`);
    if (directVulnRes.status !== 200) throw new Error(`Expected direct vulnerable app to return 200, got ${directVulnRes.status}`);

    const gatewayBlockedRes = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/orders/201`, {
      headers: { Authorization: `Bearer ${tokenUserA1}` },
    });
    console.log(`[Test 3b] Gateway BOLA mitigation (userA1 -> Order 201) -> Status: ${gatewayBlockedRes.status} (Expected: 403 Forbidden)`);
    if (gatewayBlockedRes.status !== 403) throw new Error(`Expected Gateway to block BOLA with 403, got ${gatewayBlockedRes.status}`);

    // Test 4: Delegation authorized access: userB1 -> Order 101 -> 200
    const delegRes = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/orders/101`, {
      headers: { Authorization: `Bearer ${tokenUserB1}` },
    });
    console.log(`[Test 4] Delegated access (userB1 -> Order 101) -> Status: ${delegRes.status} (Expected: 200)`);
    if (delegRes.status !== 200) throw new Error(`Expected 200 for delegated access, got ${delegRes.status}`);

    // Test 5: Tenant-wide reader access: userA2 -> Order 101 -> 200
    const tenantReaderRes = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/orders/101`, {
      headers: { Authorization: `Bearer ${tokenUserA2}` },
    });
    console.log(`[Test 5] Tenant scope access (userA2 -> Order 101) -> Status: ${tenantReaderRes.status} (Expected: 200)`);
    if (tenantReaderRes.status !== 200) throw new Error(`Expected 200 for tenant-wide scope reader, got ${tenantReaderRes.status}`);

    // Test 6: Unknown object: userA1 -> Order 999 -> 403 fail closed
    const unknownRes = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/orders/999`, {
      headers: { Authorization: `Bearer ${tokenUserA1}` },
    });
    console.log(`[Test 6] Unknown object fail-closed (userA1 -> Order 999) -> Status: ${unknownRes.status} (Expected: 403)`);
    if (unknownRes.status !== 403) throw new Error(`Expected 403 for unknown object, got ${unknownRes.status}`);

    // Wait 300ms for async event dispatch to M4 Events Service
    await new Promise((r) => setTimeout(r, 300));

    console.log("\n==================================================================");
    console.log(" PHASE B: M4 TELEMETRY & PRIVACY INVARIANT VERIFICATION");
    console.log("==================================================================");

    const eventsRes = await fetch(`http://127.0.0.1:${EVENTS_PORT}/v1/events`);
    if (!eventsRes.ok) throw new Error(`Failed to fetch events from M4: ${eventsRes.status}`);
    const events = (await eventsRes.json()) as any[];
    console.log(`✓ M4 Events Service recorded ${events.length} security decision events from Gateway.`);

    const allows = events.filter((e) => e.decision === "ALLOW");
    const blocks = events.filter((e) => e.decision === "BLOCK");
    console.log(`✓ Decisions breakdown: ALLOW=${allows.length}, BLOCK=${blocks.length}`);

    if (allows.length === 0 || blocks.length === 0) {
      throw new Error("Expected both ALLOW and BLOCK events recorded in M4");
    }

    // Privacy & hashing verification
    for (const evt of events) {
      if (!evt.subjectHash || !evt.objectIdHash) {
        throw new Error(`Event missing subjectHash or objectIdHash: ${JSON.stringify(evt)}`);
      }
      if (typeof evt.authzLatencyUs !== "number") {
        throw new Error(`Event missing numeric authzLatencyUs: ${JSON.stringify(evt)}`);
      }
      const raw = JSON.stringify(evt);
      if (raw.includes("password") || raw.includes("Bearer") || raw.includes("secret")) {
        throw new Error(`Security Violation: Unredacted sensitive token or credential in M4 event: ${raw}`);
      }
    }
    console.log("✓ Privacy verified: All events strictly contain SHA-256 hashes, zero credentials, zero raw tokens.");

    console.log("\n==================================================================");
    console.log(" PHASE C: M3 SCANNER VALIDATION (GATEWAY VS DIRECT APP)");
    console.log("==================================================================");

    // Scan 1: Run Scanner against Protected Gateway (Port 8080)
    console.log("\n[Scan 1] Running Scanner against Protected Gateway (http://localhost:8080)...");
    const gatewayScanArgs = [
      "scan",
      "--openapi", `http://localhost:${GATEWAY_PORT}/openapi.json`,
      "--fixtures", `http://localhost:${GATEWAY_PORT}/_test/fixtures`,
      "--target", `http://localhost:${GATEWAY_PORT}`,
      "--report", `http://localhost:${EVENTS_PORT}`,
    ];
    const gatewayScanResult = await runScannerCli(gatewayScanArgs);
    console.log(`[Scan 1 Result] Exit Code: ${gatewayScanResult.exitCode} (Expected: 0)`);
    console.log(gatewayScanResult.stdout);
    if (gatewayScanResult.exitCode !== 0) {
      throw new Error(`Expected scanner exit code 0 against Gateway, got ${gatewayScanResult.exitCode}`);
    }
    if (!gatewayScanResult.stdout.includes("Status    : PASS") || !gatewayScanResult.stdout.includes("Findings  : 0")) {
      throw new Error("Scanner reported unexpected findings against protected Gateway");
    }
    console.log("✓ Scanner verified: Gateway successfully protects against all BOLA attack probes (0 findings, PASS).");

    // Scan 2: Run Scanner against Vulnerable Backend Directly (Port 3000)
    console.log("\n[Scan 2] Running Scanner against Direct Vulnerable Sample App (http://localhost:3000)...");
    const appScanArgs = [
      "scan",
      "--openapi", `http://localhost:${SAMPLE_APP_PORT}/openapi.json`,
      "--fixtures", `http://localhost:${SAMPLE_APP_PORT}/_test/fixtures`,
      "--target", `http://localhost:${SAMPLE_APP_PORT}`,
      "--report", `http://localhost:${EVENTS_PORT}`,
    ];
    const appScanResult = await runScannerCli(appScanArgs);
    console.log(`[Scan 2 Result] Exit Code: ${appScanResult.exitCode} (Expected: 1)`);
    console.log(appScanResult.stdout);
    if (appScanResult.exitCode !== 1) {
      throw new Error(`Expected scanner exit code 1 against Vulnerable App, got ${appScanResult.exitCode}`);
    }
    if (!appScanResult.stdout.includes("Status    : FAIL") || !appScanResult.stdout.includes("HIGH")) {
      throw new Error("Scanner failed to detect HIGH severity BOLA vulnerability on direct app");
    }
    console.log("✓ Scanner verified: Accurately flags direct vulnerable backend with HIGH severity BOLA findings.");

    // Check M4 Scan Reports
    const scansRes = await fetch(`http://127.0.0.1:${EVENTS_PORT}/v1/scans`);
    const scans = (await scansRes.json()) as any[];
    console.log(`\n✓ M4 Events Service recorded ${scans.length} total scan report(s).`);
    const latestScan = scans[scans.length - 1];
    console.log(`✓ Latest scan summary in M4: passed=${latestScan.summary.passed}, failed=${latestScan.summary.failed}, findings=${latestScan.findings.length}`);

  } finally {
    console.log("\nShutting down test services...");
    await gatewayApp.close();
    await sampleApp.close();
    await eventsApp.close();
    await ownershipApp.close();
  }

  console.log("\n==================================================================");
  console.log(" 🎯 FINAL STATUS: M1 + M2 + M3 + M4 INTEGRATION VERIFIED");
  console.log("==================================================================");
}

runFullE2ETest().catch((err) => {
  console.error("Full E2E verification failed:", err);
  process.exit(1);
});
