const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { SignJWT } = require("jose");
const { authenticate } = require("../src/auth/authenticate");

const TEST_SECRET = "test-secret-key-1234567890";
const secretBytes = new TextEncoder().encode(TEST_SECRET);

async function buildTestApp() {
  process.env.JWT_SECRET = TEST_SECRET;

  const app = Fastify();

  // Mock upstream response endpoint for /api/test
  app.register(require("@fastify/http-proxy"), {
    upstream: "http://127.0.0.1:3999",
    prefix: "/api",
    rewritePrefix: "/api",
    preHandler: authenticate
  });

  app.get("/_zt/health", async () => {
    return { status: "ok" };
  });

  return app;
}

test("authenticate middleware - missing Authorization header returns 401", async () => {
  const app = await buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/api/test"
  });

  assert.equal(response.statusCode, 401);
  const json = response.json();
  assert.equal(json.statusCode, 401);
  assert.equal(json.error, "Unauthorized");
  assert.equal(json.message, "Missing Authorization header");

  await app.close();
});

test("authenticate middleware - malformed Authorization header returns 401", async () => {
  const app = await buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/api/test",
    headers: {
      authorization: "Basic dXNlcjpwYXNz"
    }
  });

  assert.equal(response.statusCode, 401);
  const json = response.json();
  assert.equal(json.error, "Unauthorized");
  assert.equal(
    json.message,
    "Invalid Authorization header format. Format must be 'Bearer <token>'"
  );

  await app.close();
});

test("authenticate middleware - invalid/expired JWT returns 401", async () => {
  const app = await buildTestApp();

  const expiredToken = await new SignJWT({ sub: "user123" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime("-1s")
    .sign(secretBytes);

  const response = await app.inject({
    method: "GET",
    url: "/api/test",
    headers: {
      authorization: `Bearer ${expiredToken}`
    }
  });

  assert.equal(response.statusCode, 401);
  const json = response.json();
  assert.equal(json.error, "Unauthorized");
  assert.equal(json.message, "JWT token has expired");

  await app.close();
});

test("authenticate middleware - valid JWT attaches request.user and passes authentication", async () => {
  process.env.JWT_SECRET = TEST_SECRET;

  const app = Fastify();
  app.get("/api/user-check", { preHandler: authenticate }, async (request) => {
    return { user: request.user };
  });

  const validToken = await new SignJWT({
    sub: "userA1",
    tenant_id: "tenantA",
    org_id: "org1",
    scope: ["orders:read"]
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretBytes);

  const response = await app.inject({
    method: "GET",
    url: "/api/user-check",
    headers: {
      authorization: `Bearer ${validToken}`
    }
  });

  assert.equal(response.statusCode, 200);
  const json = response.json();
  assert.equal(json.user.sub, "userA1");
  assert.equal(json.user.tenant_id, "tenantA");
  assert.equal(json.user.org_id, "org1");
  assert.deepEqual(json.user.scope, ["orders:read"]);

  await app.close();
});

test("authenticate middleware - JWT missing required claim returns 401", async () => {
  process.env.JWT_SECRET = TEST_SECRET;

  const app = Fastify();
  app.get("/api/user-check", { preHandler: authenticate }, async (request) => {
    return { user: request.user };
  });

  // Token missing 'scope'
  const tokenMissingScope = await new SignJWT({
    sub: "userA1",
    tenant_id: "tenantA",
    org_id: "org1"
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretBytes);

  const response = await app.inject({
    method: "GET",
    url: "/api/user-check",
    headers: {
      authorization: `Bearer ${tokenMissingScope}`
    }
  });

  assert.equal(response.statusCode, 401);
  const json = response.json();
  assert.equal(json.error, "Unauthorized");
  assert.equal(json.message, "Invalid or missing 'scope' claim in JWT");

  await app.close();
});

test("public health endpoint /_zt/health remains unauthenticated", async () => {
  const app = await buildTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/_zt/health"
  });

  assert.equal(response.statusCode, 200);
  const json = response.json();
  assert.equal(json.status, "ok");

  await app.close();
});
