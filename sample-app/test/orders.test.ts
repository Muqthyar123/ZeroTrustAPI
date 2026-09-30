import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { createToken } from "../src/auth/auth.js";
import { users } from "../src/auth/users.js";
import { orderStore } from "../src/orders/orderStore.js";
import { OwnershipClient } from "../src/ownership/ownershipClient.js";

describe("Orders API & Frozen Seed Data (Milestone 2)", () => {
  const registeredOwnerships = new Map<string, { tenantId: string; ownerUserId: string }>();
  const deletedOwnerships = new Set<string>();

  const mockOwnershipClient = new OwnershipClient({
    fetchFn: async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = input.toString();
      const method = init?.method || "GET";

      if (urlStr.includes("/v1/ownership") && method === "PUT") {
        const body = JSON.parse(init?.body as string);
        registeredOwnerships.set(`${body.resourceType}:${body.objectId}`, {
          tenantId: body.tenantId,
          ownerUserId: body.ownerUserId,
        });
        return new Response(JSON.stringify({ ...body, success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (urlStr.includes("/v1/ownership/") && method === "DELETE") {
        const parts = urlStr.split("/");
        const objectId = parts[parts.length - 1];
        const resourceType = parts[parts.length - 2];
        const key = `${resourceType}:${objectId}`;
        registeredOwnerships.delete(key);
        deletedOwnerships.add(key);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404 });
    },
  });

  const app = buildApp({ ownershipClient: mockOwnershipClient, fastifyOpts: { logger: false } });

  const userA1 = users.find((u) => u.userId === "userA1")!;
  const userA2 = users.find((u) => u.userId === "userA2")!;
  const userB1 = users.find((u) => u.userId === "userB1")!;

  let tokenA1: string;
  let tokenA2: string;
  let tokenB1: string;

  beforeEach(async () => {
    // Reset order store to initial frozen seed data before each test
    orderStore.reset();
    registeredOwnerships.clear();
    deletedOwnerships.clear();
    process.env.APP_MODE = "vulnerable";

    tokenA1 = await createToken(userA1);
    tokenA2 = await createToken(userA2);
    tokenB1 = await createToken(userB1);
  });

  describe("Frozen Seed Data Verification", () => {
    it("has tenantA seed orders 101 and 102 owned by userA1", () => {
      const order101 = orderStore.getById("101");
      const order102 = orderStore.getById("102");

      expect(order101).toBeDefined();
      expect(order101?.tenantId).toBe("tenantA");
      expect(order101?.ownerUserId).toBe("userA1");
      expect(order101?.items.length).toBeGreaterThan(0);

      expect(order102).toBeDefined();
      expect(order102?.tenantId).toBe("tenantA");
      expect(order102?.ownerUserId).toBe("userA1");
    });

    it("has tenantB seed orders 201 and 202 owned by userB1", () => {
      const order201 = orderStore.getById("201");
      const order202 = orderStore.getById("202");

      expect(order201).toBeDefined();
      expect(order201?.tenantId).toBe("tenantB");
      expect(order201?.ownerUserId).toBe("userB1");

      expect(order202).toBeDefined();
      expect(order202?.tenantId).toBe("tenantB");
      expect(order202?.ownerUserId).toBe("userB1");
    });

    it("has userA2 with orders:read:tenant scope", () => {
      expect(userA2.scope).toContain("orders:read:tenant");
      expect(userA2.tenantId).toBe("tenantA");
    });
  });

  describe("GET /api/orders/:orderId", () => {
    it("returns existing order 101 for userA1", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/orders/101",
        headers: {
          authorization: `Bearer ${tokenA1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBe("101");
      expect(data.tenantId).toBe("tenantA");
      expect(data.ownerUserId).toBe("userA1");
      expect(data.items[0].item).toBe("Mechanical Keyboard");
    });

    it("returns existing order 201 for userB1", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/orders/201",
        headers: {
          authorization: `Bearer ${tokenB1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBe("201");
      expect(data.tenantId).toBe("tenantB");
      expect(data.ownerUserId).toBe("userB1");
      expect(data.items[0].item).toBe("Ergonomic Chair");
    });

    it("returns 404 for nonexistent order", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/orders/999",
        headers: {
          authorization: `Bearer ${tokenA1}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("order not found");
    });

    it("rejects request without valid authorization header with 401", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/orders/101",
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.body);
      expect(data.error).toMatch(/unauthorized/i);
    });
  });

  describe("POST /api/orders & Ownership Sync", () => {
    it("creates an order using JWT tenant_id and sub and registers ownership", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/orders",
        headers: {
          authorization: `Bearer ${tokenA1}`,
        },
        payload: {
          items: [
            { item: "Wireless Mouse", quantity: 2, price: 25.5 },
          ],
          totalAmount: 51.0,
          status: "pending",
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.id).toBeDefined();
      expect(data.tenantId).toBe("tenantA");
      expect(data.ownerUserId).toBe("userA1");
      expect(data.items.length).toBe(1);
      expect(data.items[0].item).toBe("Wireless Mouse");
      expect(data.totalAmount).toBe(51.0);
      expect(data.status).toBe("pending");

      // Verify it was stored in memory
      const stored = orderStore.getById(data.id);
      expect(stored).toBeDefined();
      expect(stored?.ownerUserId).toBe("userA1");

      // Verify ownership record was registered
      const ownership = registeredOwnerships.get(`orders:${data.id}`);
      expect(ownership).toBeDefined();
      expect(ownership?.tenantId).toBe("tenantA");
      expect(ownership?.ownerUserId).toBe("userA1");
    });

    it("creates an order for userB1 with tenantB and registers ownership", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/orders",
        headers: {
          authorization: `Bearer ${tokenB1}`,
        },
        payload: {
          items: [
            { item: "Standing Desk Mat", quantity: 1, price: 45.0 },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.tenantId).toBe("tenantB");
      expect(data.ownerUserId).toBe("userB1");

      const ownership = registeredOwnerships.get(`orders:${data.id}`);
      expect(ownership?.tenantId).toBe("tenantB");
      expect(ownership?.ownerUserId).toBe("userB1");
    });

    it("handles Ownership Service registration failure safely", async () => {
      const failingClient = new OwnershipClient({
        fetchFn: async () => new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503 }),
      });
      const failingApp = buildApp({ ownershipClient: failingClient, fastifyOpts: { logger: false } });

      const response = await failingApp.inject({
        method: "POST",
        url: "/api/orders",
        headers: {
          authorization: `Bearer ${tokenA1}`,
        },
        payload: {
          items: [{ item: "Test Item", quantity: 1, price: 100 }],
        },
      });

      expect(response.statusCode).toBe(502);
      const data = JSON.parse(response.body);
      expect(data.error).toContain("failed to register order ownership");

      // Verify order was NOT retained in store
      expect(orderStore.getAll().find((o) => o.items[0]?.item === "Test Item")).toBeUndefined();
    });

    it("rejects unauthenticated POST with 401", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/orders",
        payload: {
          items: [{ item: "Test", quantity: 1, price: 10 }],
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/orders/:orderId & Ownership Sync", () => {
    it("deletes an existing order and removes ownership record", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/orders/101",
        headers: {
          authorization: `Bearer ${tokenA1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.success).toBe(true);
      expect(data.order.id).toBe("101");

      // Verify subsequent GET returns 404
      const getResponse = await app.inject({
        method: "GET",
        url: "/api/orders/101",
        headers: {
          authorization: `Bearer ${tokenA1}`,
        },
      });
      expect(getResponse.statusCode).toBe(404);

      // Verify ownership deletion was requested
      expect(deletedOwnerships.has("orders:101")).toBe(true);
    });

    it("returns 404 when deleting nonexistent order", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/orders/999",
        headers: {
          authorization: `Bearer ${tokenA1}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("rejects unauthenticated DELETE with 401", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/orders/101",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("BOLA (Broken Object Level Authorization) Demonstration", () => {
    it("demonstrates vulnerable API allows userA1 (tenantA) to request order 201 (tenantB)", async () => {
      process.env.APP_MODE = "vulnerable";

      // userA1 from tenantA requests order 201 belonging to tenantB / userB1
      const response = await app.inject({
        method: "GET",
        url: "/api/orders/201",
        headers: {
          authorization: `Bearer ${tokenA1}`,
        },
      });

      // In vulnerable mode, this succeeds despite cross-tenant object access!
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBe("201");
      expect(data.tenantId).toBe("tenantB");
      expect(data.ownerUserId).toBe("userB1");
    });

    it("demonstrates vulnerable API allows userA1 to delete order 201 (tenantB)", async () => {
      process.env.APP_MODE = "vulnerable";

      // userA1 deletes order 201 belonging to tenantB
      const response = await app.inject({
        method: "DELETE",
        url: "/api/orders/201",
        headers: {
          authorization: `Bearer ${tokenA1}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(orderStore.getById("201")).toBeUndefined();
    });

    it("enforces ownership and tenant isolation when APP_MODE=secure", async () => {
      process.env.APP_MODE = "secure";

      // 1. Cross-tenant access denied
      const crossTenantResponse = await app.inject({
        method: "GET",
        url: "/api/orders/201",
        headers: {
          authorization: `Bearer ${tokenA1}`,
        },
      });
      expect(crossTenantResponse.statusCode).toBe(403);

      // 2. Same-tenant owner access allowed
      const ownerResponse = await app.inject({
        method: "GET",
        url: "/api/orders/101",
        headers: {
          authorization: `Bearer ${tokenA1}`,
        },
      });
      expect(ownerResponse.statusCode).toBe(200);

      // 3. Same-tenant user with orders:read:tenant scope allowed
      const tenantReaderResponse = await app.inject({
        method: "GET",
        url: "/api/orders/101",
        headers: {
          authorization: `Bearer ${tokenA2}`,
        },
      });
      expect(tenantReaderResponse.statusCode).toBe(200);

      // 4. Cross-tenant delete denied
      const crossTenantDeleteResponse = await app.inject({
        method: "DELETE",
        url: "/api/orders/201",
        headers: {
          authorization: `Bearer ${tokenA1}`,
        },
      });
      expect(crossTenantDeleteResponse.statusCode).toBe(403);
    });
  });
});
