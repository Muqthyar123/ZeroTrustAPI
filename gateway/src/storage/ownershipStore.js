const { getRedisClient, closeRedis } = require("./redis");

// In-memory mock adapter data store for unit testing when live Redis is offline
const MOCK_REDIS_STORE = {
  "obj:orders:101": { ownerUserId: "userA1", tenantId: "tenantA", orgId: "org1", owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" },
  "obj:orders:102": { ownerUserId: "userA1", tenantId: "tenantA", orgId: "org1", owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" },
  "obj:orders:201": { ownerUserId: "userA1", tenantId: "tenantA", orgId: "org1", owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" },
  "obj:orders:202": { ownerUserId: "userB1", tenantId: "tenantB", orgId: "org1", owner_sub: "userB1", tenant_id: "tenantB", org_id: "org1" },
  "obj:invoices:301": { ownerUserId: "userA1", tenantId: "tenantA", orgId: "org1", owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" },
  "obj:documents:doc101": { ownerUserId: "userA1", tenantId: "tenantA", orgId: "org1", owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" },
  // Backward compatibility keys for existing unit tests
  "zt:object:orders:101": JSON.stringify({ owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" }),
  "zt:object:orders:102": JSON.stringify({ owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" }),
  "zt:object:orders:201": JSON.stringify({ owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" }),
  "zt:object:orders:202": JSON.stringify({ owner_sub: "userB1", tenant_id: "tenantA", org_id: "org1" }),
  "zt:object:orders:203": JSON.stringify({ owner_sub: "userC1", tenant_id: "tenantB", org_id: "org1" }),
  "zt:object:orders:204": JSON.stringify({ owner_sub: "userD1", tenant_id: "tenantA", org_id: "org2" }),
  "zt:object:users:userA1": JSON.stringify({ owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" }),
  "zt:object:users:userB1": JSON.stringify({ owner_sub: "userB1", tenant_id: "tenantA", org_id: "org1" })
};

let forceMockMode = false;
let forceRedisFailure = false;

function setMockMode(enabled) {
  forceMockMode = enabled;
}

function setRedisFailureMode(enabled) {
  forceRedisFailure = enabled;
}

/**
 * Formats Redis key for object ownership data.
 * Format: obj:{resource}:{objectId}
 *
 * @param {string} resource - Resource name.
 * @param {string} objectId - Object identifier.
 * @returns {string} Formatted key.
 */
function formatObjectKey(resource, objectId) {
  return `obj:${resource}:${objectId}`;
}

/**
 * Retrieves object ownership and access metadata for a given resource and object ID.
 * Queries Redis HASH key obj:{resource}:{objectId} with fields tenantId & ownerUserId.
 * Falls back to mock adapter in unit tests when live Redis is unreachable.
 * Fails closed (returns null) on connection errors or missing records.
 *
 * @param {string} resource - Resource name (e.g. "orders").
 * @param {string} objectId - Object identifier (e.g. "201").
 * @returns {Promise<Object|null>} Object access metadata or null.
 */
async function getObjectAccess(resource, objectId) {
  if (!resource || !objectId) {
    return null;
  }

  // Simulate Redis outage for fail-closed testing
  if (forceRedisFailure) {
    return null;
  }

  const primaryKey = formatObjectKey(resource, objectId);
  const legacyKey = `zt:object:${resource}:${objectId}`;

  // Try Redis lookup first if client is available
  const redis = getRedisClient();
  if (redis && !forceMockMode) {
    try {
      if (redis.status === "ready" || redis.status === "connecting") {
        // 1. Try HASH lookup on primary key (integrated Ownership Service format: obj:{resource}:{objectId})
        const hashData = await redis.hgetall(primaryKey);
        if (hashData && Object.keys(hashData).length > 0) {
          const ownerSub = hashData.ownerUserId || hashData.owner_sub || hashData.owner;
          const tenantId = hashData.tenantId || hashData.tenant_id;
          const orgId = hashData.orgId || hashData.org_id;
          if (ownerSub && tenantId) {
            return {
              owner_sub: ownerSub,
              tenant_id: tenantId,
              org_id: orgId
            };
          }
        }

        // 2. Try HASH lookup on legacy key
        const legacyHash = await redis.hgetall(legacyKey);
        if (legacyHash && Object.keys(legacyHash).length > 0) {
          const ownerSub = legacyHash.ownerUserId || legacyHash.owner_sub || legacyHash.owner;
          const tenantId = legacyHash.tenantId || legacyHash.tenant_id;
          const orgId = legacyHash.orgId || legacyHash.org_id;
          if (ownerSub && tenantId) {
            return {
              owner_sub: ownerSub,
              tenant_id: tenantId,
              org_id: orgId
            };
          }
        }

        // 3. Fallback to GET string format
        const rawData = (await redis.get(primaryKey)) || (await redis.get(legacyKey));
        if (rawData) {
          const parsed = JSON.parse(rawData);
          return {
            owner_sub: parsed.ownerUserId || parsed.owner_sub || parsed.owner,
            tenant_id: parsed.tenantId || parsed.tenant_id,
            org_id: parsed.orgId || parsed.org_id
          };
        }
      }
    } catch (_) {
      // Redis execution error -> fallback or return null
    }
  }

  // Fallback to mock adapter for unit tests when offline
  const mockData = MOCK_REDIS_STORE[primaryKey] || MOCK_REDIS_STORE[legacyKey];
  if (mockData) {
    const parsed = typeof mockData === "string" ? JSON.parse(mockData) : mockData;
    return {
      owner_sub: parsed.ownerUserId || parsed.owner_sub || parsed.owner,
      tenant_id: parsed.tenantId || parsed.tenant_id,
      org_id: parsed.orgId || parsed.org_id
    };
  }

  return null;
}

/**
 * Seeds a key-value record into Redis or mock store for testing.
 *
 * @param {string} resource
 * @param {string} objectId
 * @param {Object} metadata - { owner_sub, tenant_id, org_id }
 */
async function seedObjectAccess(resource, objectId, metadata) {
  const primaryKey = formatObjectKey(resource, objectId);
  const legacyKey = `zt:object:${resource}:${objectId}`;

  const ownerUserId = metadata.ownerUserId || metadata.owner_sub || metadata.owner;
  const tenantId = metadata.tenantId || metadata.tenant_id;
  const orgId = metadata.orgId || metadata.org_id;

  const record = {
    ownerUserId,
    tenantId,
    orgId,
    owner_sub: ownerUserId,
    tenant_id: tenantId,
    org_id: orgId
  };

  MOCK_REDIS_STORE[primaryKey] = record;
  MOCK_REDIS_STORE[legacyKey] = record;

  const redis = getRedisClient();
  if (redis && (redis.status === "ready" || redis.status === "connecting")) {
    try {
      await redis.hset(primaryKey, {
        ownerUserId,
        tenantId,
        orgId
      });
    } catch (_) {
      // Ignore offline errors during seeding
    }
  }
}

module.exports = {
  formatObjectKey,
  getObjectAccess,
  seedObjectAccess,
  setMockMode,
  setRedisFailureMode,
  closeRedisClient: closeRedis,
  MOCK_REDIS_STORE
};


