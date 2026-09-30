import { users } from "../auth/users.js";
import { initialOrders } from "../orders/seed.js";

/**
 * Deterministic test fixtures for CI scanners, integration tests, and demo environments.
 *
 * NOTE: User passwords and private secrets are strictly omitted to maintain security integrity.
 */
export function getTestFixtures() {
  return {
    version: "1.0.0",
    generatedAt: "2026-09-30T00:00:00.000Z",
    tenants: [
      {
        tenantId: "tenantA",
        name: "Tenant A Organization",
      },
      {
        tenantId: "tenantB",
        name: "Tenant B Organization",
      },
    ],
    users: users.map((u) => ({
      userId: u.userId,
      email: u.email,
      tenantId: u.tenantId,
      orgId: u.orgId,
      scope: u.scope,
      ownedOrders: initialOrders
        .filter((o) => o.ownerUserId === u.userId)
        .map((o) => o.id),
    })),
    objects: {
      orders: initialOrders.map((o) => ({
        id: o.id,
        tenantId: o.tenantId,
        ownerUserId: o.ownerUserId,
        status: o.status,
        totalAmount: o.totalAmount,
      })),
    },
    delegations: [
      {
        delegationId: "userB1:tenantA:orders",
        granteeUserId: "userB1",
        ownerTenantId: "tenantA",
        resourceType: "orders",
        actions: "read",
        status: "active",
        description: "Cross-tenant read delegation for userB1 accessing tenantA orders",
      },
    ],
    expectedAuthorization: [
      {
        scenario: "Owner accesses own order in Tenant A",
        userId: "userA1",
        userTenantId: "tenantA",
        resourceType: "orders",
        objectId: "101",
        objectTenantId: "tenantA",
        action: "read",
        expectedResult: "authorized",
        reason: "Direct resource ownership",
      },
      {
        scenario: "Cross-tenant unauthorized order access attempt (BOLA vulnerability)",
        userId: "userA1",
        userTenantId: "tenantA",
        resourceType: "orders",
        objectId: "201",
        objectTenantId: "tenantB",
        action: "read",
        expectedResult: "unauthorized",
        reason: "Cross-tenant boundary violation without valid delegation",
      },
      {
        scenario: "Owner accesses own order in Tenant B",
        userId: "userB1",
        userTenantId: "tenantB",
        resourceType: "orders",
        objectId: "201",
        objectTenantId: "tenantB",
        action: "read",
        expectedResult: "authorized",
        reason: "Direct resource ownership",
      },
      {
        scenario: "Cross-tenant order read permitted via active delegation",
        userId: "userB1",
        userTenantId: "tenantB",
        resourceType: "orders",
        objectId: "101",
        objectTenantId: "tenantA",
        action: "read",
        expectedResult: "authorized",
        reason: "Active delegation grant exists for userB1 -> tenantA:orders:read",
      },
      {
        scenario: "Tenant-wide reader accesses order in same tenant",
        userId: "userA2",
        userTenantId: "tenantA",
        resourceType: "orders",
        objectId: "101",
        objectTenantId: "tenantA",
        action: "read",
        expectedResult: "authorized",
        reason: "Possesses tenant-wide scope orders:read:tenant within tenantA",
      },
    ],
  };
}
