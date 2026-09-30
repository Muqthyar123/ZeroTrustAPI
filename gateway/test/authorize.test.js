const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { SignJWT } = require("jose");
const { authenticate } = require("../src/auth/authenticate");
const { authorize, getRequiredScope } = require("../src/auth/authorize");

const TEST_SECRET = "test-secret-key-1234567890";
const secretBytes = new TextEncoder().encode(TEST_SECRET);

async function buildTestApp() {
  process.env.JWT_SECRET = TEST_SECRET;

  const app = Fastify();

  app.get("/api/orders", { preHandler: [authenticate, authorize] }, async (req) => {
    return { ok: true, route: "GET /api/orders" };
  });

  app.post("/api/orders", { preHandler: [authenticate, authorize] }, async (req) => {
    return { ok: true, route: "POST /api/orders" };
  });

  app.delete("/api/orders/:id", { preHandler: [authenticate, authorize] }, async (req) => {
    return { ok: true, route: "DELETE /api/orders/:id" };
  });

  app.get("/api/orders/:id", { preHandler: [authenticate, authorize] }, async (req) => {
    return { ok: true, route: "GET /api/orders/:id" };
  });

  app.get("/api/unknown-route", { preHandler: [authenticate, authorize] }, async (req) => {
    return { ok: true };
  });

  app.get("/_zt/health", async () => {
    return { status: "ok" };
  });

  return app;
}

async function createTokenWithScopes(scopes) {
  return new SignJWT({
    sub: "userA1",
    tenant_id: "tenantA",
    org_id: "org1",
    scope: scopes
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretBytes);
}

test("getRequiredScope helper maps HTTP methods to scopes", () => {
  assert.equal(getRequiredScope("GET", "orders", null), "orders:read");
  assert.equal(getRequiredScope("POST", "orders", null), "orders:write");
  assert.equal(getRequiredScope("PUT", "orders", null), "orders:write");
  assert.equal(getRequiredScope("PATCH", "orders", null), "orders:write");
  assert.equal(getRequiredScope("DELETE", "orders", null), "orders:write");
  assert.equal(getRequiredScope("OPTIONS", "orders", null), null);
  assert.equal(
    getRequiredScope("GET", "orders", { requiredScope: "custom:scope" }),
    "custom:scope"
  );
});

test("GET orders with orders:read scope is allowed", async () => {
  const app = await buildTestApp();
  const token = await createTokenWithScopes(["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  await app.close();
});

test("GET orders without orders:read scope returns 403 Forbidden", async () => {
  const app = await buildTestApp();
  const token = await createTokenWithScopes(["users:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "Forbidden");
  await app.close();
});

test("POST orders with orders:write scope is allowed", async () => {
  const app = await buildTestApp();
  const token = await createTokenWithScopes(["orders:write"]);

  const res = await app.inject({
    method: "POST",
    url: "/api/orders",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  await app.close();
});

test("POST orders without orders:write scope returns 403 Forbidden", async () => {
  const app = await buildTestApp();
  const token = await createTokenWithScopes(["orders:read"]);

  const res = await app.inject({
    method: "POST",
    url: "/api/orders",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "Forbidden");
  await app.close();
});

test("DELETE orders/201 with orders:write scope is allowed", async () => {
  const app = await buildTestApp();
  const token = await createTokenWithScopes(["orders:write"]);

  const res = await app.inject({
    method: "DELETE",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  await app.close();
});

test("DELETE orders/201 without orders:write scope returns 403 Forbidden", async () => {
  const app = await buildTestApp();
  const token = await createTokenWithScopes(["orders:read"]);

  const res = await app.inject({
    method: "DELETE",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "Forbidden");
  await app.close();
});

test("Authentication failures still return 401 Unauthorized before authorization runs", async () => {
  const app = await buildTestApp();

  const res1 = await app.inject({
    method: "GET",
    url: "/api/orders"
  });
  assert.equal(res1.statusCode, 401);

  const res2 = await app.inject({
    method: "GET",
    url: "/api/orders",
    headers: { authorization: "Bearer invalid.jwt.token" }
  });
  assert.equal(res2.statusCode, 401);

  await app.close();
});

test("User with multiple scopes including required scope is allowed", async () => {
  const app = await buildTestApp();
  const token = await createTokenWithScopes(["users:read", "orders:read", "reports:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  await app.close();
});

test("Unknown or unregistered route returns 403 Forbidden", async () => {
  const app = await buildTestApp();
  const token = await createTokenWithScopes(["orders:read", "admin:all"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/unknown-route",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "Forbidden");
  await app.close();
});

test("Public /_zt/health remains unauthenticated and accessible", async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: "GET",
    url: "/_zt/health"
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, "ok");
  await app.close();
});

test("Error responses do not leak secrets, JWTs, or Authorization headers", async () => {
  const app = await buildTestApp();
  const token = await createTokenWithScopes(["orders:read"]);

  const res = await app.inject({
    method: "POST",
    url: "/api/orders",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  const responseText = res.payload;

  assert.equal(responseText.includes(token), false);
  assert.equal(responseText.includes(TEST_SECRET), false);
  assert.equal(responseText.includes("authorization"), false);
  await app.close();
});
