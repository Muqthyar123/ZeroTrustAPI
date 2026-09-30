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

export async function runOwnObjectProbes(
  context: ProbeContext,
  client: ApiClient
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  const { targetUrl, endpoints, users, objects, userTokens } = context;

  // Filter for GET endpoints with path parameters
  const getEndpoints = endpoints.filter(
    (e) => e.method === "GET" && e.parameters.length > 0
  );

  for (const endpoint of getEndpoints) {
    for (const user of users) {
      const token = userTokens.get(user.username || "");
      if (!token) continue;

      // Find objects owned by this user that match the endpoint's resource type
      const ownedObjects = objects.filter(
        (obj) => obj.owner_id === user.id && matchesEndpointResource(endpoint.path, obj.type)
      );

      for (const obj of ownedObjects) {
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

        try {
          const response = await client.get(actualUrl, token);
          const accessAllowed = response.status >= 200 && response.status < 300;

          results.push({
            method: endpoint.method,
            path: endpoint.path,
            actualUrl,
            testType: "own-object",
            authenticatedUser: user.username || user.id,
            expectedAuthorizationBehavior: "allow",
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
            testType: "own-object",
            authenticatedUser: user.username || user.id,
            expectedAuthorizationBehavior: "allow",
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
