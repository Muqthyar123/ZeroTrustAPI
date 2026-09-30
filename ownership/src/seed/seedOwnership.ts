import type { Redis } from "ioredis";
import { OwnershipRepository } from "../redis/ownershipRepository.js";
import { DelegationRepository } from "../redis/delegationRepository.js";

export interface SeedDataResult {
  ownershipsSeeded: number;
  delegationsSeeded: number;
}

/**
 * Frozen seed records:
 * - orders:101 -> tenantA / userA1
 * - orders:102 -> tenantA / userA1
 * - orders:201 -> tenantB / userB1
 * - orders:202 -> tenantB / userB1
 * - userB1 -> tenantA -> orders -> read (valid for ~24 hours)
 *
 * Idempotent: repeated runs safely overwrite/set the exact same keys without duplicating state.
 */
export async function seedOwnershipData(redis: Redis): Promise<SeedDataResult> {
  const ownershipRepo = new OwnershipRepository(redis);
  const delegationRepo = new DelegationRepository(redis);

  // 1. Seed Order Ownerships
  const seedOrders = [
    { resourceType: "orders", objectId: "101", tenantId: "tenantA", ownerUserId: "userA1" },
    { resourceType: "orders", objectId: "102", tenantId: "tenantA", ownerUserId: "userA1" },
    { resourceType: "orders", objectId: "201", tenantId: "tenantB", ownerUserId: "userB1" },
    { resourceType: "orders", objectId: "202", tenantId: "tenantB", ownerUserId: "userB1" },
  ];

  for (const item of seedOrders) {
    await ownershipRepo.setOwnership(
      item.resourceType,
      item.objectId,
      item.tenantId,
      item.ownerUserId,
    );
  }

  // 2. Seed Frozen Demo Delegation: userB1 -> tenantA -> orders -> read (~24h expiry)
  const now = Math.floor(Date.now() / 1000);
  const expiry24h = now + 86400; // 24 hours in the future

  await delegationRepo.setDelegation(
    "userB1",
    "tenantA",
    "orders",
    "read",
    expiry24h,
  );

  return {
    ownershipsSeeded: seedOrders.length,
    delegationsSeeded: 1,
  };
}
