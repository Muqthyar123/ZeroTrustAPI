import type { ApiClient } from "../client/api-client.js";
import type { ProbeContext, ProbeResult } from "./types.js";

function matchesEndpointResource(endpointPath: string, objType?: string): boolean {
  if (!objType) return true;
  const p = endpointPath.toLowerCase();
  const t = objType.toLowerCase();
  if (p.includes(t)) return true;
  if (t === "orders" && p.includes("order")) return true;
  if (t === "invoices" && p.includes("invoice")) return true;
  if ((t === "documents" || t === "document") && p.includes("document")) return true;
  return false;
}

export async function runCrossTenantProbes(
  context: ProbeContext,
  client: ApiClient
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  const { targetUrl, endpoints, users, objects, userTokens } = context;

  const getEndpoints = endpoints.filter(
    (e) => e.method === "GET" && e.parameters.length > 0
  );

  for (const endpoint of getEndpoints) {
    for (const user of users) {
      const token = userTokens.get(user.username || "");
      if (!token) continue;

      // Find objects belonging to a different tenant than user.tenant_id that match the endpoint resource
      const crossTenantObjects = objects.filter(
        (obj) => obj.tenant_id && obj.tenant_id !== user.tenant_id && matchesEndpointResource(endpoint.path, obj.type)
      );

      for (const obj of crossTenantObjects) {
        let resolvedPath = endpoint.path;
        for (const param of endpoint.parameters) {
          if (param.toLowerCase().includes("user") || (param.toLowerCase() === "id" && endpoint.path.includes("/users/"))) {
            resolvedPath = resolvedPath.replace(`{${param}}`, user.id);
          } else {
            resolvedPath = resolvedPath.replace(`{${param}}`, obj.id);
          }
        }

        if (resolvedPath.includes("{")) {
          continue;
        }

        const actualUrl = `${targetUrl.replace(/\/$/, "")}${resolvedPath}`;

        // Check if an active delegation exists for this user on this resource/tenant
        const hasDelegation = (context.delegations ?? []).some((d) => {
          const matchesUser = d.granteeUserId === user.id || d.granteeUserId === user.username;
          const matchesTenant = d.ownerTenantId === obj.tenant_id;
          const matchesResource = !d.resourceType || d.resourceType === obj.type || endpoint.path.includes(d.resourceType);
          const matchesAction = d.actions.includes("read") || d.actions.includes("*");
          const isActive = !d.status || d.status === "active";
          return matchesUser && matchesTenant && matchesResource && matchesAction && isActive;
        });

        const expectedAuthorizationBehavior = hasDelegation ? "allow" : "deny";

        try {
          const response = await client.get(actualUrl, token);
          const accessAllowed = response.status >= 200 && response.status < 300;

          results.push({
            method: endpoint.method,
            path: endpoint.path,
            actualUrl,
            testType: "cross-tenant",
            authenticatedUser: user.username || user.id,
            expectedAuthorizationBehavior,
            httpStatus: response.status,
            responseInfo: response.data,
            objectId: obj.id,
            objectOwner: obj.owner_id,
            objectTenant: obj.tenant_id,
            userTenant: user.tenant_id,
            accessAllowed,
          });
        } catch (error) {
          results.push({
            method: endpoint.method,
            path: endpoint.path,
            actualUrl,
            testType: "cross-tenant",
            authenticatedUser: user.username || user.id,
            expectedAuthorizationBehavior,
            httpStatus: 0,
            responseInfo: error instanceof Error ? error.message : String(error),
            objectId: obj.id,
            objectOwner: obj.owner_id,
            objectTenant: obj.tenant_id,
            userTenant: user.tenant_id,
            accessAllowed: false,
          });
        }
      }
    }
  }

  return results;
}
