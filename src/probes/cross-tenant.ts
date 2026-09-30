import type { ApiClient } from "../client/api-client.js";
import type { ProbeContext, ProbeResult } from "./types.js";

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

      // Find objects belonging to a different tenant than user.tenant_id
      const crossTenantObjects = objects.filter(
        (obj) => obj.tenant_id && obj.tenant_id !== user.tenant_id
      );

      for (const obj of crossTenantObjects) {
        let resolvedPath = endpoint.path;
        for (const param of endpoint.parameters) {
          if (param.toLowerCase().includes("user")) {
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
            testType: "cross-tenant",
            authenticatedUser: user.username || user.id,
            expectedAuthorizationBehavior: "deny",
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
            expectedAuthorizationBehavior: "deny",
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
