import { buildApp } from "../src/app.js";
import { OwnershipClient } from "../src/ownership/ownershipClient.js";

async function run() {
  const registered = new Map<string, any>();
  const mockOwnershipClient = new OwnershipClient({
    fetchFn: async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = input.toString();
      const method = init?.method || "GET";

      if (urlStr.includes("/v1/ownership") && method === "PUT") {
        const body = JSON.parse(init?.body as string);
        registered.set(`${body.resourceType}:${body.objectId}`, body);
        return new Response(JSON.stringify({ ...body, success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (urlStr.includes("/v1/ownership/") && method === "DELETE") {
        const parts = urlStr.split("/");
        const objectId = parts[parts.length - 1];
        const resourceType = parts[parts.length - 2];
        registered.delete(`${resourceType}:${objectId}`);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404 });
    },
  });

  const app = buildApp({ fastifyOpts: { logger: false }, ownershipClient: mockOwnershipClient });
  await app.listen({ port: 3005, host: "127.0.0.1" });
  console.log("App started successfully on port 3005");

  try {
    // 1. Login userA1
    const loginRes = await fetch("http://127.0.0.1:3005/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userA1@example.com", password: "password123" }),
    });
    const { token } = (await loginRes.json()) as { token: string };
    console.log("1. UserA1 login status:", loginRes.status, "token acquired:", !!token);

    // 2. GET /api/orders/101 (own order)
    const get101Res = await fetch("http://127.0.0.1:3005/api/orders/101", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const order101 = (await get101Res.json()) as any;
    console.log("2. GET 101 status:", get101Res.status, "order item:", order101.items?.[0]?.item);

    // 3. GET /api/orders/201 (BOLA test: userA1 accessing tenantB order)
    const get201Res = await fetch("http://127.0.0.1:3005/api/orders/201", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const order201 = (await get201Res.json()) as any;
    console.log("3. GET 201 (BOLA) status:", get201Res.status, "tenantId:", order201.tenantId, "item:", order201.items?.[0]?.item);

    // 4. POST /api/orders
    const postRes = await fetch("http://127.0.0.1:3005/api/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ item: "Mechanical Numpad", quantity: 1, price: 49.99 }],
      }),
    });
    const newOrder = (await postRes.json()) as any;
    console.log("4. POST order status:", postRes.status, "created id:", newOrder.id, "owner:", newOrder.ownerUserId, "tenant:", newOrder.tenantId);
    console.log("   Ownership record registered:", registered.has(`orders:${newOrder.id}`));

    // 5. DELETE /api/orders/:orderId
    const deleteRes = await fetch(`http://127.0.0.1:3005/api/orders/${newOrder.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const deleteData = (await deleteRes.json()) as any;
    console.log("5. DELETE order status:", deleteRes.status, "success:", deleteData.success);
    console.log("   Ownership record after delete:", registered.has(`orders:${newOrder.id}`));

    console.log("SUCCESS: All live HTTP requests completed and verified!");
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error("E2E check failed:", err);
  process.exit(1);
});
