/**
 * ZeroTrustAPI M2 End-to-End Verification Script
 *
 * Verifies the live flow against running Docker Compose or local services:
 * 1. Health checks (Sample App, Ownership Service)
 * 2. GET /openapi.json -> Valid OpenAPI 3.0 document
 * 3. GET /_test/fixtures -> Deterministic test fixtures without secrets
 * 4. Login as userA1 -> Obtain JWT
 * 5. GET order 101 (own order)
 * 6. GET order 201 (vulnerable BOLA test)
 * 7. POST new order as userA1
 * 8. Confirm ownership written to Redis through Ownership Service
 * 9. DELETE the newly created order
 * 10. Confirm ownership removed from Ownership Service
 * 11. Login as userB1
 * 12. Verify frozen delegation seed exists (userB1 -> tenantA -> orders -> read)
 * 13. Verify delegation expiry validation
 */

const SAMPLE_APP_URL = (process.env.SAMPLE_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const OWNERSHIP_URL = (process.env.OWNERSHIP_BASE_URL || process.env.OWNERSHIP_SERVICE_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

async function main() {
  console.log("==================================================================");
  console.log(" ZeroTrustAPI M2 - End-to-End Verification");
  console.log(` Sample App:        ${SAMPLE_APP_URL}`);
  console.log(` Ownership Service: ${OWNERSHIP_URL}`);
  console.log("==================================================================");

  // Health checks
  const sampleHealth = await fetch(`${SAMPLE_APP_URL}/health`);
  console.log(`[Health] Sample App /health -> status ${sampleHealth.status}`);
  if (!sampleHealth.ok) throw new Error("Sample App health check failed");

  const ownershipHealth = await fetch(`${OWNERSHIP_URL}/health`);
  console.log(`[Health] Ownership Service /health -> status ${ownershipHealth.status}`);
  if (!ownershipHealth.ok) throw new Error("Ownership Service health check failed");

  // OpenAPI Check
  console.log("\n[Contract] Fetching GET /openapi.json...");
  const openApiRes = await fetch(`${SAMPLE_APP_URL}/openapi.json`);
  if (!openApiRes.ok) throw new Error(`GET /openapi.json failed: ${openApiRes.status}`);
  const openApiDoc = (await openApiRes.json()) as any;
  console.log(`✓ OpenAPI version: ${openApiDoc.openapi}, paths documented: ${Object.keys(openApiDoc.paths).length}`);

  // Test Fixtures Check
  console.log("\n[Fixtures] Fetching GET /_test/fixtures...");
  const fixturesRes = await fetch(`${SAMPLE_APP_URL}/_test/fixtures`);
  if (!fixturesRes.ok) throw new Error(`GET /_test/fixtures failed: ${fixturesRes.status}`);
  const fixtures = (await fixturesRes.json()) as any;
  console.log(`✓ Fixtures loaded: ${fixtures.users.length} users, ${fixtures.objects.orders.length} orders, ${fixtures.delegations.length} delegations.`);
  if (JSON.stringify(fixtures).includes("password123")) {
    throw new Error("Security Violation: Fixtures exposed user passwords!");
  }
  console.log("✓ Fixtures password safety verified (no secrets exposed).");

  // Step 1 & 2: Login as userA1
  console.log("\n[Step 1 & 2] Authenticating as userA1...");
  const loginRes = await fetch(`${SAMPLE_APP_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "userA1@example.com", password: "password123" }),
  });
  if (!loginRes.ok) throw new Error(`Login failed with status ${loginRes.status}`);
  const { token: tokenA1 } = (await loginRes.json()) as { token: string };
  console.log("✓ userA1 authenticated. JWT acquired.");

  // Step 3: GET order 101
  console.log("\n[Step 3] Fetching own order 101 (tenantA)...");
  const get101Res = await fetch(`${SAMPLE_APP_URL}/api/orders/101`, {
    headers: { Authorization: `Bearer ${tokenA1}` },
  });
  if (!get101Res.ok) throw new Error(`GET 101 failed: ${get101Res.status}`);
  const order101 = (await get101Res.json()) as any;
  console.log(`✓ GET 101 returned status 200. Items: ${order101.items?.[0]?.item}, Tenant: ${order101.tenantId}`);

  // Step 4: GET order 201 (vulnerable mode BOLA)
  console.log("\n[Step 4] Requesting cross-tenant order 201 (tenantB) in APP_MODE=vulnerable...");
  const get201Res = await fetch(`${SAMPLE_APP_URL}/api/orders/201`, {
    headers: { Authorization: `Bearer ${tokenA1}` },
  });
  if (!get201Res.ok) throw new Error(`GET 201 failed: ${get201Res.status}`);
  const order201 = (await get201Res.json()) as any;
  console.log(`✓ GET 201 returned status 200. BOLA confirmed. Items: ${order201.items?.[0]?.item}, Tenant: ${order201.tenantId}`);

  // Step 5: POST a new order as userA1
  console.log("\n[Step 5] Creating new order as userA1 with write-through ownership sync...");
  const postRes = await fetch(`${SAMPLE_APP_URL}/api/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenA1}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ item: "E2E Test Headset", quantity: 1, price: 149.99 }],
      totalAmount: 149.99,
      status: "pending",
    }),
  });
  if (!postRes.ok) throw new Error(`POST order failed: ${postRes.status}`);
  const createdOrder = (await postRes.json()) as any;
  const orderId = createdOrder.id;
  console.log(`✓ Order created with ID: ${orderId}, Owner: ${createdOrder.ownerUserId}, Tenant: ${createdOrder.tenantId}`);

  // Step 6: Confirm ownership written to Redis through Ownership Service
  console.log("\n[Step 6] Querying Ownership Service for newly created order ownership...");
  const ownershipRes = await fetch(`${OWNERSHIP_URL}/v1/ownership/orders/${orderId}`);
  if (!ownershipRes.ok) throw new Error(`Ownership check failed: ${ownershipRes.status}`);
  const ownershipData = (await ownershipRes.json()) as any;
  console.log(`✓ Ownership record verified in Redis: resourceType=${ownershipData.resourceType}, objectId=${ownershipData.objectId}, tenantId=${ownershipData.tenantId}, ownerUserId=${ownershipData.ownerUserId}`);

  // Step 7: DELETE the newly created order
  console.log(`\n[Step 7] Deleting order ${orderId}...`);
  const deleteRes = await fetch(`${SAMPLE_APP_URL}/api/orders/${orderId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA1}` },
  });
  if (!deleteRes.ok) throw new Error(`DELETE order failed: ${deleteRes.status}`);
  console.log(`✓ Order ${orderId} deleted successfully.`);

  // Step 8: Confirm ownership removed from Ownership Service
  console.log("\n[Step 8] Verifying ownership removed from Ownership Service...");
  const ownershipAfterDelete = await fetch(`${OWNERSHIP_URL}/v1/ownership/orders/${orderId}`);
  if (ownershipAfterDelete.status !== 404) {
    throw new Error(`Expected 404 for deleted ownership, got ${ownershipAfterDelete.status}`);
  }
  console.log("✓ Ownership record successfully deleted (received 404 Not Found).");

  // Step 9 & 10: Login as userB1 and verify delegation seed exists
  console.log("\n[Step 9 & 10] Authenticating as userB1 and checking frozen delegation seed...");
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

  // Step 11: Verify delegation expiry validation
  console.log("\n[Step 11] Testing delegation expiration logic...");
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
  console.log(" ALL END-TO-END CONTRACT & INTEGRATION CHECKS PASSED CLEANLY!");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("\n❌ E2E Verification Failed:", err);
  process.exit(1);
});
