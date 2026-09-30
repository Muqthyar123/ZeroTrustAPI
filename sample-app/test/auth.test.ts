import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { users } from "../src/auth/users.js";
import { verifyToken } from "../src/auth/auth.js";

describe("Auth & Health Endpoints", () => {
  const app = buildApp();

  it("GET /health returns ok", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.status).toBe("ok");
    expect(data.service).toBe("sample-app");
  });

  it("POST /auth/login returns valid JWT with proper claims", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "userA1@example.com",
        password: "password123",
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.token).toBeDefined();

    const payload = await verifyToken(data.token);
    expect(payload.sub).toBe("userA1");
    expect(payload.tenant_id).toBe("tenantA");
    expect(payload.org_id).toBe("tenantA");
    expect(payload.scope).toEqual(["orders:read"]);
  });

  it("POST /auth/login rejects invalid credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "userA1@example.com",
        password: "wrongpassword",
      },
    });

    expect(response.statusCode).toBe(401);
    const data = JSON.parse(response.body);
    expect(data.error).toBe("invalid credentials");
  });

  it("POST /auth/login rejects missing body fields", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "userA1@example.com",
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
