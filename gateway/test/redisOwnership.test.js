const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { SignJWT } = require("jose");
const { authenticate } = require("../src/auth/authenticate");
const { authorize } = require("../src/auth/authorize");
const { checkOwnership, verifyObjectOwnership } = require("../src/auth/ownership");
const { setRedisFailureMode, seedObjectAccess } = require("../src/storage/ownershipStore");

const TEST_SECRET = "test-secret-key-redis-phase5-999";
const secretBytes = new TextEncoder().encode(TEST_SECRET);

async function buildTestApp() {
  process.env.JWT_SECRET = TEST_SECRET;

  const app = Fastify();

  const pipeline = [authenticate, authorize, checkOwnership];

  app.get("/api/orders", { preHandler: pipeline }, async () => {
    return { ok: true, route: "GET /api/orders" };
  });

  app.get("/api/orders/:id", { preHandler: pipeline }, async () => {
    return { ok: true, route: "GET /api/orders/:id" };
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

test("Phase 5 - 1. Redis ownership lookup: userA1 + tenantA + org1 accessing orders/201 -> allowed", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  await app.close();
});

test("Phase 5 - 2. Wrong owner: userB1 + tenantA + org1 accessing orders/201 -> 403", async () => {
  const app = await buildTestApp();
  const token = await createToken("userB1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: object ownership check failed");
  await app.close();
});

test("Phase 5 - 3. Wrong tenant: userA1 + tenantB + org1 accessing orders/201 -> 403", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: object ownership check failed");
  await app.close();
});

test("Phase 5 - 4. Wrong org: userA1 + tenantA + org2 accessing orders/201 -> 403", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org2", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: object ownership check failed");
  await app.close();
});

test("Phase 5 - 5. Unknown object: orders/999 -> 403 Forbidden without 404 leakage", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/999",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: object ownership check failed");
  assert.equal(res.payload.includes("999"), false);
  await app.close();
});

test("Phase 5 - 6. Collection endpoint GET /api/orders does not perform object-level Redis lookup", async () => {
  const app = await buildTestApp();
  const token = await createToken("userB1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  await app.close();
});

test("Phase 5 - 7. Missing scope: authenticated user without orders:read -> 403 before object lookup", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["users:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: insufficient scope");
  await app.close();
});

test("Phase 5 - 8. Missing JWT -> 401 Unauthorized", async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201"
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, "Unauthorized");
  await app.close();
});

test("Phase 5 - 9. Invalid JWT -> 401 Unauthorized", async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: "Bearer invalid.jwt.token" }
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, "Unauthorized");
  await app.close();
});

test("Phase 5 - 10. Public health /_zt/health -> 200 OK", async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: "GET",
    url: "/_zt/health"
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, "ok");
  await app.close();
});

test("Phase 5 - 11. Redis unavailable: object-specific request fails closed (403)", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  setRedisFailureMode(true);
  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/orders/201",
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.json().message, "Access forbidden: object ownership check failed");
  } finally {
    setRedisFailureMode(false);
    await app.close();
  }
});

test("Phase 5 - 12. No credential leakage in 403 responses", async () => {
  const app = await buildTestApp();
  const token = await createToken("userB1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  const body = res.payload;
  assert.equal(body.includes(token), false);
  assert.equal(body.includes(TEST_SECRET), false);
  assert.equal(body.includes("redis://"), false);
  assert.equal(body.includes("userA1"), false);
  assert.equal(body.includes("tenantA"), false);
  assert.equal(body.includes("org1"), false);

  await app.close();
});

test("Phase 5 - 13. Client-supplied ownership headers/body cannot bypass Redis", async () => {
  const app = await buildTestApp();
  const token = await createToken("userB1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: {
      authorization: `Bearer ${token}`,
      "x-owner-sub": "userA1",
      "x-tenant-id": "tenantA",
      "x-org-id": "org1"
    },
    payload: {
      owner_sub: "userA1",
      tenant_id: "tenantA"
    }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: object ownership check failed");
  await app.close();
});

test("Phase 5 - 14. Correct scope + wrong Redis ownership -> 403", async () => {
  const app = await buildTestApp();
  // Scope is correct (orders:read), but userB1 does not own order 201
  const token = await createToken("userB1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: object ownership check failed");
  await app.close();
});

test("Phase 5 - 15. Correct Redis ownership + missing scope -> 403", async () => {
  const app = await buildTestApp();
  // userA1 owns order 201, but token lacks orders:read scope
  const token = await createToken("userA1", "tenantA", "org1", ["analytics:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: insufficient scope");
  await app.close();
});
