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

export async function runWriteDeleteProbes(
  context: ProbeContext,
  client: ApiClient
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  const { targetUrl, endpoints, users, objects, userTokens } = context;

  // Filter for write/delete endpoints with path parameters (targeting specific resources by ID)
  const writeDeleteEndpoints = endpoints.filter(
    (e) => ["POST", "PUT", "PATCH", "DELETE"].includes(e.method) && e.parameters.length > 0
  );

  for (const endpoint of writeDeleteEndpoints) {
    for (const user of users) {
      const token = userTokens.get(user.username || "");
      if (!token) continue;

      // Target objects matching the endpoint resource
      const matchingObjects = objects.filter((obj) => matchesEndpointResource(endpoint.path, obj.type));

      for (const obj of matchingObjects) {
        let resolvedPath = endpoint.path;

        for (const param of endpoint.parameters) {
          const lowerParam = param.toLowerCase();
          if (lowerParam.includes("user")) {
            resolvedPath = resolvedPath.replace(`{${param}}`, user.id);
          } else {
            resolvedPath = resolvedPath.replace(`{${param}}`, obj.id);
          }
        }

        if (resolvedPath.includes("{")) {
          continue;
        }

        const actualUrl = `${targetUrl.replace(/\/$/, "")}${resolvedPath}`;

        const isOwner = obj.owner_id === user.id;

        const hasDelegation = (context.delegations ?? []).some((d) => {
          const matchesUser = d.granteeUserId === user.id || d.granteeUserId === user.username;
          const matchesTenant = d.ownerTenantId === obj.tenant_id;
          const matchesResource = !d.resourceType || d.resourceType === obj.type || endpoint.path.includes(d.resourceType);
          const matchesAction = d.actions.includes("write") || d.actions.includes("delete") || d.actions.includes("*");
          const isActive = !d.status || d.status === "active";
          return matchesUser && matchesTenant && matchesResource && matchesAction && isActive;
        });

        const expectedAuthorizationBehavior = isOwner || hasDelegation ? "allow" : "deny";

        try {
          let response;
          const dummyPayload = { ...obj, probe: "zerotrust-test" };

          if (endpoint.method === "POST") {
            response = await client.post(actualUrl, dummyPayload, token);
          } else if (endpoint.method === "PUT") {
            response = await client.put(actualUrl, dummyPayload, token);
          } else if (endpoint.method === "PATCH") {
            response = await client.patch(actualUrl, dummyPayload, token);
          } else if (endpoint.method === "DELETE") {
            response = await client.delete(actualUrl, token);
          }

          if (response) {
            const accessAllowed = response.status >= 200 && response.status < 300;

            results.push({
              method: endpoint.method,
              path: endpoint.path,
              actualUrl,
              testType: "write-delete",
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
          }
        } catch (error) {
          results.push({
            method: endpoint.method,
            path: endpoint.path,
            actualUrl,
            testType: "write-delete",
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
