const test = require("node:test");
const assert = require("node:assert/strict");
const { validateClaims } = require("../src/auth/claims");

test("validateClaims - valid payload succeeds", () => {
  const validPayload = {
    sub: "user123",
    tenant_id: "tenantA",
    org_id: "org1",
    scope: ["read:orders", "write:orders"]
  };

  assert.doesNotThrow(() => {
    validateClaims(validPayload);
  });
});

test("validateClaims - missing sub throws error", () => {
  const payload = {
    tenant_id: "tenantA",
    org_id: "org1",
    scope: ["read:orders"]
  };

  assert.throws(
    () => {
      validateClaims(payload);
    },
    {
      name: "Error",
      message: "Invalid or missing 'sub' claim in JWT"
    }
  );
});

test("validateClaims - empty sub throws error", () => {
  const payload = {
    sub: "   ",
    tenant_id: "tenantA",
    org_id: "org1",
    scope: ["read:orders"]
  };

  assert.throws(
    () => {
      validateClaims(payload);
    },
    {
      name: "Error",
      message: "Invalid or missing 'sub' claim in JWT"
    }
  );
});

test("validateClaims - missing tenant_id throws error", () => {
  const payload = {
    sub: "user123",
    org_id: "org1",
    scope: ["read:orders"]
  };

  assert.throws(
    () => {
      validateClaims(payload);
    },
    {
      name: "Error",
      message: "Invalid or missing 'tenant_id' claim in JWT"
    }
  );
});

test("validateClaims - empty tenant_id throws error", () => {
  const payload = {
    sub: "user123",
    tenant_id: "",
    org_id: "org1",
    scope: ["read:orders"]
  };

  assert.throws(
    () => {
      validateClaims(payload);
    },
    {
      name: "Error",
      message: "Invalid or missing 'tenant_id' claim in JWT"
    }
  );
});

test("validateClaims - missing org_id throws error", () => {
  const payload = {
    sub: "user123",
    tenant_id: "tenantA",
    scope: ["read:orders"]
  };

  assert.throws(
    () => {
      validateClaims(payload);
    },
    {
      name: "Error",
      message: "Invalid or missing 'org_id' claim in JWT"
    }
  );
});

test("validateClaims - empty org_id throws error", () => {
  const payload = {
    sub: "user123",
    tenant_id: "tenantA",
    org_id: "",
    scope: ["read:orders"]
  };

  assert.throws(
    () => {
      validateClaims(payload);
    },
    {
      name: "Error",
      message: "Invalid or missing 'org_id' claim in JWT"
    }
  );
});

test("validateClaims - missing scope throws error", () => {
  const payload = {
    sub: "user123",
    tenant_id: "tenantA",
    org_id: "org1"
  };

  assert.throws(
    () => {
      validateClaims(payload);
    },
    {
      name: "Error",
      message: "Invalid or missing 'scope' claim in JWT"
    }
  );
});

test("validateClaims - scope with invalid type throws error", () => {
  const payload = {
    sub: "user123",
    tenant_id: "tenantA",
    org_id: "org1",
    scope: "read:orders"
  };

  assert.throws(
    () => {
      validateClaims(payload);
    },
    {
      name: "Error",
      message: "Invalid or missing 'scope' claim in JWT"
    }
  );
});

test("validateClaims - scope containing non-string values throws error", () => {
  const payload = {
    sub: "user123",
    tenant_id: "tenantA",
    org_id: "org1",
    scope: ["read:orders", 123, null]
  };

  assert.throws(
    () => {
      validateClaims(payload);
    },
    {
      name: "Error",
      message: "Invalid 'scope' claim: all elements must be strings"
    }
  );
});
