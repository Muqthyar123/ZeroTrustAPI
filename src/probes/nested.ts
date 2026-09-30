import type { ApiClient } from "../client/api-client.js";
import type { ProbeContext, ProbeResult } from "./types.js";

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

      // Try each object in combination or matching parent/child relation
      for (const obj of objects) {
        let resolvedPath = endpoint.path;

        // Substitute every path parameter dynamically
        for (const param of endpoint.parameters) {
          const lowerParam = param.toLowerCase();
          if (lowerParam.includes("user")) {
            resolvedPath = resolvedPath.replace(`{${param}}`, user.id);
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
        const isSameTenant = obj.tenant_id === user.tenant_id;
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
