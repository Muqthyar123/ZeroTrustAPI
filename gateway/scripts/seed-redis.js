/**
 * Development & Testing Helper Script
 * Seeds deterministic object ownership records and delegation grants into Redis (or mock store).
 *
 * Usage:
 *   node scripts/seed-redis.js
 */

const { seedObjectAccess } = require("../src/storage/ownershipStore");
const { seedDelegation } = require("../src/storage/delegationStore");

const OBJECT_SEED_DATA = [
  {
    resource: "orders",
    objectId: "101",
    metadata: { owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" }
  },
  {
    resource: "orders",
    objectId: "102",
    metadata: { owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" }
  },
  {
    resource: "orders",
    objectId: "201",
    metadata: { owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" }
  },
  {
    resource: "orders",
    objectId: "202",
    metadata: { owner_sub: "userB1", tenant_id: "tenantA", org_id: "org1" }
  },
  {
    resource: "orders",
    objectId: "203",
    metadata: { owner_sub: "userC1", tenant_id: "tenantB", org_id: "org1" }
  },
  {
    resource: "orders",
    objectId: "204",
    metadata: { owner_sub: "userD1", tenant_id: "tenantA", org_id: "org2" }
  },
  {
    resource: "users",
    objectId: "userA1",
    metadata: { owner_sub: "userA1", tenant_id: "tenantA", org_id: "org1" }
  },
  {
    resource: "users",
    objectId: "userB1",
    metadata: { owner_sub: "userB1", tenant_id: "tenantA", org_id: "org1" }
  }
];

const DELEGATION_SEED_DATA = [
  {
    granteeUserId: "userB1",
    ownerTenantId: "tenantA",
    resourceType: "orders",
    delegation: {
      actions: ["read", "write"],
      expiresAt: 2000000000 // Far future Unix timestamp
    }
  }
];

async function seed() {
  console.log("Seeding Redis ownership and delegation store for development/testing...");
  for (const item of OBJECT_SEED_DATA) {
    await seedObjectAccess(item.resource, item.objectId, item.metadata);
    console.log(`  - Seeded zt:object:${item.resource}:${item.objectId} -> ${JSON.stringify(item.metadata)}`);
  }
  for (const item of DELEGATION_SEED_DATA) {
    await seedDelegation(item.granteeUserId, item.ownerTenantId, item.resourceType, item.delegation);
    console.log(`  - Seeded deleg:${item.granteeUserId}:${item.ownerTenantId}:${item.resourceType} -> ${JSON.stringify(item.delegation)}`);
  }
  console.log("Seeding complete successfully.");
}

if (require.main === module) {
  seed()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed to seed Redis:", err);
      process.exit(1);
    });
}

module.exports = { seed, OBJECT_SEED_DATA, DELEGATION_SEED_DATA };
