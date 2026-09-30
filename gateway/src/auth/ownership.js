const { getObjectAccess } = require("../storage/ownershipStore");
const { getDelegation } = require("../storage/delegationStore");
const { emitSecurityEvent } = require("../events/securityEvent");

/**
 * Maps HTTP methods to normalized delegation action names.
 * GET / HEAD -> "read"
 * POST / PUT / PATCH -> "write"
 * DELETE -> "delete"
 *
 * @param {string} method - HTTP method string.
 * @returns {string|null} Action name or null if unsupported.
 */
function getActionForMethod(method) {
  if (!method) return null;
  const m = String(method).toUpperCase();
  if (m === "GET" || m === "HEAD") return "read";
  if (m === "POST" || m === "PUT" || m === "PATCH") return "write";
  if (m === "DELETE") return "delete";
  return null;
}

/**
 * Evaluates whether a non-owner user holds a valid, unexpired delegation in Redis for the required action.
 *
 * @param {Object} user - Verified request.user payload from JWT.
 * @param {string} ownerTenantId - Tenant ID of the object owner.
 * @param {string} resource - Resource name (e.g. "orders").
 * @param {string} method - HTTP method (e.g. "GET").
 * @returns {Promise<boolean>} True if valid unexpired delegation is found.
 */
async function verifyDelegation(user, ownerTenantId, resource, method) {
  if (!user || !user.sub || !ownerTenantId || !resource || !method) {
    return false;
  }

  const requiredAction = getActionForMethod(method);
  if (!requiredAction) {
    return false;
  }

  const delegation = await getDelegation(user.sub, ownerTenantId, resource);
  if (!delegation) {
    return false;
  }

  // Check actions array contains required action
  if (!Array.isArray(delegation.actions) || !delegation.actions.includes(requiredAction)) {
    return false;
  }

  // Check expiration timestamp (must be strictly in the future)
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof delegation.expiresAt !== "number" || delegation.expiresAt <= nowInSeconds) {
    return false;
  }

  return true;
}

/**
 * Evaluates object-level access authorization.
 * Checks:
 * 1. Direct ownership & multi-tenant boundaries (user.sub, tenant_id, org_id)
 * 2. If non-owner: Redis-backed delegation (granteeUserId, ownerTenantId, resourceType, actions, expiresAt)
 *
 * @param {Object} user - Verified request.user payload from JWT.
 * @param {string} resource - Resource name (e.g. "orders").
 * @param {string} objectId - Target object ID (e.g. "201").
 * @param {string} method - HTTP method (defaults to "GET").
 * @returns {Promise<boolean>} True if access is authorized by ownership or delegation.
 */
async function authorizeObjectAccess(user, resource, objectId, method = "GET") {
  if (!user || !resource || !objectId) {
    return false;
  }

  const obj = await getObjectAccess(resource, objectId);
  if (!obj) {
    return false;
  }

  // 1. Direct ownership & boundary match
  const isOwnerMatch = obj.owner_sub === user.sub;
  const isTenantMatch = obj.tenant_id === user.tenant_id;
  const isOrgMatch =
    !obj.org_id ||
    !user?.org_id ||
    obj.org_id === user?.org_id ||
    obj.org_id === user?.tenant_id ||
    user?.org_id === obj.tenant_id;

  if (isOwnerMatch && isTenantMatch && isOrgMatch) {
    return true;
  }

  // 1.5. Tenant-wide scope check within same tenant
  const userScopes = Array.isArray(user?.scope) ? user.scope : [];
  const requiredAction = getActionForMethod(method);
  const hasTenantScope =
    isTenantMatch &&
    (userScopes.includes(`${resource}:${requiredAction}:tenant`) ||
      userScopes.includes(`${resource}:read:tenant`) ||
      userScopes.includes("admin") ||
      userScopes.includes("*"));

  if (hasTenantScope) {
    return true;
  }

  // 2. Non-owner -> check Redis delegation
  return await verifyDelegation(user, obj.tenant_id, resource, method);
}

/**
 * Legacy/compatibility helper for object ownership checks.
 *
 * @param {Object} user
 * @param {string} resource
 * @param {string} objectId
 * @param {string} method
 * @returns {Promise<boolean>}
 */
async function verifyObjectOwnership(user, resource, objectId, method = "GET") {
  return await authorizeObjectAccess(user, resource, objectId, method);
}

/**
 * Fastify preHandler hook/middleware for Redis-backed object authorization & BOLA prevention.
 * Executes after authentication and scope authorization.
 * If objectId is present on request.context, checks owner boundaries and Redis delegation records.
 *
 * @param {import('fastify').FastifyRequest} request - Fastify request object.
 * @param {import('fastify').FastifyReply} reply - Fastify reply object.
 */
async function checkOwnership(request, reply) {
  if (reply.sent) {
    return;
  }

  const context = request.context;
  const user = request.user;
  const objectId = context?.objectId;

  // Collection endpoint (objectId is null) -> Skip object-level check, scope auth handles access
  if (!objectId) {
    emitSecurityEvent(request, "ALLOW", "OK_TENANT_SCOPE");
    return;
  }

  const resource = context?.resource;
  const method = context?.method || request.method;

  const obj = await getObjectAccess(resource, objectId);

  if (!obj) {
    emitSecurityEvent(request, "BLOCK", "UNKNOWN_OBJECT");
    return reply.code(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Access forbidden: object ownership check failed"
    });
  }

  // 1. Direct ownership & boundary match
  const isOwnerMatch = obj.owner_sub === user?.sub;
  const isTenantMatch = obj.tenant_id === user?.tenant_id;
  const isOrgMatch =
    !obj.org_id ||
    !user?.org_id ||
    obj.org_id === user?.org_id ||
    obj.org_id === user?.tenant_id ||
    user?.org_id === obj.tenant_id;

  if (isOwnerMatch && isTenantMatch && isOrgMatch) {
    emitSecurityEvent(request, "ALLOW", "OK_OWNER", { objectTenantId: obj.tenant_id });
    return;
  }

  // 1.5. Tenant-wide scope check within same tenant
  const userScopes = Array.isArray(user?.scope) ? user.scope : [];
  const requiredAction = getActionForMethod(method);
  const hasTenantScope =
    isTenantMatch &&
    (userScopes.includes(`${resource}:${requiredAction}:tenant`) ||
      userScopes.includes(`${resource}:read:tenant`) ||
      userScopes.includes("admin") ||
      userScopes.includes("*"));

  if (hasTenantScope) {
    emitSecurityEvent(request, "ALLOW", "OK_TENANT_SCOPE", { objectTenantId: obj.tenant_id });
    return;
  }

  // 2. Non-owner -> check Redis delegation
  const isDelegated = await verifyDelegation(user, obj.tenant_id, resource, method);

  if (isDelegated) {
    emitSecurityEvent(request, "ALLOW", "OK_DELEGATION", { objectTenantId: obj.tenant_id });
    return;
  }

  // 3. Neither owner nor delegated -> 403 Forbidden
  const reason = user?.tenant_id !== obj.tenant_id ? "TENANT_MISMATCH" : "NOT_OWNER";
  emitSecurityEvent(request, "BLOCK", reason, { objectTenantId: obj.tenant_id });

  return reply.code(403).send({
    statusCode: 403,
    error: "Forbidden",
    message: "Access forbidden: object ownership check failed"
  });
}

module.exports = {
  checkOwnership,
  verifyObjectOwnership,
  verifyDelegation,
  authorizeObjectAccess,
  getActionForMethod
};



