/**
 * Validates required identity claims on a decoded JWT payload.
 *
 * @param {Object} payload - Decoded JWT payload.
 * @throws {Error} If any required claim is missing or invalid.
 */
function validateClaims(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid JWT payload");
  }

  if (typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
    throw new Error("Invalid or missing 'sub' claim in JWT");
  }

  if (typeof payload.tenant_id !== "string" || payload.tenant_id.trim().length === 0) {
    throw new Error("Invalid or missing 'tenant_id' claim in JWT");
  }

  if (typeof payload.org_id !== "string" || payload.org_id.trim().length === 0) {
    throw new Error("Invalid or missing 'org_id' claim in JWT");
  }

  if (!Array.isArray(payload.scope)) {
    throw new Error("Invalid or missing 'scope' claim in JWT");
  }

  if (!payload.scope.every((item) => typeof item === "string")) {
    throw new Error("Invalid 'scope' claim: all elements must be strings");
  }
}

module.exports = {
  validateClaims
};
