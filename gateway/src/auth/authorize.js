const { emitSecurityEvent } = require("../events/securityEvent");

/**
 * Maps an HTTP method and resource to a standard required scope.
 * Standard convention:
 * GET                      -> resource:read
 * POST, PUT, PATCH, DELETE -> resource:write
 *
 * @param {string} method - The HTTP method (e.g., "GET", "POST", "DELETE").
 * @param {string} resource - The target resource name (e.g., "orders").
 * @param {Object|null} routeMetadata - Server-controlled route metadata if available.
 * @returns {string|null} The required scope string, or null if unmappable.
 */
function getRequiredScope(method, resource, routeMetadata) {
  // Prefer explicit requiredScope from server-controlled routeMetadata if present
  if (routeMetadata && routeMetadata.requiredScope) {
    return routeMetadata.requiredScope;
  }

  if (!method || !resource || typeof resource !== "string") {
    return null;
  }

  const m = method.toUpperCase();
  if (m === "GET") {
    return `${resource}:read`;
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(m)) {
    return `${resource}:write`;
  }

  return null;
}

/**
 * Fastify preHandler hook/middleware for scope-based authorization.
 * Determines the required scope from HTTP method, resource, and route metadata,
 * and checks whether request.user.scope contains that scope.
 * Rejects unauthorized or unknown routes with HTTP 403 Forbidden without exposing secrets.
 *
 * @param {import('fastify').FastifyRequest} request - Fastify request object.
 * @param {import('fastify').FastifyReply} reply - Fastify reply object.
 */
async function authorize(request, reply) {
  if (reply.sent) {
    return;
  }

  const context = request.context;
  const user = request.user;

  // Reject requests missing context or resource with HTTP 403 Forbidden
  if (!context || !context.resource) {
    emitSecurityEvent(request, "BLOCK", "UNKNOWN_OBJECT");
    return reply.code(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Access forbidden: unknown or unauthorized route"
    });
  }

  const requiredScope = getRequiredScope(context.method, context.resource, context.routeMetadata);

  if (!requiredScope) {
    emitSecurityEvent(request, "BLOCK", "UNKNOWN_OBJECT");
    return reply.code(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Access forbidden: unsupported HTTP method or route scope"
    });
  }

  // Evaluate required scope against verified user scopes array
  const userScopes = Array.isArray(user?.scope) ? user.scope : [];

  let isAuthorizedScope = userScopes.includes(requiredScope);

  if (!isAuthorizedScope) {
    const resource = context.resource;
    const method = (context.method || "GET").toUpperCase();

    if (method === "DELETE") {
      isAuthorizedScope = userScopes.includes(`${resource}:delete`) || userScopes.includes(`${resource}:write`);
    } else if (method === "GET") {
      isAuthorizedScope = userScopes.includes(`${resource}:read`) || userScopes.includes(`${resource}:read:tenant`);
    }
  }

  if (!isAuthorizedScope) {
    emitSecurityEvent(request, "BLOCK", "NO_SCOPE");
    return reply.code(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Access forbidden: insufficient scope"
    });
  }
}

module.exports = {
  authorize,
  getRequiredScope
};

