const test = require("node:test");
const assert = require("node:assert/strict");
const { SignJWT } = require("jose");
const { verifyToken } = require("../src/auth/jwt");

const TEST_SECRET = "test-secret-key-1234567890";
const secretBytes = new TextEncoder().encode(TEST_SECRET);

test("verifyToken - valid HS256 token", async () => {
  process.env.JWT_SECRET = TEST_SECRET;

  const token = await new SignJWT({ sub: "user123", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretBytes);

  const payload = await verifyToken(token);
  assert.equal(payload.sub, "user123");
  assert.equal(payload.role, "admin");
});

test("verifyToken - expired token", async () => {
  process.env.JWT_SECRET = TEST_SECRET;

  const expiredToken = await new SignJWT({ sub: "user123" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime("-1s")
    .sign(secretBytes);

  await assert.rejects(
    async () => {
      await verifyToken(expiredToken);
    },
    {
      name: "Error",
      message: "JWT token has expired"
    }
  );
});

test("verifyToken - invalid signature", async () => {
  process.env.JWT_SECRET = TEST_SECRET;

  const wrongSecretBytes = new TextEncoder().encode("different-secret-key");
  const token = await new SignJWT({ sub: "user123" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(wrongSecretBytes);

  await assert.rejects(
    async () => {
      await verifyToken(token);
    },
    {
      name: "Error",
      message: "JWT signature verification failed"
    }
  );
});

test("verifyToken - algorithm mismatch (non-HS256)", async () => {
  process.env.JWT_SECRET = TEST_SECRET;

  const token = await new SignJWT({ sub: "user123" })
    .setProtectedHeader({ alg: "HS384" })
    .setExpirationTime("1h")
    .sign(secretBytes);

  await assert.rejects(
    async () => {
      await verifyToken(token);
    },
    {
      name: "Error",
      message: "JWT algorithm not allowed. Only HS256 is accepted"
    }
  );
});

test("verifyToken - missing or invalid token parameter", async () => {
  process.env.JWT_SECRET = TEST_SECRET;

  await assert.rejects(
    async () => {
      await verifyToken(null);
    },
    {
      name: "Error",
      message: "Invalid or missing JWT token"
    }
  );

  await assert.rejects(
    async () => {
      await verifyToken("");
    },
    {
      name: "Error",
      message: "Invalid or missing JWT token"
    }
  );
});

test("verifyToken - malformed token", async () => {
  process.env.JWT_SECRET = TEST_SECRET;

  await assert.rejects(
    async () => {
      await verifyToken("header.payload");
    },
    {
      name: "Error",
      message: "Malformed JWT token"
    }
  );
});

test("verifyToken - missing JWT_SECRET environment variable", async () => {
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  const token = await new SignJWT({ sub: "user123" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secretBytes);

  try {
    await assert.rejects(
      async () => {
        await verifyToken(token);
      },
      {
        name: "Error",
        message: "JWT_SECRET environment variable is not configured"
      }
    );
  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
});
