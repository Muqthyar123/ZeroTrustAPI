const Fastify = require("fastify");
const { authenticate } = require("./src/auth/authenticate");
const { authorize } = require("./src/auth/authorize");
const { checkOwnership } = require("./src/auth/ownership");

const app = Fastify({
  logger: true
});

const upstreamUrl = process.env.SAMPLE_APP_URL || "http://127.0.0.1:3000";

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

app.listen({ port: 8080, host: "0.0.0.0" })
  .then(() => {
    console.log("ZeroTrustAPI Gateway running on port 8080");
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });