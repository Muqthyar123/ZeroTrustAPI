import { buildOwnershipApp } from "../ownership/src/app.js";
import { createRedisMock } from "../ownership/src/redis/client.js";
import { seedOwnershipData } from "../ownership/src/seed/seedOwnership.js";
import { buildApp } from "../sample-app/src/app.js";
import { OwnershipClient } from "../sample-app/src/ownership/ownershipClient.js";

async function runE2E() {
  const ownershipPort = 4077;
  const samplePort = 3077;

  console.log("==================================================================");
  console.log(" ZeroTrustAPI M2 - Full E2E Hardening & Contract Verification");
  console.log("==================================================================");

  // 1. Initialize Redis & Seed
  const redis = createRedisMock();
  const seedResult = await seedOwnershipData(redis);
  console.log(`[Seed] Initialized Redis seed data (${seedResult.ownershipsSeeded} ownerships, ${seedResult.delegationsSeeded} delegation).`);

  // 2. Start Ownership Service
  const ownershipApp = buildOwnershipApp({ redis, fastifyOpts: { logger: false } });
  await ownershipApp.listen({ port: ownershipPort, host: "127.0.0.1" });
  console.log(`[Service] Ownership Service listening on http://127.0.0.1:${ownershipPort}`);

  // 3. Connect Sample App with OwnershipClient
  const ownershipClient = new OwnershipClient({
    baseUrl: `http://127.0.0.1:${ownershipPort}`,
  });

  // 4. Start Sample App
  const sampleApp = buildApp({ fastifyOpts: { logger: false }, ownershipClient });
  await sampleApp.listen({ port: samplePort, host: "127.0.0.1" });
  console.log(`[Service] Sample App listening on http://127.0.0.1:${samplePort}`);

  try {
    const SAMPLE_APP_URL = `http://127.0.0.1:${samplePort}`;
    const OWNERSHIP_URL = `http://127.0.0.1:${ownershipPort}`;

    // Health checks
    const sampleHealth = await fetch(`${SAMPLE_APP_URL}/health`);
    console.log(`[Health] Sample App /health -> status ${sampleHealth.status}`);
    if (!sampleHealth.ok) throw new Error("Sample App health check failed");

    const ownershipHealth = await fetch(`${OWNERSHIP_URL}/health`);
    console.log(`[Health] Ownership Service /health -> status ${ownershipHealth.status}`);
    if (!ownershipHealth.ok) throw new Error("Ownership Service health check failed");

    // OpenAPI Check
    console.log("\n[OpenAPI] Validating GET /openapi.json...");
    const openApiRes = await fetch(`${SAMPLE_APP_URL}/openapi.json`);
    if (!openApiRes.ok) throw new Error(`GET /openapi.json failed: ${openApiRes.status}`);
    const openApiDoc = (await openApiRes.json()) as any;
    console.log(`✓ OpenAPI version: ${openApiDoc.openapi}, paths documented: ${Object.keys(openApiDoc.paths).length}`);

    // Fixtures Check
    console.log("\n[Fixtures] Validating GET /_test/fixtures...");
    const fixturesRes = await fetch(`${SAMPLE_APP_URL}/_test/fixtures`);
    if (!fixturesRes.ok) throw new Error(`GET /_test/fixtures failed: ${fixturesRes.status}`);
    const fixtures = (await fixturesRes.json()) as any;
    console.log(`✓ Fixtures verified: ${fixtures.users.length} users, ${fixtures.objects.orders.length} orders, ${fixtures.delegations.length} delegations.`);
    if (JSON.stringify(fixtures).includes("password123")) {
      throw new Error("Security Violation: Fixtures exposed user passwords!");
    }
    console.log("✓ Fixtures password safety verified (no secrets exposed).");

    // Authentication Checks
    console.log("\n[Auth] Authenticating as userA1...");
    const loginRes = await fetch(`${SAMPLE_APP_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userA1@example.com", password: "password123" }),
    });
    if (!loginRes.ok) throw new Error(`Login failed with status ${loginRes.status}`);
    const { token: tokenA1 } = (await loginRes.json()) as { token: string };
    console.log("✓ userA1 authenticated. JWT acquired.");

    console.log("[Auth] Testing invalid credentials rejection...");
    const badLogin = await fetch(`${SAMPLE_APP_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userA1@example.com", password: "wrongpassword" }),
    });
    if (badLogin.status !== 401) throw new Error("Expected 401 for invalid credentials");
    console.log("✓ Invalid credentials rejected with 401.");

    // Protected Route without token
    console.log("[Auth] Testing missing auth header rejection...");
    const noAuth = await fetch(`${SAMPLE_APP_URL}/api/orders/101`);
    if (noAuth.status !== 401) throw new Error("Expected 401 for missing auth");
    console.log("✓ Missing auth header rejected with 401.");

    // GET order 101 (own order)
    console.log("\n[Orders] Fetching own order 101 (tenantA)...");
    const get101Res = await fetch(`${SAMPLE_APP_URL}/api/orders/101`, {
      headers: { Authorization: `Bearer ${tokenA1}` },
    });
    if (!get101Res.ok) throw new Error(`GET 101 failed: ${get101Res.status}`);
    const order101 = (await get101Res.json()) as any;
    console.log(`✓ GET 101 returned 200. Items: ${order101.items?.[0]?.item}, Tenant: ${order101.tenantId}`);

    // GET order 201 (vulnerable mode BOLA)
    console.log("\n[BOLA] Requesting cross-tenant order 201 (tenantB) in APP_MODE=vulnerable...");
    const get201Res = await fetch(`${SAMPLE_APP_URL}/api/orders/201`, {
      headers: { Authorization: `Bearer ${tokenA1}` },
    });
    if (!get201Res.ok) throw new Error(`GET 201 failed: ${get201Res.status}`);
    const order201 = (await get201Res.json()) as any;
    console.log(`✓ GET 201 returned 200. BOLA confirmed. Items: ${order201.items?.[0]?.item}, Tenant: ${order201.tenantId}`);

    // POST a new order as userA1
    console.log("\n[Write-Through] Creating new order as userA1 with write-through ownership sync...");
    const postRes = await fetch(`${SAMPLE_APP_URL}/api/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA1}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ item: "E2E Hardening Headset", quantity: 1, price: 149.99 }],
        totalAmount: 149.99,
        status: "pending",
      }),
    });
    if (!postRes.ok) throw new Error(`POST order failed: ${postRes.status}`);
    const createdOrder = (await postRes.json()) as any;
    const orderId = createdOrder.id;
    console.log(`✓ Order created with ID: ${orderId}, Owner: ${createdOrder.ownerUserId}, Tenant: ${createdOrder.tenantId}`);

    // Confirm ownership written to Redis through Ownership Service
    console.log("\n[Ownership] Querying Ownership Service for newly created order ownership...");
    const ownershipRes = await fetch(`${OWNERSHIP_URL}/v1/ownership/orders/${orderId}`);
    if (!ownershipRes.ok) throw new Error(`Ownership check failed: ${ownershipRes.status}`);
    const ownershipData = (await ownershipRes.json()) as any;
    console.log(`✓ Ownership record verified in Redis: resourceType=${ownershipData.resourceType}, objectId=${ownershipData.objectId}, tenantId=${ownershipData.tenantId}, ownerUserId=${ownershipData.ownerUserId}`);

    // DELETE the newly created order
    console.log(`\n[Delete Sync] Deleting order ${orderId}...`);
    const deleteRes = await fetch(`${SAMPLE_APP_URL}/api/orders/${orderId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA1}` },
    });
    if (!deleteRes.ok) throw new Error(`DELETE order failed: ${deleteRes.status}`);
    console.log(`✓ Order ${orderId} deleted successfully.`);

    // Confirm ownership removed from Ownership Service
    console.log("\n[Ownership Removal] Verifying ownership removed from Ownership Service...");
    const ownershipAfterDelete = await fetch(`${OWNERSHIP_URL}/v1/ownership/orders/${orderId}`);
    if (ownershipAfterDelete.status !== 404) {
      throw new Error(`Expected 404 for deleted ownership, got ${ownershipAfterDelete.status}`);
    }
    console.log("✓ Ownership record successfully deleted (received 404 Not Found).");

    // Login as userB1 and verify delegation seed
    console.log("\n[Delegation] Authenticating as userB1 and checking frozen delegation seed...");
    const loginB1 = await fetch(`${SAMPLE_APP_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userB1@example.com", password: "password123" }),
    });
    if (!loginB1.ok) throw new Error("userB1 login failed");
    console.log("✓ userB1 authenticated.");

    const delegRes = await fetch(`${OWNERSHIP_URL}/v1/delegations/userB1:tenantA:orders`);
    if (!delegRes.ok) throw new Error(`Delegation lookup failed: ${delegRes.status}`);
    const delegData = (await delegRes.json()) as any;
    console.log(`✓ Frozen delegation verified: grantee=${delegData.granteeUserId}, ownerTenant=${delegData.ownerTenantId}, resourceType=${delegData.resourceType}, actions=${delegData.actions}, isValid=${delegData.isValid}`);

    // Verify delegation expiry validation
    console.log("\n[Delegation Expiry] Testing delegation expiration logic...");
    const pastEpoch = Math.floor(Date.now() / 1000) - 3600;
    await fetch(`${OWNERSHIP_URL}/v1/delegations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        granteeUserId: "userA2",
        ownerTenantId: "tenantB",
        resourceType: "orders",
        actions: "read",
        expiresAt: pastEpoch,
      }),
    });

    const expiredCheck = await fetch(`${OWNERSHIP_URL}/v1/delegations/userA2:tenantB:orders`);
    if (expiredCheck.status !== 410) {
      throw new Error(`Expected status 410 for expired delegation, got ${expiredCheck.status}`);
    }
    console.log("✓ Expired delegation rejected (received 410 Gone / isValid=false).");

    console.log("\n==================================================================");
    console.log(" ALL HARDENING AND CONTRACT VERIFICATION CHECKS PASSED CLEANLY!");
    console.log("==================================================================");
  } finally {
    await sampleApp.close();
    await ownershipApp.close();
  }
}

runE2E().catch((err) => {
  console.error("E2E Hardening check failed:", err);
  process.exit(1);
});
