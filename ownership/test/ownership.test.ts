import { describe, it, expect, beforeEach } from "vitest";
import { buildOwnershipApp } from "../src/app.js";
import { createRedisMock } from "../src/redis/client.js";
import { seedOwnershipData } from "../src/seed/seedOwnership.js";
import type { Redis } from "ioredis";

describe("Ownership Service Tests", () => {
  let redis: Redis;
  let app: ReturnType<typeof buildOwnershipApp>;

  beforeEach(() => {
    redis = createRedisMock();
    app = buildOwnershipApp({ redis, fastifyOpts: { logger: false } });
  });

  describe("Ownership Endpoints (PUT, GET, DELETE)", () => {
    it("PUT creates ownership record in Redis", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/v1/ownership",
        payload: {
          resourceType: "orders",
          objectId: "301",
          tenantId: "tenantA",
          ownerUserId: "userA1",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.resourceType).toBe("orders");
      expect(data.objectId).toBe("301");
      expect(data.tenantId).toBe("tenantA");
      expect(data.ownerUserId).toBe("userA1");

      // Verify direct Redis hash
      const hash = await redis.hgetall("obj:orders:301");
      expect(hash["tenantId"]).toBe("tenantA");
      expect(hash["ownerUserId"]).toBe("userA1");
    });

    it("GET returns correct tenantId and ownerUserId", async () => {
      await redis.hset("obj:orders:101", {
        tenantId: "tenantA",
        ownerUserId: "userA1",
      });

      const response = await app.inject({
        method: "GET",
        url: "/v1/ownership/orders/101",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.resourceType).toBe("orders");
      expect(data.objectId).toBe("101");
      expect(data.tenantId).toBe("tenantA");
      expect(data.ownerUserId).toBe("userA1");
    });

    it("GET unknown object returns 404 not-found response", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/ownership/orders/unknown999",
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("ownership record not found");
    });

    it("DELETE removes ownership from Redis", async () => {
      await redis.hset("obj:orders:101", {
        tenantId: "tenantA",
        ownerUserId: "userA1",
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/v1/ownership/orders/101",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.success).toBe(true);

      // Verify deleted in Redis
      const hash = await redis.hgetall("obj:orders:101");
      expect(Object.keys(hash).length).toBe(0);

      // Subsequent GET returns 404
      const getRes = await app.inject({
        method: "GET",
        url: "/v1/ownership/orders/101",
      });
      expect(getRes.statusCode).toBe(404);
    });

    it("repeated PUT is idempotent", async () => {
      const payload = {
        resourceType: "orders",
        objectId: "101",
        tenantId: "tenantA",
        ownerUserId: "userA1",
      };

      const res1 = await app.inject({
        method: "PUT",
        url: "/v1/ownership",
        payload,
      });
      const res2 = await app.inject({
        method: "PUT",
        url: "/v1/ownership",
        payload,
      });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      expect(JSON.parse(res1.body)).toEqual(JSON.parse(res2.body));

      const hash = await redis.hgetall("obj:orders:101");
      expect(hash["tenantId"]).toBe("tenantA");
      expect(hash["ownerUserId"]).toBe("userA1");
    });

    it("PUT rejects incomplete body fields with 400", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/v1/ownership",
        payload: {
          resourceType: "orders",
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("Delegation Endpoints (POST, GET, DELETE)", () => {
    it("POST creates delegation in Redis", async () => {
      const futureEpoch = Math.floor(Date.now() / 1000) + 3600;

      const response = await app.inject({
        method: "POST",
        url: "/v1/delegations",
        payload: {
          granteeUserId: "userB1",
          ownerTenantId: "tenantA",
          resourceType: "orders",
          actions: "read",
          expiresAt: futureEpoch,
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.delegationId).toBe("userB1:tenantA:orders");
      expect(data.granteeUserId).toBe("userB1");
      expect(data.ownerTenantId).toBe("tenantA");
      expect(data.resourceType).toBe("orders");
      expect(data.actions).toBe("read");
      expect(data.expiresAt).toBe(futureEpoch);
      expect(data.isValid).toBe(true);

      // Verify in Redis
      const hash = await redis.hgetall("deleg:userB1:tenantA:orders");
      expect(hash["actions"]).toBe("read");
      expect(Number(hash["expiresAt"])).toBe(futureEpoch);
    });

    it("GET recognizes an active delegation", async () => {
      const futureEpoch = Math.floor(Date.now() / 1000) + 3600;
      await redis.hset("deleg:userB1:tenantA:orders", {
        actions: "read",
        expiresAt: String(futureEpoch),
      });

      const response = await app.inject({
        method: "GET",
        url: "/v1/delegations/userB1:tenantA:orders",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.isValid).toBe(true);
      expect(data.actions).toBe("read");
    });

    it("expired delegation is not considered valid", async () => {
      const pastEpoch = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      await redis.hset("deleg:userB1:tenantA:orders", {
        actions: "read",
        expiresAt: String(pastEpoch),
      });

      const response = await app.inject({
        method: "GET",
        url: "/v1/delegations/userB1:tenantA:orders",
      });

      // Expired delegation returns 410 (or invalid flag)
      expect(response.statusCode).toBe(410);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("delegation expired");
      expect(data.delegation.isValid).toBe(false);
    });

    it("DELETE removes delegation", async () => {
      const futureEpoch = Math.floor(Date.now() / 1000) + 3600;
      await redis.hset("deleg:userB1:tenantA:orders", {
        actions: "read",
        expiresAt: String(futureEpoch),
      });

      const deleteRes = await app.inject({
        method: "DELETE",
        url: "/v1/delegations/userB1:tenantA:orders",
      });

      expect(deleteRes.statusCode).toBe(200);
      const data = JSON.parse(deleteRes.body);
      expect(data.success).toBe(true);

      // Verify key deleted in Redis
      const hash = await redis.hgetall("deleg:userB1:tenantA:orders");
      expect(Object.keys(hash).length).toBe(0);
    });
  });

  describe("Seed Data Verification", () => {
    it("seeds orders 101/102 for tenantA/userA1 and orders 201/202 for tenantB/userB1", async () => {
      await seedOwnershipData(redis);

      // Verify orders 101, 102
      const order101 = await redis.hgetall("obj:orders:101");
      expect(order101["tenantId"]).toBe("tenantA");
      expect(order101["ownerUserId"]).toBe("userA1");

      const order102 = await redis.hgetall("obj:orders:102");
      expect(order102["tenantId"]).toBe("tenantA");
      expect(order102["ownerUserId"]).toBe("userA1");

      // Verify orders 201, 202
      const order201 = await redis.hgetall("obj:orders:201");
      expect(order201["tenantId"]).toBe("tenantB");
      expect(order201["ownerUserId"]).toBe("userB1");

      const order202 = await redis.hgetall("obj:orders:202");
      expect(order202["tenantId"]).toBe("tenantB");
      expect(order202["ownerUserId"]).toBe("userB1");

      // Verify frozen delegation: userB1 has read delegation to tenantA orders
      const deleg = await redis.hgetall("deleg:userB1:tenantA:orders");
      expect(deleg["actions"]).toBe("read");
      expect(Number(deleg["expiresAt"])).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });
});
