import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildOwnershipApp } from "../src/app.js";
import { createRedisMock } from "../src/redis/client.js";
import { seedOwnershipData } from "../src/seed/seedOwnership.js";
import { buildApp } from "../../sample-app/src/app.js";
import { OwnershipClient } from "../../sample-app/src/ownership/ownershipClient.js";
import type { Redis } from "ioredis";
import type { FastifyInstance } from "fastify";

describe("Milestone 2: Full End-to-End System Integration", () => {
  let redis: Redis;
  let ownershipApp: FastifyInstance;
  let sampleApp: FastifyInstance;
  const ownershipPort = 4099;
  const samplePort = 3099;

  beforeAll(async () => {
    // 1. Initialize Redis & Seed
    redis = createRedisMock();
    await seedOwnershipData(redis);

    // 2. Start Ownership Service on test port
    ownershipApp = buildOwnershipApp({ redis, fastifyOpts: { logger: false } });
    await ownershipApp.listen({ port: ownershipPort, host: "127.0.0.1" });

    // 3. Connect Sample App with OwnershipClient pointing to live Ownership Service instance
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

  it("completes the full flow: Login -> JWT -> POST /api/orders -> Redis obj:orders:<id> -> DELETE -> Redis removed", async () => {
    // Step 1: Login userA1 -> obtain JWT
    const loginRes = await fetch(`http://127.0.0.1:${samplePort}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userA1@example.com", password: "password123" }),
    });
    expect(loginRes.status).toBe(200);
    const { token } = (await loginRes.json()) as { token: string };
    expect(token).toBeDefined();

    // Step 2: POST /api/orders -> create order
    const createOrderRes = await fetch(`http://127.0.0.1:${samplePort}/api/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ item: "Ergonomic Split Keyboard", quantity: 1, price: 189.99 }],
        totalAmount: 189.99,
        status: "pending",
      }),
    });
    expect(createOrderRes.status).toBe(201);
    const createdOrder = (await createOrderRes.json()) as any;
    expect(createdOrder.id).toBeDefined();
    expect(createdOrder.tenantId).toBe("tenantA");
    expect(createdOrder.ownerUserId).toBe("userA1");

    const orderId = createdOrder.id;

    // Step 3: Verify Redis contains obj:orders:<id> with tenantId and ownerUserId
    const redisHash = await redis.hgetall(`obj:orders:${orderId}`);
    expect(redisHash["tenantId"]).toBe("tenantA");
    expect(redisHash["ownerUserId"]).toBe("userA1");

    // Step 4: Verify Ownership Service GET /v1/ownership/orders/:id returns correct ownership record
    const ownershipGetRes = await fetch(`http://127.0.0.1:${ownershipPort}/v1/ownership/orders/${orderId}`);
    expect(ownershipGetRes.status).toBe(200);
    const ownershipData = (await ownershipGetRes.json()) as any;
    expect(ownershipData.resourceType).toBe("orders");
    expect(ownershipData.objectId).toBe(orderId);
    expect(ownershipData.tenantId).toBe("tenantA");
    expect(ownershipData.ownerUserId).toBe("userA1");

    // Step 5: DELETE /api/orders/:id
    const deleteOrderRes = await fetch(`http://127.0.0.1:${samplePort}/api/orders/${orderId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(deleteOrderRes.status).toBe(200);
    const deleteData = (await deleteOrderRes.json()) as any;
    expect(deleteData.success).toBe(true);

    // Step 6: Verify ownership is removed from Redis
    const redisHashAfterDelete = await redis.hgetall(`obj:orders:${orderId}`);
    expect(Object.keys(redisHashAfterDelete).length).toBe(0);

    // Step 7: Verify Ownership Service GET returns 404
    const ownershipGetAfterDelete = await fetch(`http://127.0.0.1:${ownershipPort}/v1/ownership/orders/${orderId}`);
    expect(ownershipGetAfterDelete.status).toBe(404);
  });
});
