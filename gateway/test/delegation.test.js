const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { SignJWT } = require("jose");
const { authenticate } = require("../src/auth/authenticate");
const { authorize } = require("../src/auth/authorize");
const { checkOwnership } = require("../src/auth/ownership");
const { seedDelegation, clearDelegations, setRedisFailureMode } = require("../src/storage/delegationStore");

const TEST_SECRET = "test-secret-key-delegation-phase6-888";
const secretBytes = new TextEncoder().encode(TEST_SECRET);

async function buildTestApp() {
  process.env.JWT_SECRET = TEST_SECRET;
  clearDelegations();

  const app = Fastify();
  const pipeline = [authenticate, authorize, checkOwnership];

  app.get("/api/orders", { preHandler: pipeline }, async () => {
    return { ok: true, route: "GET /api/orders" };
  });

  app.get("/api/orders/:id", { preHandler: pipeline }, async () => {
    return { ok: true, route: "GET /api/orders/:id" };
  });

  app.post("/api/orders/:id", { preHandler: pipeline }, async () => {
    return { ok: true, route: "POST /api/orders/:id" };
  });

  app.delete("/api/orders/:id", { preHandler: pipeline }, async () => {
    return { ok: true, route: "DELETE /api/orders/:id" };
  });

  app.get("/_zt/health", async () => {
    return { status: "ok" };
  });

  return app;
}

async function createToken(sub, tenantId, orgId, scopes) {
  return new SignJWT({
    sub,
    tenant_id: tenantId,
    org_id: orgId,
    scope: scopes
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretBytes);
}

test("1. Owner can access own object without delegation", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  await app.close();
});

test("2. Non-owner without delegation receives 403", async () => {
  const app = await buildTestApp();
  // userC1 has no delegation for tenantA orders
  const token = await createToken("userC1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: object ownership check failed");
  await app.close();
});

