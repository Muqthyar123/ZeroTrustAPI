import Fastify, { type FastifyInstance, type FastifyHttpOptions, type RawServerDefault } from "fastify";
import { users } from "./auth/users.js";
import { createToken } from "./auth/auth.js";
import { requireAuth } from "./auth/middleware.js";
import { createOrderRoutes } from "./orders/orders.routes.js";
import { defaultOwnershipClient, OwnershipClient } from "./ownership/ownershipClient.js";
import { openApiDocument } from "./openapi/openapiDoc.js";
import { getTestFixtures } from "./fixtures/fixtures.js";
import { orderStore } from "./orders/orderStore.js";

export interface AppOptions {
  fastifyOpts?: FastifyHttpOptions<RawServerDefault>;
  ownershipClient?: OwnershipClient;
}

export function buildApp(opts: AppOptions = {}): FastifyInstance {
  const app = Fastify(opts.fastifyOpts || {});
  const ownershipClient = opts.ownershipClient || defaultOwnershipClient;

  // Enable CORS for browser access
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    if (request.method === "OPTIONS") {
      return reply.status(204).send();
    }
  });

  // Health check endpoint
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "sample-app",
      mode: process.env.APP_MODE || "vulnerable",
    };
  });

  // OpenAPI Specification JSON endpoint
  app.get("/openapi.json", async () => {
    return openApiDocument;
  });

  // Test fixtures discovery endpoint for CI/scanner environments
  app.get("/_test/fixtures", async () => {
    return getTestFixtures();
  });

  // Reset in-memory orders store to initial seed state
  app.post("/_test/reset", async () => {
    orderStore.reset();
    return {
      status: "ok",
      message: "Sample app orders reset to initial seed state",
      ordersCount: orderStore.getAll().length,
    };
  });

  // Mode switcher endpoint (vulnerable <-> secure)
  app.post<{ Body: { mode?: string } }>("/_test/mode", async (request) => {
    const mode = request.body?.mode;
    if (mode === "vulnerable" || mode === "secure") {
      process.env.APP_MODE = mode;
    }
    return { mode: process.env.APP_MODE || "vulnerable" };
  });

  // Authentication login endpoint
  app.post("/auth/login", async (request, reply) => {
    const body = request.body as {
      email?: string;
      username?: string;
      password?: string;
    };

    const identifier = body?.email || body?.username;
    if (!identifier || !body?.password) {
      return reply.status(400).send({
        error: "email (or username) and password are required",
      });
    }

    const user = users.find(
      (item) => (item.email === identifier || item.userId === identifier) && item.password === body.password,
    );

    if (!user) {
      return reply.status(401).send({
        error: "invalid credentials",
      });
    }

    const token = await createToken(user);

    return {
      token,
    };
  });

  // GET /api/invoices/:invoiceId
  app.get<{ Params: { invoiceId: string } }>(
    "/api/invoices/:invoiceId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { invoiceId } = request.params;
      const appMode = process.env.APP_MODE || "vulnerable";
      if (appMode !== "vulnerable") {
        const user = request.user!;
        if (user.tenant_id !== "tenantA") {
          return reply.status(403).send({
            error: "forbidden: cross-tenant invoice access denied",
          });
        }
      }
      return reply.status(200).send({
        id: invoiceId,
        orderId: "101",
        tenantId: "tenantA",
        amount: 120.0,
      });
    },
  );

  // GET /api/users/:userId/documents/:documentId
  app.get<{ Params: { userId: string; documentId: string } }>(
    "/api/users/:userId/documents/:documentId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { userId, documentId } = request.params;
      const appMode = process.env.APP_MODE || "vulnerable";
      const docOwners: Record<string, string> = {
        "doc-101": "userA1",
        "doc-201": "userB1",
      };

      if (appMode !== "vulnerable") {
        const user = request.user!;
        if (
          user.sub !== userId ||
          (docOwners[documentId] && docOwners[documentId] !== user.sub)
        ) {
          return reply.status(403).send({
            error: "forbidden: access to other user documents denied",
          });
        }
      }
      return reply.status(200).send({
        documentId,
        userId,
        title: "User Document",
        content: "Document content details",
      });
    },
  );

  // Register orders API routes with the provided ownership client
  app.register(createOrderRoutes(ownershipClient));

  return app;
}
