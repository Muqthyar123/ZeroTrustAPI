import type { ApiClient } from "../client/api-client.js";
import type { ProbeContext, ProbeResult } from "./types.js";

export async function runWriteDeleteProbes(
  context: ProbeContext,
  client: ApiClient
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  const { targetUrl, endpoints, users, objects, userTokens } = context;

  // Filter for write/delete endpoints: POST, PUT, PATCH, DELETE
  const writeDeleteEndpoints = endpoints.filter(
    (e) => ["POST", "PUT", "PATCH", "DELETE"].includes(e.method)
  );

  for (const endpoint of writeDeleteEndpoints) {
    for (const user of users) {
      const token = userTokens.get(user.username || "");
      if (!token) continue;

      // Target objects owned by other users/tenants to probe write/delete BOLA
      for (const obj of objects) {
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
        const expectedAuthorizationBehavior = isOwner ? "allow" : "deny";

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