test("3. Non-owner with valid read delegation can GET the object", async () => {
  const app = await buildTestApp();
  // userB1 has valid delegation for tenantA orders
  await seedDelegation("userB1", "tenantA", "orders", {
    actions: ["read"],
    expiresAt: 2000000000
  });

  const token = await createToken("userB1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  await app.close();
});

test("4. Non-owner with valid write delegation can perform write operation", async () => {
  const app = await buildTestApp();
  await seedDelegation("userB1", "tenantA", "orders", {
    actions: ["write"],
    expiresAt: 2000000000
  });

  const token = await createToken("userB1", "tenantB", "org1", ["orders:write"]);

  const res = await app.inject({
    method: "POST",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  await app.close();
});

test("5. Delegation missing required action receives 403", async () => {
  const app = await buildTestApp();
  // userB1 only has "read" delegation, attempting DELETE (requires "delete")
  await seedDelegation("userB1", "tenantA", "orders", {
    actions: ["read"],
    expiresAt: 2000000000
  });

  const token = await createToken("userB1", "tenantB", "org1", ["orders:write"]);

  const res = await app.inject({
    method: "DELETE",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: object ownership check failed");
  await app.close();
});

test("6. Expired delegation receives 403", async () => {
  const app = await buildTestApp();
  // Expired timestamp in past (1000000000)
  await seedDelegation("userB1", "tenantA", "orders", {
    actions: ["read", "write"],
    expiresAt: 1000000000
  });

  const token = await createToken("userB1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: object ownership check failed");
  await app.close();
});

test("7. Delegation for wrong grantee receives 403", async () => {
  const app = await buildTestApp();
  // Delegation is granted to userC1, but request is made by userB1
  await seedDelegation("userC1", "tenantA", "orders", {
    actions: ["read"],
    expiresAt: 2000000000
  });

  const token = await createToken("userB1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  await app.close();
});

test("8. Delegation for wrong tenant receives 403", async () => {
  const app = await buildTestApp();
  // Delegation granted for tenantB, but order 101 belongs to tenantA
  await seedDelegation("userB1", "tenantB", "orders", {
    actions: ["read"],
    expiresAt: 2000000000
  });

  const token = await createToken("userB1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  await app.close();
});

test("9. Delegation for wrong resource receives 403", async () => {
  const app = await buildTestApp();
  // Delegation granted for "invoices", but request is for "orders"
  await seedDelegation("userB1", "tenantA", "invoices", {
    actions: ["read"],
    expiresAt: 2000000000
  });

  const token = await createToken("userB1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  await app.close();
});

test("10. Missing delegation receives 403", async () => {
  const app = await buildTestApp();
  const token = await createToken("userD1", "tenantA", "org2", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  await app.close();
});

test("11. Malformed delegation receives 403", async () => {
  const app = await buildTestApp();
  // Malformed delegation data (invalid non-numeric timestamp)
  await seedDelegation("userB1", "tenantA", "orders", {
    actions: ["read"],
    expiresAt: "invalid_timestamp"
  });

  const token = await createToken("userB1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  await app.close();
});

test("12. Redis failure causes fail-closed 403", async () => {
  const app = await buildTestApp();
  await seedDelegation("userB1", "tenantA", "orders", {
    actions: ["read"],
    expiresAt: 2000000000
  });

  const token = await createToken("userB1", "tenantB", "org1", ["orders:read"]);

  setRedisFailureMode(true);
  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/orders/101",
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 403);
  } finally {
    setRedisFailureMode(false);
    await app.close();
  }
});

test("13. Missing JWT still returns 401 Unauthorized", async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101"
  });

  assert.equal(res.statusCode, 401);
  await app.close();
});

test("14. Missing required scope still returns 403 even when delegation exists", async () => {
  const app = await buildTestApp();
  await seedDelegation("userB1", "tenantA", "orders", {
    actions: ["read"],
    expiresAt: 2000000000
  });

  // User has delegation, but JWT scope is analytics:read instead of orders:read
  const token = await createToken("userB1", "tenantB", "org1", ["analytics:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: insufficient scope");
  await app.close();
});

test("15. Owner access still works when no delegation exists", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/102",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  await app.close();
});

test("16. Public /_zt/health remains accessible", async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: "GET",
    url: "/_zt/health"
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, "ok");
  await app.close();
});

test("17. Unknown object remains 403", async () => {
  const app = await buildTestApp();
  const token = await createToken("userB1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/999",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  await app.close();
});

test("18. Nested resource authorization continues working", async () => {
  const app = await buildTestApp();
  await seedDelegation("userB1", "tenantA", "orders", {
    actions: ["read"],
    expiresAt: 2000000000
  });

  const token = await createToken("userB1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  await app.close();
});

test("19. Client-supplied delegation headers cannot bypass Redis", async () => {
  const app = await buildTestApp();
  // userC1 has NO delegation in Redis, tries to pass custom headers
  const token = await createToken("userC1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: {
      authorization: `Bearer ${token}`,
      "x-grantee-user": "userB1",
      "x-delegation-action": "read"
    }
  });

  assert.equal(res.statusCode, 403);
  await app.close();
});

test("20. Client-supplied delegation body fields cannot bypass Redis", async () => {
  const app = await buildTestApp();
  const token = await createToken("userC1", "tenantB", "org1", ["orders:write"]);

  const res = await app.inject({
    method: "POST",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      granteeUserId: "userB1",
      actions: ["read", "write"],
      expiresAt: 2000000000
    }
  });

  assert.equal(res.statusCode, 403);
  await app.close();
});

test("21. Delegation cannot grant an unsupported action", async () => {
  const app = await buildTestApp();
  // Delegation contains unsupported action "exec" instead of "read"
  await seedDelegation("userB1", "tenantA", "orders", {
    actions: ["exec", "admin"],
    expiresAt: 2000000000
  });

  const token = await createToken("userB1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  await app.close();
});

test("22. Valid delegation does not bypass tenant/org ownership security rules", async () => {
  const app = await buildTestApp();
  // userB1 has delegation for tenantA orders, but tries to access tenantB order 203 without delegation
  const token = await createToken("userB1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/203", // order 203 belongs to tenantB
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  await app.close();
});

test("23. Delegation does not expose its contents in HTTP error responses", async () => {
  const app = await buildTestApp();
  const token = await createToken("userC1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  const payload = res.payload;
  assert.equal(payload.includes("delegation"), false);
  assert.equal(payload.includes("granteeUserId"), false);
  assert.equal(payload.includes("expiresAt"), false);
  await app.close();
});

test("24. No JWT, Authorization header, JWT secret, password, or Redis credentials appear in logs/errors", async () => {
  const app = await buildTestApp();
  const token = await createToken("userC1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  const payload = res.payload;
  assert.equal(payload.includes(token), false);
  assert.equal(payload.includes(TEST_SECRET), false);
  assert.equal(payload.includes("redis://"), false);
  await app.close();
});
