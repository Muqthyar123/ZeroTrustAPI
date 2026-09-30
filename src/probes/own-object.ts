import type { ApiClient } from "../client/api-client.js";
import type { ProbeContext, ProbeResult } from "./types.js";

export async function runOwnObjectProbes(
  context: ProbeContext,
  client: ApiClient
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  const { targetUrl, endpoints, users, objects, userTokens } = context;

  // Filter for GET endpoints with single or multiple parameters where objects can be mapped
  const getEndpoints = endpoints.filter(
    (e) => e.method === "GET" && e.parameters.length > 0
  );

  for (const endpoint of getEndpoints) {
    // For single parameter endpoints, find matching objects by owner
    for (const user of users) {
      const token = userTokens.get(user.username || "");
      if (!token) continue;

      // Find objects owned by this user
      const ownedObjects = objects.filter((obj) => obj.owner_id === user.id);

      for (const obj of ownedObjects) {
        // Construct path by replacing path parameters
        let resolvedPath = endpoint.path;
        for (const param of endpoint.parameters) {
          if (param.toLowerCase().includes("user") || param.toLowerCase() === "id" && endpoint.path.includes("/users/")) {
            resolvedPath = resolvedPath.replace(`{${param}}`, user.id);
          } else {
            resolvedPath = resolvedPath.replace(`{${param}}`, obj.id);
          }
        }

        // If any unreplaced parameters remain, skip or fill with object id
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
          // Record network or fetch errors as unexpected status (e.g. 500)
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
