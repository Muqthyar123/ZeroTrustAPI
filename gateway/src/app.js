const Fastify = require("fastify");
const { authenticate } = require("./auth/authenticate");
const { authorize } = require("./auth/authorize");
const { checkOwnership } = require("./auth/ownership");

function buildGatewayApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger !== undefined ? opts.logger : false,
    ...opts.fastifyOpts
  });

  const upstreamUrl = opts.upstreamUrl || process.env.SAMPLE_APP_URL || "http://127.0.0.1:3000";

  // Unauthenticated proxy endpoints required for M3 Scanner
  app.register(require("@fastify/http-proxy"), {
    upstream: upstreamUrl,
    prefix: "/openapi.json",
    rewritePrefix: "/openapi.json"
  });

  app.register(require("@fastify/http-proxy"), {
    upstream: upstreamUrl,
    prefix: "/_test/fixtures",
    rewritePrefix: "/_test/fixtures"
  });

  app.register(require("@fastify/http-proxy"), {
    upstream: upstreamUrl,
    prefix: "/auth",
    rewritePrefix: "/auth"
  });

  app.register(require("@fastify/http-proxy"), {
    upstream: upstreamUrl,
    prefix: "/health",
    rewritePrefix: "/health"
  });

  // Protected API proxy endpoint
  app.register(require("@fastify/http-proxy"), {
    upstream: upstreamUrl,
    prefix: "/api",
    rewritePrefix: "/api",
    preHandler: [authenticate, authorize, checkOwnership]
  });

  app.get("/_zt/health", async () => {
    return {
      status: "ok"
    };
  });

  app.get("/hello", async () => {
    return {
      message: "Hello from ZeroTrustAPI Gateway"
    };
  });

  return app;
}

module.exports = {
  buildGatewayApp
};
