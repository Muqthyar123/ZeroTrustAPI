const { verifyToken } = require("./jwt");
const { validateClaims } = require("./claims");
const { buildRequestContext } = require("../context/requestContext");
const { emitSecurityEvent } = require("../events/securityEvent");

/**
 * Fastify preHandler hook/middleware for authenticating requests.
 * Reads Authorization header (Bearer <token>), verifies JWT signature/expiration,
 * validates required identity claims, attaches payload to request.user and
 * request.context, and returns HTTP 401 on authentication/validation failures.
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
async function authenticate(request, reply) {
  if (!request._authzStartTime) {
    request._authzStartTime = process.hrtime.bigint();
  }

  const authHeader = request.headers.authorization || request.headers.Authorization;

  if (!authHeader || typeof authHeader !== "string") {
    emitSecurityEvent(request, "BLOCK", "MISSING_TOKEN");
    return reply.code(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Missing Authorization header"
    });
  }

  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    emitSecurityEvent(request, "BLOCK", "INVALID_TOKEN");
    return reply.code(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid Authorization header format. Format must be 'Bearer <token>'"
    });
  }

  const token = parts[1];

  try {
    const payload = await verifyToken(token);
    validateClaims(payload);
    request.user = payload;
    request.context = buildRequestContext(request);
  } catch (error) {
    emitSecurityEvent(request, "BLOCK", "INVALID_TOKEN");
    return reply.code(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: error.message || "Invalid or expired token"
    });
  }
}

module.exports = {
  authenticate
};

