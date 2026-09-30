const test = require("node:test");
const assert = require("node:assert/strict");
const { findRouteMetadata, matchPathPattern } = require("../src/metadata/routeMetadata");

test("matchPathPattern - matches exact and parameterized routes correctly", () => {
  assert.equal(matchPathPattern("/api/test", "/api/test"), true);
  assert.equal(matchPathPattern("/api/orders/{orderId}", "/api/orders/201"), true);
  assert.equal(matchPathPattern("/api/users/{userId}", "/api/users/userA1"), true);

  // Deeper path should not match single-parameter route pattern
  assert.equal(matchPathPattern("/api/orders/{orderId}", "/api/orders/201/items"), false);
  assert.equal(matchPathPattern("/api/test", "/api/test/extra"), false);
  assert.equal(matchPathPattern("/api/test", "/api/other"), false);
});

test("findRouteMetadata - matches known GET route and returns expected metadata", () => {
  const metadata = findRouteMetadata("GET", "/api/test");

  assert.notEqual(metadata, null);
  assert.equal(metadata.method, "GET");
  assert.equal(metadata.pathPattern, "/api/test");
  assert.equal(metadata.resource, "test");
  assert.equal(metadata.objectIdParam, null);
});

test("findRouteMetadata - HTTP method mismatch does not match", () => {
  const metadata = findRouteMetadata("POST", "/api/test");
  assert.equal(metadata, null);
});

test("findRouteMetadata - unknown route returns null", () => {
  const metadata = findRouteMetadata("GET", "/api/unknown-endpoint");
  assert.equal(metadata, null);
});

test("findRouteMetadata - parameterized route matches path with object ID", () => {
  const metadata = findRouteMetadata("GET", "/api/orders/201");

  assert.notEqual(metadata, null);
  assert.equal(metadata.method, "GET");
  assert.equal(metadata.pathPattern, "/api/orders/{orderId}");
  assert.equal(metadata.resource, "orders");
  assert.equal(metadata.objectIdParam, "orderId");
});

test("findRouteMetadata - parameterized route does not match deeper path", () => {
  const metadata = findRouteMetadata("GET", "/api/orders/201/items");
  assert.equal(metadata, null);
});

test("findRouteMetadata - query string does not break matching", () => {
  const metadata = findRouteMetadata("GET", "/api/orders/201?filter=active#section");

  assert.notEqual(metadata, null);
  assert.equal(metadata.pathPattern, "/api/orders/{orderId}");
  assert.equal(metadata.resource, "orders");
  assert.equal(metadata.objectIdParam, "orderId");
});

test("findRouteMetadata - metadata contains no secrets or Authorization headers", () => {
  const metadata = findRouteMetadata("GET", "/api/orders/201");

  assert.equal(metadata.authorization, undefined);
  assert.equal(metadata.token, undefined);
  assert.equal(metadata.headers, undefined);
  assert.equal(metadata.secret, undefined);
});
