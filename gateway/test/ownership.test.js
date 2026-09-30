const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { SignJWT } = require("jose");
const { authenticate } = require("../src/auth/authenticate");
const { authorize } = require("../src/auth/authorize");
const { checkOwnership, verifyObjectOwnership } = require("../src/auth/ownership");

const TEST_SECRET = "test-secret-key-1234567890";
const secretBytes = new TextEncoder().encode(TEST_SECRET);

async function buildTestApp() {
  process.env.JWT_SECRET = TEST_SECRET;

  const app = Fastify();

  const pipeline = [authenticate, authorize, checkOwnership];

  app.get("/api/orders", { preHandler: pipeline }, async (req) => {
    return { ok: true, route: "GET /api/orders" };
  });

  app.get("/api/orders/:id", { preHandler: pipeline }, async (req) => {
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

test("verifyObjectOwnership unit tests", async () => {
  const userA = { sub: "userA1", tenant_id: "tenantA", org_id: "org1" };
  assert.equal(await verifyObjectOwnership(userA, "orders", "201"), true);

  const userB = { sub: "userB1", tenant_id: "tenantA", org_id: "org1" };
  assert.equal(await verifyObjectOwnership(userB, "orders", "201"), false);

  const wrongTenantUser = { sub: "userA1", tenant_id: "tenantB", org_id: "org1" };
  assert.equal(await verifyObjectOwnership(wrongTenantUser, "orders", "201"), false);

  const wrongOrgUser = { sub: "userA1", tenant_id: "tenantA", org_id: "org2" };
  assert.equal(await verifyObjectOwnership(wrongOrgUser, "orders", "201"), false);

  assert.equal(await verifyObjectOwnership(userA, "orders", "999"), false);
});

test("A: Allowed owner userA1 + tenantA + org1 can access order 201", async () => {
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

test("B: Wrong user userB1 cannot access userA1's order 201 -> 403 Forbidden", async () => {
  const app = await buildTestApp();
  const token = await createToken("userB1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  const json = res.json();
  assert.equal(json.error, "Forbidden");
  assert.equal(json.message, "Access forbidden: object ownership check failed");
  await app.close();
});

test("C: Wrong tenant user cannot access order 201 -> 403 Forbidden", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "Forbidden");
  await app.close();
});

test("D: Wrong organization user cannot access order 201 -> 403 Forbidden", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org2", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "Forbidden");
  await app.close();
});

test("E: Unknown object 999 returns 403 Forbidden without revealing existence", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/999",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  const json = res.json();
  assert.equal(json.message, "Access forbidden: object ownership check failed");
  assert.equal(res.payload.includes("999"), false);
  assert.equal(res.payload.includes("userA1"), false);
  await app.close();
});

test("F: Collection endpoint GET /api/orders is allowed without object ownership check", async () => {
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

test("G: Missing scope returns 403 from scope authorization before ownership check", async () => {
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

test("H: Missing authentication returns 401 Unauthorized", async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201"
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, "Unauthorized");
  await app.close();
});

test("I: Public /_zt/health remains unauthenticated and accessible", async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: "GET",
    url: "/_zt/health"
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, "ok");
  await app.close();
});

test("J: Security isolation - 403 response contains no secrets, tokens, or owner/tenant/org identities", async () => {
  const app = await buildTestApp();
  const token = await createToken("userB1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: {
      authorization: `Bearer ${token}`,
      "x-client-owner": "userA1",
      "x-override-tenant": "tenantA"
    }
  });

  assert.equal(res.statusCode, 403);
  const payloadStr = res.payload;

  assert.equal(payloadStr.includes(token), false);
  assert.equal(payloadStr.includes(TEST_SECRET), false);
  assert.equal(payloadStr.includes("authorization"), false);
  assert.equal(payloadStr.includes("userA1"), false);
  assert.equal(payloadStr.includes("tenantA"), false);
  assert.equal(payloadStr.includes("org1"), false);

  await app.close();
});

test("Ownership data is NOT trusted from client headers or request body", async () => {
  const app = await buildTestApp();
  // userB1 trying to spoof userA1 via custom header
  const token = await createToken("userB1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: {
      authorization: `Bearer ${token}`,
      "x-claim-sub": "userA1"
    },
    payload: {
      sub: "userA1",
      owner: "userA1"
    }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().message, "Access forbidden: object ownership check failed");
  await app.close();
});
