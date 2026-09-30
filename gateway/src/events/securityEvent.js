const crypto = require("crypto");
const { publishSecurityEvent } = require("./eventPublisher");

/**
 * Hashes a string value using SHA-256 and returns a deterministic prefix.
 *
 * @param {string} val - Raw identifier string.
 * @param {number} length - Prefix length (defaults to 16 characters).
 * @returns {string} Hexadecimal SHA-256 prefix or "none".
 */
function hashPrefix(val, length = 16) {
  if (!val || typeof val !== "string") {
    return "none";
  }
  return crypto.createHash("sha256").update(val).digest("hex").substring(0, length);
}

/**
 * Builds a privacy-safe security decision event object.
 *
 * @param {import('fastify').FastifyRequest} request - Fastify request object.
 * @param {Object} decisionInfo - Decision details (decision, reason, authzLatencyUs, objectTenantId).
 * @returns {Object} Structured privacy-safe security event.
 */
function buildSecurityEvent(request, decisionInfo) {
  const context = request.context || {};
  const user = request.user || {};

  const objectId = context.objectId || null;
  const subjectId = user.sub || null;

  const routeTemplate = context.routeMetadata?.pathPattern || context.path || request.raw?.url || request.url || "unknown";
  const resourceType = context.resource || "unknown";

  return {
    decisionId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    method: (context.method || request.method || "GET").toUpperCase(),
    routeTemplate,
    resourceType,
    objectIdHash: hashPrefix(objectId),
    subjectHash: hashPrefix(subjectId),
    tenantId: user.tenant_id || "unknown",
    objectTenantId: decisionInfo.objectTenantId || user.tenant_id || "unknown",
    decision: decisionInfo.decision, // "ALLOW" or "BLOCK"
    reason: decisionInfo.reason,
    authzLatencyUs: Math.round(decisionInfo.authzLatencyUs || 0)
  };
}

/**
 * Records a security decision for the request and emits a privacy-safe security event asynchronously.
 * Guarantees exactly one event is generated per request.
 *
 * @param {import('fastify').FastifyRequest} request - Fastify request object.
 * @param {"ALLOW"|"BLOCK"} decision - Authorization decision result.
 * @param {string} reason - Detailed decision reason.
 * @param {Object} [metadata] - Optional additional metadata (objectTenantId, etc.).
 */
function emitSecurityEvent(request, decision, reason, metadata = {}) {
  if (!request || request._eventPublished) {
    return;
  }
  request._eventPublished = true;

  const startTime = request._authzStartTime || process.hrtime.bigint();
  const endTime = process.hrtime.bigint();
  const durationNs = Number(endTime - startTime);
  const authzLatencyUs = Math.max(1, Math.round(durationNs / 1000));

  const event = buildSecurityEvent(request, {
    decision,
    reason,
    authzLatencyUs,
    ...metadata
  });

  // Publish event asynchronously (non-blocking)
  publishSecurityEvent(event);
}

module.exports = {
  hashPrefix,
  buildSecurityEvent,
  emitSecurityEvent
};
