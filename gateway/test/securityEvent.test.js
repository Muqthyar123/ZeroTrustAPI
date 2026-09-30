const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { SignJWT } = require("jose");
const { authenticate } = require("../src/auth/authenticate");
const { authorize } = require("../src/auth/authorize");
const { checkOwnership } = require("../src/auth/ownership");
const { seedDelegation, clearDelegations } = require("../src/storage/delegationStore");
const { getPublishedEvents, getLastPublishedEvent, clearPublishedEvents, setPublisherFailureMode } = require("../src/events/eventPublisher");
const { hashPrefix, buildSecurityEvent } = require("../src/events/securityEvent");

const TEST_SECRET = "test-secret-key-events-phase7-777";
const secretBytes = new TextEncoder().encode(TEST_SECRET);

async function buildTestApp() {
  process.env.JWT_SECRET = TEST_SECRET;
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

  app.post("/api/orders/:id", { preHandler: pipeline }, async () => {
    return { ok: true, route: "POST /api/orders/:id" };
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

test("1. ALLOW owner decision creates a security event", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);

  const event = getLastPublishedEvent();
  assert.notEqual(event, null);
  assert.equal(event.decision, "ALLOW");
  assert.equal(event.reason, "OK_OWNER");
  await app.close();
});

test("2. BLOCK non-owner decision creates a security event", async () => {
  const app = await buildTestApp();
  const token = await createToken("userB1", "tenantA", "org1", ["orders:read"]);

  const res = await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 403);

  const event = getLastPublishedEvent();
  assert.notEqual(event, null);
  assert.equal(event.decision, "BLOCK");
  assert.equal(event.reason, "NOT_OWNER");
  await app.close();
});

test("3. Delegation ALLOW creates a security event", async () => {
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

  const event = getLastPublishedEvent();
  assert.notEqual(event, null);
  assert.equal(event.decision, "ALLOW");
  assert.equal(event.reason, "OK_DELEGATION");
  await app.close();
});

test("4. Correct HTTP method is recorded in security event", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const event = getLastPublishedEvent();
  assert.equal(event.method, "GET");
  await app.close();
});

test("5. Correct route template is recorded in security event", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const event = getLastPublishedEvent();
  assert.ok(event.routeTemplate.includes("/api/orders"));
  await app.close();
});

test("6. Correct resource type is recorded in security event", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const event = getLastPublishedEvent();
  assert.equal(event.resourceType, "orders");
  await app.close();
});

test("7. Decision ID (UUID) is generated in security event", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const event = getLastPublishedEvent();
  assert.match(event.decisionId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  await app.close();
});

test("8. Timestamp (ISO-8601) is generated in security event", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const event = getLastPublishedEvent();
  assert.ok(Date.parse(event.timestamp) > 0);
  await app.close();
});

test("9. Authorization latency (authzLatencyUs) is present and numeric", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const event = getLastPublishedEvent();
  assert.equal(typeof event.authzLatencyUs, "number");
  assert.ok(event.authzLatencyUs >= 0);
  await app.close();
});

test("10. Object ID is hashed as sha256 prefix in security event", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const event = getLastPublishedEvent();
  const expectedHash = hashPrefix("201");
  assert.equal(event.objectIdHash, expectedHash);
  assert.equal(event.objectIdHash.includes("201"), false);
  await app.close();
});

test("11. Subject ID is hashed as sha256 prefix in security event", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const event = getLastPublishedEvent();
  const expectedHash = hashPrefix("userA1");
  assert.equal(event.subjectHash, expectedHash);
  assert.equal(event.subjectHash.includes("userA1"), false);
  await app.close();
});

test("12. Event does NOT contain Authorization header", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const jsonStr = JSON.stringify(getLastPublishedEvent());
  assert.equal(jsonStr.toLowerCase().includes("authorization"), false);
  await app.close();
});

test("13. Event does NOT contain raw JWT token string", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const jsonStr = JSON.stringify(getLastPublishedEvent());
  assert.equal(jsonStr.includes(token), false);
  await app.close();
});

test("14. Event does NOT contain raw object ID", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const event = getLastPublishedEvent();
  assert.equal(event.objectId, undefined);
  await app.close();
});

test("15. Event does NOT contain passwords or credentials", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const jsonStr = JSON.stringify(getLastPublishedEvent());
  assert.equal(jsonStr.toLowerCase().includes("password"), false);
  assert.equal(jsonStr.toLowerCase().includes("secret"), false);
  await app.close();
});

test("16. Event does NOT contain JWT secret", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const jsonStr = JSON.stringify(getLastPublishedEvent());
  assert.equal(jsonStr.includes(TEST_SECRET), false);
  await app.close();
});

test("17. Event does NOT contain Redis credentials", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const jsonStr = JSON.stringify(getLastPublishedEvent());
  assert.equal(jsonStr.includes("redis://"), false);
  await app.close();
});

test("18. Event does NOT contain request body", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:write"]);

  await app.inject({
    method: "POST",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` },
    payload: { sensitiveData: "secret_12345" }
  });

  const jsonStr = JSON.stringify(getLastPublishedEvent());
  assert.equal(jsonStr.includes("sensitiveData"), false);
  assert.equal(jsonStr.includes("secret_12345"), false);
  await app.close();
});

test("19. Event is captured and ready for async POSTing to EVENTS_SERVICE_URL", async () => {
  process.env.EVENTS_SERVICE_URL = "http://localhost:5000/v1/events";
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  await app.inject({
    method: "GET",
    url: "/api/orders/201",
    headers: { authorization: `Bearer ${token}` }
  });

  const events = getPublishedEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].decision, "ALLOW");
  await app.close();
});

test("20. Events Service success does NOT alter authorization outcome", async () => {
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

test("21. Events Service failure does NOT alter authorization outcome", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  setPublisherFailureMode(true);
  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/orders/201",
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().ok, true);
  } finally {
    setPublisherFailureMode(false);
    await app.close();
  }
});

test("22. Events Service timeout does NOT delay or alter authorization outcome", async () => {
  const app = await buildTestApp();
  const token = await createToken("userB1", "tenantA", "org1", ["orders:read"]);

  setPublisherFailureMode(true);
  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/orders/201",
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error, "Forbidden");
  } finally {
    setPublisherFailureMode(false);
    await app.close();
  }
});

test("23. Publisher failure does NOT crash the gateway", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  setPublisherFailureMode(true);
  try {
    assert.doesNotThrow(async () => {
      await app.inject({
        method: "GET",
        url: "/api/orders/201",
        headers: { authorization: `Bearer ${token}` }
      });
    });
  } finally {
    setPublisherFailureMode(false);
    await app.close();
  }
});

test("24. Authorization still returns 403 when event delivery fails", async () => {
  const app = await buildTestApp();
  const token = await createToken("userB1", "tenantA", "org1", ["orders:read"]);

  setPublisherFailureMode(true);
  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/orders/201",
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.json().message, "Access forbidden: object ownership check failed");
  } finally {
    setPublisherFailureMode(false);
    await app.close();
  }
});

test("25. Authorization still allows request (200) when event delivery fails", async () => {
  const app = await buildTestApp();
  const token = await createToken("userA1", "tenantA", "org1", ["orders:read"]);

  setPublisherFailureMode(true);
  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/orders/201",
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().ok, true);
  } finally {
    setPublisherFailureMode(false);
    await app.close();
  }
});
