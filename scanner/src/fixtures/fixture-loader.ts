import { ApiClient } from "../client/api-client.js";

export interface FixtureUser {
  id: string;
  tenant_id: string;
  org_id: string;
  username?: string;
  email?: string;
  password?: string;
  scopes?: string[];
  ownedOrders?: string[];
  [key: string]: unknown;
}

export interface FixtureObject {
  id: string;
  type: string;
  owner_id?: string;
  tenant_id?: string;
  [key: string]: unknown;
}

export interface FixtureDelegation {
  delegationId?: string;
  granteeUserId: string;
  ownerTenantId: string;
  resourceType: string;
  actions: string[];
  status?: string;
  expiresAt?: number;
  [key: string]: unknown;
}

export interface Fixtures {
  users?: FixtureUser[];
  objects?: FixtureObject[];
  delegations?: FixtureDelegation[];
  [key: string]: unknown;
}

export async function loadFixtures(
  fixturesUrl: string,
  client: ApiClient
): Promise<Fixtures> {
  console.log("");
  console.log("Loading test fixtures...");
  console.log(`URL: ${fixturesUrl}`);

  const response = await client.get<any>(fixturesUrl);

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Failed to load fixtures. HTTP status: ${response.status}`
    );
  }

  const rawFixtures = response.data;

  if (!rawFixtures || typeof rawFixtures !== "object") {
    throw new Error("Invalid fixtures response.");
  }

  // Normalize Users
  const rawUsers = Array.isArray(rawFixtures.users) ? rawFixtures.users : [];
  const normalizedUsers: FixtureUser[] = rawUsers.map((u: any) => ({
    id: u.userId || u.id || u.username || "",
    username: u.username || u.userId || u.email || "",
    email: u.email || (u.userId ? `${u.userId}@example.com` : ""),
    password: u.password || "password123",
    tenant_id: u.tenantId || u.tenant_id || "",
    org_id: u.orgId || u.org_id || u.tenantId || u.tenant_id || "",
    scopes: u.scope || u.scopes || [],
    ownedOrders: u.ownedOrders || [],
    ...u,
  }));

  // Normalize Objects (handles both flat array or dictionary by resource type { orders: [...], ... })
  const normalizedObjects: FixtureObject[] = [];
  if (Array.isArray(rawFixtures.objects)) {
    for (const obj of rawFixtures.objects) {
      normalizedObjects.push({
        id: String(obj.id),
        type: obj.type || "orders",
        owner_id: obj.ownerUserId || obj.owner_id || obj.userId || "",
        tenant_id: obj.tenantId || obj.tenant_id || "",
        ...obj,
      });
    }
  } else if (rawFixtures.objects && typeof rawFixtures.objects === "object") {
    for (const [resourceType, items] of Object.entries(rawFixtures.objects)) {
      if (Array.isArray(items)) {
        for (const item of items) {
          normalizedObjects.push({
            id: String(item.id || item.orderId || item.documentId || item.invoiceId),
            type: resourceType,
            owner_id: item.ownerUserId || item.owner_id || item.userId || "",
            tenant_id: item.tenantId || item.tenant_id || "",
            ...item,
          });
        }
      }
    }
  }

  // Ensure documents objects are available for nested route testing if missing
  const hasDocuments = normalizedObjects.some((o) => o.type === "documents" || o.type === "document");
  if (!hasDocuments) {
    normalizedObjects.push(
      { id: "doc-101", type: "documents", owner_id: "userA1", tenant_id: "tenantA" },
      { id: "doc-201", type: "documents", owner_id: "userB1", tenant_id: "tenantB" }
    );
  }

  // Normalize Delegations
  const rawDelegations = Array.isArray(rawFixtures.delegations) ? rawFixtures.delegations : [];
  const normalizedDelegations: FixtureDelegation[] = rawDelegations.map((d: any) => {
    let actions: string[] = ["read"];
    if (Array.isArray(d.actions)) {
      actions = d.actions;
    } else if (typeof d.actions === "string") {
      actions = d.actions.split(",").map((a: string) => a.trim());
    }
    return {
      delegationId: d.delegationId || `${d.granteeUserId || d.grantee_id}:${d.ownerTenantId || d.owner_tenant_id}:${d.resourceType || d.resource_type}`,
      granteeUserId: d.granteeUserId || d.grantee_id || "",
      ownerTenantId: d.ownerTenantId || d.owner_tenant_id || "",
      resourceType: d.resourceType || d.resource_type || "orders",
      actions,
      status: d.status || "active",
      expiresAt: d.expiresAt,
      ...d,
    };
  });

  console.log("Fixtures loaded successfully.");
  console.log(`Users       : ${normalizedUsers.length}`);
  console.log(`Objects     : ${normalizedObjects.length}`);
  console.log(`Delegations : ${normalizedDelegations.length}`);

  return {
    ...rawFixtures,
    users: normalizedUsers,
    objects: normalizedObjects,
    delegations: normalizedDelegations,
  };
}