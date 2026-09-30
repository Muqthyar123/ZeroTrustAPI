import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildOwnershipApp } from "../src/app.js";
import { createRedisMock } from "../src/redis/client.js";
import { seedOwnershipData } from "../src/seed/seedOwnership.js";
import { buildApp } from "../../sample-app/src/app.js";
import { OwnershipClient } from "../../sample-app/src/ownership/ownershipClient.js";
import type { Redis } from "ioredis";
import type { FastifyInstance } from "fastify";

describe("Milestone 2: Docker Compose & End-to-End Verification", () => {
  let redis: Redis;
  let ownershipApp: FastifyInstance;
  let sampleApp: FastifyInstance;
  const ownershipPort = 4010;
  const samplePort = 3010;

  beforeAll(async () => {
    // 1. Initialize Redis & Seed
    redis = createRedisMock();
    await seedOwnershipData(redis);

    // 2. Start Ownership Service on test port
    ownershipApp = buildOwnershipApp({ redis, fastifyOpts: { logger: false } });
    await ownershipApp.listen({ port: ownershipPort, host: "127.0.0.1" });

    // 3. Connect Sample App with OwnershipClient
    const ownershipClient = new OwnershipClient({
      baseUrl: `http://127.0.0.1:${ownershipPort}`,
    });

    // 4. Start Sample App on test port
    sampleApp = buildApp({ fastifyOpts: { logger: false }, ownershipClient });
    await sampleApp.listen({ port: samplePort, host: "127.0.0.1" });
  });

  afterAll(async () => {
    await sampleApp.close();
    await ownershipApp.close();
  });

  it("Step 1 & 2: Login as userA1 and obtain JWT", async () => {
    const res = await fetch(`http://127.0.0.1:${samplePort}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userA1@example.com", password: "password123" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { token: string };
    expect(data.token).toBeDefined();
  });

  it("Step 3: GET order 101 for userA1 (own order in tenantA)", async () => {
    const loginRes = await fetch(`http://127.0.0.1:${samplePort}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userA1@example.com", password: "password123" }),
    });
    const { token } = (await loginRes.json()) as { token: string };

    const getRes = await fetch(`http://127.0.0.1:${samplePort}/api/orders/101`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status).toBe(200);
    const order = (await getRes.json()) as any;
    expect(order.id).toBe("101");
    expect(order.tenantId).toBe("tenantA");
    expect(order.ownerUserId).toBe("userA1");
  });

  it("Step 4: GET order 201 in vulnerable mode and confirm BOLA behavior", async () => {
    const loginRes = await fetch(`http://127.0.0.1:${samplePort}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userA1@example.com", password: "password123" }),
    });
    const { token } = (await loginRes.json()) as { token: string };

    // userA1 (tenantA) accesses order 201 (tenantB)
    const getRes = await fetch(`http://127.0.0.1:${samplePort}/api/orders/201`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status).toBe(200);
    const order = (await getRes.json()) as any;
    expect(order.id).toBe("201");
    expect(order.tenantId).toBe("tenantB");
    expect(order.ownerUserId).toBe("userB1");
  });

  it("Step 5 & 6: POST a new order as userA1 and confirm ownership written to Redis through Ownership Service", async () => {
    const loginRes = await fetch(`http://127.0.0.1:${samplePort}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userA1@example.com", password: "password123" }),
    });
    const { token } = (await loginRes.json()) as { token: string };

    const createRes = await fetch(`http://127.0.0.1:${samplePort}/api/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ item: "Wireless Headset", quantity: 1, price: 99.99 }],
        totalAmount: 99.99,
        status: "pending",
      }),
    });
    expect(createRes.status).toBe(201);
    const createdOrder = (await createRes.json()) as any;
    expect(createdOrder.id).toBeDefined();
    expect(createdOrder.tenantId).toBe("tenantA");
    expect(createdOrder.ownerUserId).toBe("userA1");

    const orderId = createdOrder.id;

    // Confirm ownership written to Redis
    const redisHash = await redis.hgetall(`obj:orders:${orderId}`);
    expect(redisHash["tenantId"]).toBe("tenantA");
    expect(redisHash["ownerUserId"]).toBe("userA1");

    // Confirm Ownership Service returns the record
    const ownershipRes = await fetch(`http://127.0.0.1:${ownershipPort}/v1/ownership/orders/${orderId}`);
    expect(ownershipRes.status).toBe(200);
    const ownershipData = (await ownershipRes.json()) as any;
    expect(ownershipData.tenantId).toBe("tenantA");
    expect(ownershipData.ownerUserId).toBe("userA1");
  });

  it("Step 7 & 8: DELETE the newly created order and confirm ownership removed", async () => {
    const loginRes = await fetch(`http://127.0.0.1:${samplePort}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userA1@example.com", password: "password123" }),
    });
    const { token } = (await loginRes.json()) as { token: string };

    // Create an order first
    const createRes = await fetch(`http://127.0.0.1:${samplePort}/api/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ item: "Temporary Order", quantity: 1, price: 20 }],
      }),
    });
    const createdOrder = (await createRes.json()) as any;
    const orderId = createdOrder.id;

    // DELETE order
    const deleteRes = await fetch(`http://127.0.0.1:${samplePort}/api/orders/${orderId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.status).toBe(200);

    // Verify removed in Redis
    const redisHash = await redis.hgetall(`obj:orders:${orderId}`);
    expect(Object.keys(redisHash).length).toBe(0);

    // Verify Ownership Service returns 404
    const ownershipRes = await fetch(`http://127.0.0.1:${ownershipPort}/v1/ownership/orders/${orderId}`);
    expect(ownershipRes.status).toBe(404);
  });

  it("Step 9 & 10: Login as userB1 and verify delegation seed exists (userB1 -> tenantA -> orders -> read)", async () => {
    const loginRes = await fetch(`http://127.0.0.1:${samplePort}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userB1@example.com", password: "password123" }),
    });
    expect(loginRes.status).toBe(200);
    const { token } = (await loginRes.json()) as { token: string };
    expect(token).toBeDefined();

    // Query delegation from Ownership Service
    const delegRes = await fetch(`http://127.0.0.1:${ownershipPort}/v1/delegations/userB1:tenantA:orders`);
    expect(delegRes.status).toBe(200);
    const delegData = (await delegRes.json()) as any;
    expect(delegData.granteeUserId).toBe("userB1");
    expect(delegData.ownerTenantId).toBe("tenantA");
    expect(delegData.resourceType).toBe("orders");
    expect(delegData.actions).toBe("read");
    expect(delegData.isValid).toBe(true);
  });

  it("Step 11: Verify delegation expiry validation works", async () => {
    // 1. Active delegation -> 200 with isValid: true
    const activeEpoch = Math.floor(Date.now() / 1000) + 7200;
    await fetch(`http://127.0.0.1:${ownershipPort}/v1/delegations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        granteeUserId: "userA2",
        ownerTenantId: "tenantB",
        resourceType: "orders",
        actions: "read",
        expiresAt: activeEpoch,
      }),
    });

    const activeRes = await fetch(`http://127.0.0.1:${ownershipPort}/v1/delegations/userA2:tenantB:orders`);
    expect(activeRes.status).toBe(200);
    const activeData = (await activeRes.json()) as any;
    expect(activeData.isValid).toBe(true);

    // 2. Expired delegation -> 410 with isValid: false
    const pastEpoch = Math.floor(Date.now() / 1000) - 3600;
    await fetch(`http://127.0.0.1:${ownershipPort}/v1/delegations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        granteeUserId: "userA2",
        ownerTenantId: "tenantB",
        resourceType: "orders",
        actions: "read",
        expiresAt: pastEpoch,
      }),
    });

    const expiredRes = await fetch(`http://127.0.0.1:${ownershipPort}/v1/delegations/userA2:tenantB:orders`);
    expect(expiredRes.status).toBe(410);
    const expiredData = (await expiredRes.json()) as any;
    expect(expiredData.error).toBe("delegation expired");
    expect(expiredData.delegation.isValid).toBe(false);
  });
});
