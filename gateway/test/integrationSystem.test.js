const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { SignJWT } = require("jose");
const { authenticate } = require("../src/auth/authenticate");
const { authorize } = require("../src/auth/authorize");
const { checkOwnership } = require("../src/auth/ownership");
const { seedObjectAccess } = require("../src/storage/ownershipStore");
const { seedDelegation, clearDelegations } = require("../src/storage/delegationStore");
const { getPublishedEvents, getLastPublishedEvent, clearPublishedEvents, setPublisherFailureMode } = require("../src/events/eventPublisher");

const JWT_SECRET = "development-secret";
const secretBytes = new TextEncoder().encode(JWT_SECRET);

async function buildTestApp() {
  process.env.JWT_SECRET = JWT_SECRET;
  clearDelegations();
  clearPublishedEvents();

  const app = Fastify();
  const pipeline = [authenticate, authorize, checkOwnership];

  app.get("/api/orders", { preHandler: pipeline }, async () => {
    return { ok: true, route: "GET /api/orders" };
  });

  app.get("/api/orders/:id", { preHandler: pipeline }, async () => {
    return { ok: true, route: "GET /api/orders/:id" };
  });

  app.get("/api/invoices/:id", { preHandler: pipeline }, async () => {
    return { ok: true, route: "GET /api/invoices/:id" };
  });

  app.get("/api/users/:userId/documents/:documentId", { preHandler: pipeline }, async () => {
    return { ok: true, route: "GET /api/users/:userId/documents/:documentId" };
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

test("Scenario A: userA1 accessing order 101 -> 200 OK (OK_OWNER)", async () => {
  const app = await buildTestApp();
  await seedObjectAccess("orders", "101", { ownerUserId: "userA1", tenantId: "tenantA" });
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  const event = getLastPublishedEvent();
  assert.equal(event.decision, "ALLOW");
  assert.equal(event.reason, "OK_OWNER");
  await app.close();
});

test("Scenario B: userA1 accessing order 201 (owned by tenantB) -> 403 Forbidden (TENANT_MISMATCH)", async () => {
  const app = await buildTestApp();
  await seedObjectAccess("orders", "201", { ownerUserId: "userB1", tenantId: "tenantB" });
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  const event = getLastPublishedEvent();
  assert.equal(event.decision, "BLOCK");
  assert.equal(event.reason, "TENANT_MISMATCH");
  await app.close();
});

test("Scenario C: userB1 accessing order 201 -> 200 OK (OK_OWNER)", async () => {
  const app = await buildTestApp();
  await seedObjectAccess("orders", "201", { ownerUserId: "userB1", tenantId: "tenantB" });
  const token = await createToken("userB1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  const event = getLastPublishedEvent();
  assert.equal(event.decision, "ALLOW");
  assert.equal(event.reason, "OK_OWNER");
  await app.close();
});

test("Scenario D: userB1 accessing tenantA order 101 with active delegation -> 200 OK (OK_DELEGATION)", async () => {
  const app = await buildTestApp();
  await seedObjectAccess("orders", "101", { ownerUserId: "userA1", tenantId: "tenantA" });
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
  const event = getLastPublishedEvent();
  assert.equal(event.decision, "ALLOW");
  assert.equal(event.reason, "OK_DELEGATION");
  await app.close();
});

test("Scenario E: userB1 accessing tenantA order 101 after delegation expiration -> 403 Forbidden", async () => {
  const app = await buildTestApp();
  await seedObjectAccess("orders", "101", { ownerUserId: "userA1", tenantId: "tenantA" });
  await seedDelegation("userB1", "tenantA", "orders", {
    actions: ["read"],
    expiresAt: 1000000000 // Expired
  });
  const token = await createToken("userB1", "tenantB", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  const event = getLastPublishedEvent();
  assert.equal(event.decision, "BLOCK");
  await app.close();
});

test("Scenario F: Missing JWT -> 401 Unauthorized", async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101"
  });

  assert.equal(res.statusCode, 401);
  const event = getLastPublishedEvent();
  assert.equal(event.decision, "BLOCK");
  assert.equal(event.reason, "MISSING_TOKEN");
  await app.close();
});

test("Scenario G: Valid JWT but missing required scope -> 403 Forbidden", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["analytics:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  const event = getLastPublishedEvent();
  assert.equal(event.decision, "BLOCK");
  assert.equal(event.reason, "NO_SCOPE");
  await app.close();
});

test("Scenario H: Unknown object -> 403 Forbidden", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/9999",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);
  const event = getLastPublishedEvent();
  assert.equal(event.decision, "BLOCK");
  assert.equal(event.reason, "UNKNOWN_OBJECT");
  await app.close();
});

test("Scenario I: GET /_zt/health -> 200 OK without JWT", async () => {
  const app = await buildTestApp();

  const res = await app.inject({
    method: "GET",
    url: "/_zt/health"
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, "ok");
  await app.close();
});

test("Scenario J: Events Service unavailable does not change 200 OK authorization result", async () => {
  const app = await buildTestApp();
  await seedObjectAccess("orders", "101", { ownerUserId: "userA1", tenantId: "tenantA" });
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  setPublisherFailureMode(true);
  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/orders/101",
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 200);
  } finally {
    setPublisherFailureMode(false);
    await app.close();
  }
});

test("Nested resource: GET /api/users/userA1/documents/doc101 correctly evaluates documentId ownership", async () => {
  const app = await buildTestApp();
  await seedObjectAccess("documents", "doc101", { ownerUserId: "userA1", tenantId: "tenantA" });
  const token = await createToken("userA1", "tenantA", "org1", ["documents:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/users/userA1/documents/doc101",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  const event = getLastPublishedEvent();
  assert.equal(event.resourceType, "documents");
  assert.equal(event.decision, "ALLOW");
  await app.close();
});
