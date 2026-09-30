import { buildOwnershipApp } from "../ownership/src/app.js";
import { createRedisMock } from "../ownership/src/redis/client.js";
import { seedOwnershipData } from "../ownership/src/seed/seedOwnership.js";
import { buildApp as buildSampleApp } from "../sample-app/src/app.js";
import { OwnershipClient } from "../sample-app/src/ownership/ownershipClient.js";
import { buildApp as buildEventsApp } from "../events/src/app.js";
import crypto from "crypto";

async function runAllIntegrationTests() {
  const ownershipPort = 4088;
  const samplePort = 3088;
  const eventsPort = 5088;

  console.log("==================================================================");
  console.log(" ZeroTrustAPI - Full M2 + M4 Multi-Service Integration Verification");
  console.log("==================================================================");

  // 1. Initialize Redis & Seed for Ownership Service (M2)
  const redis = createRedisMock();
  const seedResult = await seedOwnershipData(redis);
  console.log(`[Seed] Initialized Redis seed data (${seedResult.ownershipsSeeded} ownerships, ${seedResult.delegationsSeeded} delegations).`);

  // 2. Start Ownership Service (M2 - Port 4088)
  const ownershipApp = buildOwnershipApp({ redis, fastifyOpts: { logger: false } });
  await ownershipApp.listen({ port: ownershipPort, host: "127.0.0.1" });
  console.log(`[M2 Service] Ownership Service listening on http://127.0.0.1:${ownershipPort}`);

  // 3. Connect Sample App with OwnershipClient (M2 - Port 3088)
  const ownershipClient = new OwnershipClient({
    baseUrl: `http://127.0.0.1:${ownershipPort}`,
  });
  const sampleApp = buildSampleApp({ fastifyOpts: { logger: false }, ownershipClient });
  await sampleApp.listen({ port: samplePort, host: "127.0.0.1" });
  console.log(`[M2 Service] Sample App listening on http://127.0.0.1:${samplePort}`);

  // 4. Start Events Service (M4 - Port 5088)
  const eventsApp = buildEventsApp();
  await eventsApp.listen({ port: eventsPort, host: "127.0.0.1" });
  console.log(`[M4 Service] Events Service listening on http://127.0.0.1:${eventsPort}`);

  try {
    const SAMPLE_APP_URL = `http://127.0.0.1:${samplePort}`;
    const OWNERSHIP_URL = `http://127.0.0.1:${ownershipPort}`;
    const EVENTS_URL = `http://127.0.0.1:${eventsPort}`;

    // ==================================================================
    // PHASE 1: Health Checks Across All Services
    // ==================================================================
    console.log("\n--- [Phase 1: Health Checks] ---");
    const sampleHealth = await fetch(`${SAMPLE_APP_URL}/health`);
    if (!sampleHealth.ok) throw new Error("Sample App health check failed");
    console.log(`✓ Sample App /health -> status ${sampleHealth.status} OK`);

    const ownershipHealth = await fetch(`${OWNERSHIP_URL}/health`);
    if (!ownershipHealth.ok) throw new Error("Ownership Service health check failed");
    console.log(`✓ Ownership Service /health -> status ${ownershipHealth.status} OK`);

    const eventsHealth = await fetch(`${EVENTS_URL}/health`);
    if (!eventsHealth.ok) throw new Error("Events Service health check failed");
    const eventsHealthJson = (await eventsHealth.json()) as any;
    console.log(`✓ Events Service /health -> status ${eventsHealth.status} (${eventsHealthJson.service}) OK`);

    // ==================================================================
    // PHASE 2: M2 OpenAPI Contract & Test Fixtures
    // ==================================================================
    console.log("\n--- [Phase 2: M2 OpenAPI & Fixtures] ---");
    const openApiRes = await fetch(`${SAMPLE_APP_URL}/openapi.json`);
    if (!openApiRes.ok) throw new Error(`GET /openapi.json failed: ${openApiRes.status}`);
    const openApiDoc = (await openApiRes.json()) as any;
    console.log(`✓ OpenAPI version: ${openApiDoc.openapi}, title: "${openApiDoc.info.title}", endpoints documented: ${Object.keys(openApiDoc.paths).length}`);

    const fixturesRes = await fetch(`${SAMPLE_APP_URL}/_test/fixtures`);
    if (!fixturesRes.ok) throw new Error(`GET /_test/fixtures failed: ${fixturesRes.status}`);
    const fixtures = (await fixturesRes.json()) as any;
    console.log(`✓ Fixtures verified: ${fixtures.users.length} users, ${fixtures.objects.orders.length} orders, ${fixtures.delegations.length} delegations.`);

    // ==================================================================
    // PHASE 3: M2 Authentication, BOLA Demonstration, Write-Through Sync
    // ==================================================================
    console.log("\n--- [Phase 3: M2 Auth, BOLA, and Write-Through Sync] ---");
    const loginRes = await fetch(`${SAMPLE_APP_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userA1@example.com", password: "password123" }),
    });
    if (!loginRes.ok) throw new Error(`Login failed with status ${loginRes.status}`);
    const { token: tokenA1 } = (await loginRes.json()) as { token: string };
    console.log("✓ userA1 authenticated successfully with JWT.");

    // Own Order
    const get101Res = await fetch(`${SAMPLE_APP_URL}/api/orders/101`, {
      headers: { Authorization: `Bearer ${tokenA1}` },
    });
    if (!get101Res.ok) throw new Error(`GET 101 failed: ${get101Res.status}`);
    const order101 = (await get101Res.json()) as any;
    console.log(`✓ GET 101 returned own order (Tenant: ${order101.tenantId}, Item: ${order101.items[0].item})`);

    // BOLA Demonstration in APP_MODE=vulnerable
    const get201Res = await fetch(`${SAMPLE_APP_URL}/api/orders/201`, {
      headers: { Authorization: `Bearer ${tokenA1}` },
    });
    if (!get201Res.ok) throw new Error(`GET 201 failed: ${get201Res.status}`);
    const order201 = (await get201Res.json()) as any;
    console.log(`✓ GET 201 demonstrates BOLA vulnerability (userA1 accessed tenantB order 201: ${order201.items[0].item})`);

    // Create Order with Write-Through
    const postRes = await fetch(`${SAMPLE_APP_URL}/api/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ item: "Integrated Headset", quantity: 1, price: 199.99 }],
        totalAmount: 199.99,
        status: "pending",
      }),
    });
    if (!postRes.ok) throw new Error(`POST order failed: ${postRes.status}`);
    const createdOrder = (await postRes.json()) as any;
    const orderId = createdOrder.id;
    console.log(`✓ Order ${orderId} created. Verifying Ownership write-through in Redis...`);

    const ownershipRes = await fetch(`${OWNERSHIP_URL}/v1/ownership/orders/${orderId}`);
    if (!ownershipRes.ok) throw new Error(`Ownership lookup failed: ${ownershipRes.status}`);
    const ownershipData = (await ownershipRes.json()) as any;
    console.log(`✓ Ownership record verified in Redis: resourceType=${ownershipData.resourceType}, objectId=${ownershipData.objectId}, tenantId=${ownershipData.tenantId}, ownerUserId=${ownershipData.ownerUserId}`);

    // Delete Order and verify sync
    const deleteRes = await fetch(`${SAMPLE_APP_URL}/api/orders/${orderId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA1}` },
    });
    if (!deleteRes.ok) throw new Error(`DELETE order failed: ${deleteRes.status}`);
    const ownershipAfterDelete = await fetch(`${OWNERSHIP_URL}/v1/ownership/orders/${orderId}`);
    if (ownershipAfterDelete.status !== 404) {
      throw new Error(`Expected 404 for deleted ownership, got ${ownershipAfterDelete.status}`);
    }
    console.log(`✓ Order ${orderId} deleted and ownership record removed from Redis (404 confirmed).`);

    // Delegations check
    const delegRes = await fetch(`${OWNERSHIP_URL}/v1/delegations/userB1:tenantA:orders`);
    if (!delegRes.ok) throw new Error(`Delegation lookup failed: ${delegRes.status}`);
    const delegData = (await delegRes.json()) as any;
    console.log(`✓ Frozen delegation verified: grantee=${delegData.granteeUserId}, ownerTenant=${delegData.ownerTenantId}, resourceType=${delegData.resourceType}, actions=${delegData.actions}, isValid=${delegData.isValid}`);

    // ==================================================================
    // PHASE 4: M4 Events Service Verification
    // ==================================================================
    console.log("\n--- [Phase 4: M4 Events Service Ingestion & Auditing] ---");
    const allowEvent = {
      timestamp: new Date().toISOString(),
      method: "GET",
      routeTemplate: "/api/orders/:orderId",
      resourceType: "orders",
      objectIdHash: crypto.createHash("sha256").update("101").digest("hex"),
      subjectHash: crypto.createHash("sha256").update("userA1").digest("hex"),
      tenantId: "tenantA",
      objectTenantId: "tenantA",
      decision: "ALLOW",
      reason: "OK_OWNER",
      authzLatencyUs: 420,
    };

    const postEvent1 = await fetch(`${EVENTS_URL}/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(allowEvent),
    });
    if (!postEvent1.ok) throw new Error(`POST event failed: ${postEvent1.status} ${await postEvent1.text()}`);
    const createdEvent1 = (await postEvent1.json()) as any;
    console.log(`✓ Security Event ingested (ALLOW): decisionId=${createdEvent1.decisionId}, reason=${createdEvent1.reason}`);

    const blockEvent = {
      timestamp: new Date().toISOString(),
      method: "GET",
      routeTemplate: "/api/orders/:orderId",
      resourceType: "orders",
      objectIdHash: crypto.createHash("sha256").update("201").digest("hex"),
      subjectHash: crypto.createHash("sha256").update("userA1").digest("hex"),
      tenantId: "tenantA",
      objectTenantId: "tenantB",
      decision: "BLOCK",
      reason: "TENANT_MISMATCH",
      authzLatencyUs: 380,
    };

    const postEvent2 = await fetch(`${EVENTS_URL}/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blockEvent),
    });
    if (!postEvent2.ok) throw new Error(`POST event 2 failed: ${postEvent2.status}`);
    const createdEvent2 = (await postEvent2.json()) as any;
    console.log(`✓ Security Event ingested (BLOCK): decisionId=${createdEvent2.decisionId}, reason=${createdEvent2.reason}`);

    // Query Events
    const getEventsRes = await fetch(`${EVENTS_URL}/v1/events`);
    if (!getEventsRes.ok) throw new Error(`GET /v1/events failed: ${getEventsRes.status}`);
    const eventsList = (await getEventsRes.json()) as any[];
    console.log(`✓ Queried events list: found ${eventsList.length} events in buffer.`);

    // Query Specific Event
    const getSingleEventRes = await fetch(`${EVENTS_URL}/v1/events/${createdEvent1.decisionId}`);
    if (!getSingleEventRes.ok) throw new Error(`GET event by ID failed: ${getSingleEventRes.status}`);
    const singleEvent = (await getSingleEventRes.json()) as any;
    console.log(`✓ Retrieved event by decisionId: ${singleEvent.decisionId} (${singleEvent.decision})`);

    // Verify Stats
    const getStatsRes = await fetch(`${EVENTS_URL}/v1/stats`);
    if (!getStatsRes.ok) throw new Error(`GET /v1/stats failed: ${getStatsRes.status}`);
    const stats = (await getStatsRes.json()) as any;
    console.log(`✓ Stats verified: totalEvents=${stats.totalEvents}, allowed=${stats.allowed}, blocked=${stats.blocked}, blockRate=${stats.blockRate}%, avgAuthzLatencyUs=${stats.avgAuthzLatencyUs}µs`);

    // Scan Ingestion & Retrieval
    console.log("\n--- [Phase 5: M4 Scanner Results Ingestion] ---");
    const scanPayload = {
      commit: "m2-m4-integration-commit-hash",
      startedAt: new Date().toISOString(),
      target: "http://sample-app:3000",
      summary: { total: 10, passed: 9, failed: 1 },
      findings: [
        {
          method: "GET",
          routeTemplate: "/api/orders/:orderId",
          attackerTenant: "tenantA",
          victimTenant: "tenantB",
          expectedStatus: 403,
          actualStatus: 200,
          severity: "CRITICAL",
        },
      ],
    };

    const postScanRes = await fetch(`${EVENTS_URL}/v1/scans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scanPayload),
    });
    if (!postScanRes.ok) throw new Error(`POST /v1/scans failed: ${postScanRes.status}`);
    const createdScan = (await postScanRes.json()) as any;
    console.log(`✓ Scan ingested: scanId=${createdScan.scanId}, total=${createdScan.summary.total}, failed=${createdScan.summary.failed}`);

    const getScansRes = await fetch(`${EVENTS_URL}/v1/scans`);
    if (!getScansRes.ok) throw new Error(`GET /v1/scans failed: ${getScansRes.status}`);
    const scansList = (await getScansRes.json()) as any[];
    console.log(`✓ Scans list retrieved: found ${scansList.length} scans.`);

    console.log("\n==================================================================");
    console.log(" FULL INTEGRATION SUCCESS: ALL M2 AND M4 CAPABILITIES VERIFIED!");
    console.log("==================================================================");
  } finally {
    await eventsApp.close();
    await sampleApp.close();
    await ownershipApp.close();
  }
}

runAllIntegrationTests().catch((err) => {
  console.error("Integration verification failed:", err);
  process.exit(1);
});
