import Fastify, { type FastifyInstance, type FastifyHttpOptions, type RawServerDefault } from "fastify";
import { users } from "./auth/users.js";
import { createToken } from "./auth/auth.js";
import { requireAuth } from "./auth/middleware.js";
import { createOrderRoutes } from "./orders/orders.routes.js";
import { defaultOwnershipClient, OwnershipClient } from "./ownership/ownershipClient.js";
import { openApiDocument } from "./openapi/openapiDoc.js";
import { getTestFixtures } from "./fixtures/fixtures.js";

export interface AppOptions {
  fastifyOpts?: FastifyHttpOptions<RawServerDefault>;
  ownershipClient?: OwnershipClient;
}

export function buildApp(opts: AppOptions = {}): FastifyInstance {
  const app = Fastify(opts.fastifyOpts || {});
  const ownershipClient = opts.ownershipClient || defaultOwnershipClient;

  // Health check endpoint
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "sample-app",
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

  // Authentication login endpoint
  app.post("/auth/login", async (request, reply) => {
    const body = request.body as {
      email?: string;
      password?: string;
    };

    if (!body?.email || !body?.password) {
      return reply.status(400).send({
        error: "email and password are required",
      });
    }

    const user = users.find(
      (item) => item.email === body.email && item.password === body.password,
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
