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

export async function runNestedProbes(
  context: ProbeContext,
  client: ApiClient
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  const { targetUrl, endpoints, users, objects, userTokens } = context;

  // Filter for endpoints with multiple path parameters (nested endpoints)
  const nestedEndpoints = endpoints.filter(
    (e) => e.parameters.length > 1
  );

  for (const endpoint of nestedEndpoints) {
    if (endpoint.method !== "GET") continue;

    for (const user of users) {
      const token = userTokens.get(user.username || "");
      if (!token) continue;

      // Filter objects matching the nested endpoint resource
      const matchingObjects = objects.filter((obj) => matchesEndpointResource(endpoint.path, obj.type));

      for (const obj of matchingObjects) {
        let resolvedPath = endpoint.path;

        // Substitute every path parameter dynamically
        for (const param of endpoint.parameters) {
          const lowerParam = param.toLowerCase();
          if (lowerParam.includes("user")) {
            // Use target object owner if testing access to other user's subresource, or current user if testing own
            const targetUserId = obj.owner_id || user.id;
            resolvedPath = resolvedPath.replace(`{${param}}`, targetUserId);
          } else if (lowerParam.includes("owner")) {
            resolvedPath = resolvedPath.replace(`{${param}}`, obj.owner_id || user.id);
          } else {
            // Document/Resource ID
            resolvedPath = resolvedPath.replace(`{${param}}`, obj.id);
          }
        }

        if (resolvedPath.includes("{")) {
          continue;
        }

        const actualUrl = `${targetUrl.replace(/\/$/, "")}${resolvedPath}`;

        // Determine expected behavior based on ownership and tenant matching
        const isOwner = obj.owner_id === user.id;
        const expectedAuthorizationBehavior = isOwner ? "allow" : "deny";

        try {
          const response = await client.get(actualUrl, token);
          const accessAllowed = response.status >= 200 && response.status < 300;

          results.push({
            method: endpoint.method,
            path: endpoint.path,
            actualUrl,
            testType: "nested",
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
            testType: "nested",
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
