import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";

describe("OpenAPI Contract & Test Fixtures (Milestone 2)", () => {
  const app = buildApp({ fastifyOpts: { logger: false } });

  describe("GET /openapi.json", () => {
    it("returns 200 and a valid OpenAPI 3.x document", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/openapi.json",
      });

      expect(response.statusCode).toBe(200);
      const doc = JSON.parse(response.body);

      expect(doc.openapi).toBeDefined();
      expect(doc.openapi).toMatch(/^3\./);
      expect(doc.info).toBeDefined();
      expect(doc.info.title).toBeDefined();
      expect(doc.info.version).toBeDefined();
      expect(doc.paths).toBeDefined();
      expect(doc.components).toBeDefined();
      expect(doc.components.schemas).toBeDefined();
    });

    it("contains all required routes in OpenAPI paths", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/openapi.json",
      });

      const doc = JSON.parse(response.body);
      const paths = Object.keys(doc.paths);

      const requiredPaths = [
        "/health",
        "/auth/login",
        "/api/orders",
        "/api/orders/{orderId}",
        "/api/invoices/{invoiceId}",
        "/api/users/{userId}/documents/{documentId}",
        "/_test/fixtures",
        "/openapi.json",
      ];

      for (const reqPath of requiredPaths) {
        expect(paths).toContain(reqPath);
      }
    });

    it("has required path parameters with exact names", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/openapi.json",
      });

      const doc = JSON.parse(response.body);

      // /api/orders/{orderId} -> parameter orderId
      const orderParams = doc.paths["/api/orders/{orderId}"].get.parameters;
      expect(orderParams).toBeDefined();
      expect(orderParams.some((p: any) => p.name === "orderId" && p.in === "path")).toBe(true);

      // /api/invoices/{invoiceId} -> parameter invoiceId
      const invoiceParams = doc.paths["/api/invoices/{invoiceId}"].get.parameters;
      expect(invoiceParams).toBeDefined();
      expect(invoiceParams.some((p: any) => p.name === "invoiceId" && p.in === "path")).toBe(true);

      // /api/users/{userId}/documents/{documentId} -> parameters userId and documentId
      const docParams = doc.paths["/api/users/{userId}/documents/{documentId}"].get.parameters;
      expect(docParams).toBeDefined();
      expect(docParams.some((p: any) => p.name === "userId" && p.in === "path")).toBe(true);
      expect(docParams.some((p: any) => p.name === "documentId" && p.in === "path")).toBe(true);
    });

    it("contains required component schemas", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/openapi.json",
      });

      const doc = JSON.parse(response.body);
      const schemas = doc.components.schemas;

      expect(schemas.LoginRequest).toBeDefined();
      expect(schemas.LoginResponse).toBeDefined();
      expect(schemas.Order).toBeDefined();
      expect(schemas.CreateOrderRequest).toBeDefined();
      expect(schemas.ErrorResponse).toBeDefined();
    });
  });

  describe("GET /_test/fixtures", () => {
    it("returns 200 and deterministic test fixtures", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/_test/fixtures",
      });

      expect(response.statusCode).toBe(200);
      const fixtures = JSON.parse(response.body);

      expect(fixtures.tenants).toBeDefined();
      expect(fixtures.users).toBeDefined();
      expect(fixtures.objects).toBeDefined();
      expect(fixtures.delegations).toBeDefined();
      expect(fixtures.expectedAuthorization).toBeDefined();
    });

    it("contains all frozen users with scopes and owned orders", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/_test/fixtures",
      });

      const fixtures = JSON.parse(response.body);
      const userIds = fixtures.users.map((u: any) => u.userId);

      expect(userIds).toContain("userA1");
      expect(userIds).toContain("userA2");
      expect(userIds).toContain("userB1");

      const userA1 = fixtures.users.find((u: any) => u.userId === "userA1");
      expect(userA1.tenantId).toBe("tenantA");
      expect(userA1.ownedOrders).toEqual(["101", "102"]);

      const userA2 = fixtures.users.find((u: any) => u.userId === "userA2");
      expect(userA2.tenantId).toBe("tenantA");
      expect(userA2.scope).toContain("orders:read:tenant");

      const userB1 = fixtures.users.find((u: any) => u.userId === "userB1");
      expect(userB1.tenantId).toBe("tenantB");
      expect(userB1.ownedOrders).toEqual(["201", "202"]);
    });

    it("contains all frozen orders", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/_test/fixtures",
      });

      const fixtures = JSON.parse(response.body);
      const orders = fixtures.objects.orders;
      const orderIds = orders.map((o: any) => o.id);

      expect(orderIds).toContain("101");
      expect(orderIds).toContain("102");
      expect(orderIds).toContain("201");
      expect(orderIds).toContain("202");
    });

    it("contains active demo delegation information", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/_test/fixtures",
      });

      const fixtures = JSON.parse(response.body);
      const deleg = fixtures.delegations.find((d: any) => d.granteeUserId === "userB1");

      expect(deleg).toBeDefined();
      expect(deleg.ownerTenantId).toBe("tenantA");
      expect(deleg.resourceType).toBe("orders");
      expect(deleg.actions).toBe("read");
      expect(deleg.status).toBe("active");
    });

    it("never exposes user passwords in fixtures", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/_test/fixtures",
      });

      const fixtures = JSON.parse(response.body);
      for (const u of fixtures.users) {
        expect(u.password).toBeUndefined();
      }

      const rawJson = response.body;
      expect(rawJson).not.toContain("password123");
    });

    it("contains expected authorization scenarios for CI scanners", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/_test/fixtures",
      });

      const fixtures = JSON.parse(response.body);
      const scenarios = fixtures.expectedAuthorization;

      expect(scenarios.length).toBeGreaterThanOrEqual(4);
      expect(scenarios.some((s: any) => s.userId === "userA1" && s.objectId === "101" && s.expectedResult === "authorized")).toBe(true);
      expect(scenarios.some((s: any) => s.userId === "userA1" && s.objectId === "201" && s.expectedResult === "unauthorized")).toBe(true);
      expect(scenarios.some((s: any) => s.userId === "userB1" && s.objectId === "201" && s.expectedResult === "authorized")).toBe(true);
      expect(scenarios.some((s: any) => s.userId === "userB1" && s.objectId === "101" && s.expectedResult === "authorized")).toBe(true);
    });
  });
});
