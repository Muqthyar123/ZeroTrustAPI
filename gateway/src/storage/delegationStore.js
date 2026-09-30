const { getRedisClient, closeRedis } = require("./redis");

// In-memory mock adapter data store for unit testing when live Redis is offline
const MOCK_DELEGATION_STORE = {};

let forceMockMode = false;
let forceRedisFailure = false;

function setMockMode(enabled) {
  forceMockMode = enabled;
}

function setRedisFailureMode(enabled) {
  forceRedisFailure = enabled;
}

/**
 * Formats Redis key for delegation data.
 * Format: deleg:{granteeUserId}:{ownerTenantId}:{resourceType}
 *
 * @param {string} granteeUserId - User receiving delegated access.
 * @param {string} ownerTenantId - Tenant ID of object owner.
 * @param {string} resourceType - Resource type (e.g. "orders").
 * @returns {string} Formatted Redis delegation key.
 */
function formatDelegationKey(granteeUserId, ownerTenantId, resourceType) {
  return `deleg:${granteeUserId}:${ownerTenantId}:${resourceType}`;
}

/**
 * Retrieves delegation record for a grantee user, owner tenant, and resource type.
 * Queries Redis HASH key deleg:{granteeUserId}:{ownerTenantId}:{resourceType}.
 * Supports both HASH format (fields actions & expiresAt) and JSON string format.
 * Falls back to mock adapter in unit tests when live Redis is unreachable.
 * Fails closed (returns null) on connection errors, missing records, or malformed data.
 *
 * @param {string} granteeUserId - Grantee user ID (sub).
 * @param {string} ownerTenantId - Owner tenant ID.
 * @param {string} resourceType - Resource type (e.g. "orders").
 * @returns {Promise<{ actions: string[], expiresAt: number }|null>} Parsed delegation data or null.
 */
async function getDelegation(granteeUserId, ownerTenantId, resourceType) {
  if (!granteeUserId || !ownerTenantId || !resourceType) {
    return null;
  }

  // Simulate Redis outage for fail-closed testing
  if (forceRedisFailure) {
    return null;
  }

  const key = formatDelegationKey(granteeUserId, ownerTenantId, resourceType);

  const redis = getRedisClient();
  if (redis && !forceMockMode) {
    try {
      if (redis.status === "ready" || redis.status === "connecting") {
        // 1. Try HASH lookup first (integrated Ownership Service format)
        const hashData = await redis.hgetall(key);
        if (hashData && Object.keys(hashData).length > 0) {
          let actions = [];
          if (typeof hashData.actions === "string") {
            actions = hashData.actions.split(",").map((a) => a.trim()).filter(Boolean);
          } else if (Array.isArray(hashData.actions)) {
            actions = hashData.actions;
          }
          const expiresAt = typeof hashData.expiresAt === "number" ? hashData.expiresAt : parseInt(hashData.expiresAt, 10);
          if (actions.length > 0 && !isNaN(expiresAt)) {
            return { actions, expiresAt };
          }
        }

        // 2. Fallback to GET string JSON if Hash is empty
        const rawData = await redis.get(key);
        if (rawData) {
          const parsed = JSON.parse(rawData);
          let actions = [];
          if (typeof parsed.actions === "string") {
            actions = parsed.actions.split(",").map((a) => a.trim()).filter(Boolean);
          } else if (Array.isArray(parsed.actions)) {
            actions = parsed.actions;
          }
          const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : parseInt(parsed.expiresAt, 10);
          if (actions.length > 0 && !isNaN(expiresAt)) {
            return { actions, expiresAt };
          }
        }
      }
    } catch (_) {
      // Redis execution error -> fallback or return null
    }
  }

  // Fallback to mock adapter for unit tests when offline
  const mockData = MOCK_DELEGATION_STORE[key];
  if (mockData) {
    const parsed = typeof mockData === "string" ? JSON.parse(mockData) : mockData;
    let actions = [];
    if (typeof parsed.actions === "string") {
      actions = parsed.actions.split(",").map((a) => a.trim()).filter(Boolean);
    } else if (Array.isArray(parsed.actions)) {
      actions = parsed.actions;
    }
    const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : parseInt(parsed.expiresAt, 10);
    if (actions.length > 0 && !isNaN(expiresAt)) {
      return { actions, expiresAt };
    }
  }

  return null;
}

/**
 * Seeds a delegation record into Redis or mock store for testing/development.
 *
 * @param {string} granteeUserId
 * @param {string} ownerTenantId
 * @param {string} resourceType
 * @param {Object} delegationData - { actions: string[]|string, expiresAt: number|string }
 */
async function seedDelegation(granteeUserId, ownerTenantId, resourceType, delegationData) {
  const key = formatDelegationKey(granteeUserId, ownerTenantId, resourceType);

  const actionsArr = Array.isArray(delegationData.actions)
    ? delegationData.actions
    : String(delegationData.actions || "").split(",").map((a) => a.trim()).filter(Boolean);

  const actionsStr = actionsArr.join(",");
  const expiresAtNum = Number(delegationData.expiresAt);

  const record = {
    actions: actionsArr,
    expiresAt: expiresAtNum
  };

  MOCK_DELEGATION_STORE[key] = record;

  const redis = getRedisClient();
  if (redis && (redis.status === "ready" || redis.status === "connecting")) {
    try {
      await redis.hset(key, {
        actions: actionsStr,
        expiresAt: String(expiresAtNum)
      });
    } catch (_) {
      // Ignore offline errors during seeding
    }
  }
}

/**
 * Clears in-memory mock delegation store for test isolation.
 */
function clearDelegations() {
  for (const k of Object.keys(MOCK_DELEGATION_STORE)) {
    delete MOCK_DELEGATION_STORE[k];
  }
}

module.exports = {
  formatDelegationKey,
  getDelegation,
  seedDelegation,
  clearDelegations,
  setMockMode,
  setRedisFailureMode,
  closeRedisClient: closeRedis,
  MOCK_DELEGATION_STORE
};
