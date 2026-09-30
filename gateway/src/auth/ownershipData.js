/**
 * In-memory ownership data store.
 * Maps resource types and object IDs to owner identity, tenant_id, and org_id.
 * This separate data abstraction can later be replaced by Redis / database storage.
 */
const OWNERSHIP_STORE = {
  orders: {
    "201": { owner: "userA1", tenant_id: "tenantA", org_id: "org1" },
    "202": { owner: "userB1", tenant_id: "tenantA", org_id: "org1" },
    "203": { owner: "userC1", tenant_id: "tenantB", org_id: "org1" },
    "204": { owner: "userD1", tenant_id: "tenantA", org_id: "org2" }
  },
  users: {
    userA1: { owner: "userA1", tenant_id: "tenantA", org_id: "org1" },
    userB1: { owner: "userB1", tenant_id: "tenantA", org_id: "org1" }
  }
};

/**
 * Looks up object ownership metadata from the data store.
 *
 * @param {string} resource - Resource name (e.g. "orders").
 * @param {string} objectId - Object identifier (e.g. "201").
 * @returns {Object|null} Object record or null if not found.
 */
function getObjectMetadata(resource, objectId) {
  if (!resource || !objectId || !OWNERSHIP_STORE[resource]) {
    return null;
  }
  return OWNERSHIP_STORE[resource][objectId] || null;
}

module.exports = {
  OWNERSHIP_STORE,
  getObjectMetadata
};
