const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { SignJWT } = require("jose");
const {
  buildRequestContext,
  normalizePath,
  extractResource,
  extractObjectId
} = require("../src/context/requestContext");
const { authenticate } = require("../src/auth/authenticate");

const TEST_SECRET = "test-secret-key-1234567890";
const secretBytes = new TextEncoder().encode(TEST_SECRET);

test("normalizePath - strips query strings and hash fragments", () => {
  assert.equal(normalizePath("/api/orders/201?filter=active#section"), "/api/orders/201");
  assert.equal(normalizePath("/api/test?query=1"), "/api/test");
  assert.equal(normalizePath("/api/test"), "/api/test");
  assert.equal(normalizePath(null), "/");
});

test("extractResource - correctly identifies resources across path formats", () => {
  assert.equal(extractResource("/api/orders"), "orders");
  assert.equal(extractResource("/api/orders/"), "orders");
  assert.equal(extractResource("/api/orders/201"), "orders");
  assert.equal(extractResource("/api/users/userA1"), "users");
  assert.equal(extractResource("/api/orders/201/items"), "orders");
  assert.equal(extractResource("/api/"), null);
  assert.equal(extractResource("/api"), null);
  assert.equal(extractResource("/"), null);
  assert.equal(extractResource(null), null);
});

test("extractObjectId - correctly extracts object IDs according to specification", () => {
  assert.equal(extractObjectId("/api/orders/201"), "201");
  assert.equal(extractObjectId("/api/users/userA1"), "userA1");
  assert.equal(extractObjectId("/api/orders"), null);
  assert.equal(extractObjectId("/api/orders/"), null);
  assert.equal(extractObjectId("/api/orders/201/"), "201");
  assert.equal(extractObjectId(normalizePath("/api/orders/201?filter=active")), "201");
  assert.equal(extractObjectId("/api/orders/201/items"), "201");
  assert.equal(extractObjectId("/api/orders/201/items/55"), "201");
  assert.equal(extractObjectId("/api/"), null);
  assert.equal(extractObjectId("/api"), null);
  assert.equal(extractObjectId("/"), null);
  assert.equal(extractObjectId(null), null);
});

test("buildRequestContext - comprehensive edge case validation for resource and objectId", () => {
  const user = { sub: "userA1", tenant_id: "tenantA", org_id: "org1", scope: ["orders:read"] };

  const testCases = [
    { url: "/api/orders", expectedResource: "orders", expectedObjectId: null },
    { url: "/api/orders/", expectedResource: "orders", expectedObjectId: null },
    { url: "/api/orders/201", expectedResource: "orders", expectedObjectId: "201" },
    { url: "/api/orders/201/", expectedResource: "orders", expectedObjectId: "201" },
    { url: "/api/orders/201?filter=active", expectedResource: "orders", expectedObjectId: "201" },
    { url: "/api/users/userA1", expectedResource: "users", expectedObjectId: "userA1" },
    { url: "/api/orders/201/items", expectedResource: "orders", expectedObjectId: "201" },
    { url: "/api/orders/201/items/55", expectedResource: "orders", expectedObjectId: "201" },
    { url: "/api/", expectedResource: null, expectedObjectId: null },
    { url: "/api", expectedResource: null, expectedObjectId: null }
  ];

  for (const tc of testCases) {
    const ctx = buildRequestContext({ method: "GET", url: tc.url, user });
    assert.equal(ctx.method, "GET");
    assert.equal(ctx.resource, tc.expectedResource, `Resource mismatch for ${tc.url}`);
    assert.equal(ctx.objectId, tc.expectedObjectId, `ObjectId mismatch for ${tc.url}`);
    assert.deepEqual(ctx.user, user);
    assert.equal(ctx.authorization, undefined);
    assert.equal(ctx.token, undefined);
  }
});

test("buildRequestContext - works in Fastify HTTP request lifecycle with objectId extraction", async () => {
  process.env.JWT_SECRET = TEST_SECRET;

  const app = Fastify();
  app.get("/api/orders/:id", { preHandler: authenticate }, async (request) => {
    return { context: request.context };
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
    url: "/api/orders/201?query=active",
    headers: {
      authorization: `Bearer ${validToken}`
    }
  });

  assert.equal(response.statusCode, 200);
  const json = response.json();
  assert.equal(json.context.method, "GET");
  assert.equal(json.context.path, "/api/orders/201");
  assert.equal(json.context.resource, "orders");
  assert.equal(json.context.objectId, "201");
  assert.equal(json.context.user.sub, "userA1");
  assert.equal(json.context.user.tenant_id, "tenantA");
  assert.equal(json.context.user.org_id, "org1");
  assert.deepEqual(json.context.user.scope, ["orders:read"]);

  // Ensure authorization header is not leaked in context
  assert.equal(json.context.authorization, undefined);
  assert.equal(json.context.token, undefined);

  await app.close();
});
