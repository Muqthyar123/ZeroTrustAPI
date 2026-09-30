import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Redis } from "ioredis";
import { getRedisClient } from "./redis/client.js";
import { createOwnershipRoutes } from "./routes/ownership.routes.js";
import { createDelegationRoutes } from "./routes/delegation.routes.js";

export interface BuildAppOptions {
  fastifyOpts?: FastifyServerOptions;
  redis?: Redis;
}

export function buildOwnershipApp(opts: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify(opts.fastifyOpts || {});
  const redis = opts.redis || getRedisClient();

  // Health check endpoint
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "ownership-service",
    };
  });

  // Register Ownership routes
  app.register(createOwnershipRoutes(redis));

  // Register Delegation routes
  app.register(createDelegationRoutes(redis));

  return app;
}
