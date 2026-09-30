import http from "node:http";
import type { AddressInfo } from "node:net";

export interface MockSampleAppServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

export function startMockSampleApp(mode: "vulnerable" | "secure"): Promise<MockSampleAppServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? "";
      const method = req.method ?? "GET";

      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("end", () => {
        // Headers helper
        const sendJson = (statusCode: number, data: unknown) => {
          res.writeHead(statusCode, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data));
        };

        // Endpoint: GET /openapi.json
        if (url === "/openapi.json" && method === "GET") {
          return sendJson(200, {
            openapi: "3.0.0",
            info: {
              title: "ZeroTrustAPI Sample App Mock",
              version: "1.0.0",
            },
            paths: {
              "/api/orders/{orderId}": {
                get: {
                  summary: "Get order by ID",
                  operationId: "getOrder",
                },
                delete: {
                  summary: "Delete order by ID",
                  operationId: "deleteOrder",
                },
              },
              "/api/orders": {
                post: {
                  summary: "Create order",
                  operationId: "createOrder",
                },
              },
              "/api/invoices/{invoiceId}": {
                get: {
                  summary: "Get invoice by ID",
                  operationId: "getInvoice",
                },
              },
              "/api/users/{userId}/documents/{documentId}": {
                get: {
                  summary: "Get user document",
                  operationId: "getUserDocument",
                },
              },
            },
          });
        }

        // Endpoint: GET /_test/fixtures
        if (url === "/_test/fixtures" && method === "GET") {
          return sendJson(200, {
            users: [
              {
                id: "userA1",
                tenant_id: "tenantA",
                org_id: "orgA",
                username: "userA1",
                password: "passA1",
                scopes: ["orders:read", "orders:write"],
              },
              {
                id: "userA2",
                tenant_id: "tenantA",
                org_id: "orgA",
                username: "userA2",
                password: "passA2",
                scopes: ["orders:read:tenant"],
              },
              {
                id: "userB1",
                tenant_id: "tenantB",
                org_id: "orgB",
                username: "userB1",
                password: "passB1",
                scopes: ["orders:read", "orders:write"],
              },
            ],
            objects: [
              {
                id: "101",
                type: "order",
                owner_id: "userA1",
                tenant_id: "tenantA",
              },
              {
                id: "102",
                type: "order",
                owner_id: "userA1",
                tenant_id: "tenantA",
              },
              {
                id: "201",
                type: "order",
                owner_id: "userB1",
                tenant_id: "tenantB",
              },
              {
                id: "202",
                type: "order",
                owner_id: "userB1",
                tenant_id: "tenantB",
              },
              {
                id: "inv-1",
                type: "invoice",
                owner_id: "userA1",
                tenant_id: "tenantA",
              },
              {
                id: "inv-2",
                type: "invoice",
                owner_id: "userB1",
                tenant_id: "tenantB",
              },
              {
                id: "doc-1",
                type: "document",
                owner_id: "userA1",
                tenant_id: "tenantA",
              },
              {
                id: "doc-2",
                type: "document",
                owner_id: "userB1",
                tenant_id: "tenantB",
              },
            ],
          });
        }

        // Endpoint: POST /auth/login
        if (url === "/auth/login" && method === "POST") {
          try {
            const parsed = JSON.parse(body || "{}");
            const username = parsed.username;

            let tenantId = "tenantA";
            let userId = username || "userA1";
            let orgId = "orgA";

            if (username === "userB1") {
              tenantId = "tenantB";
              orgId = "orgB";
            }

            const header = Buffer.from(
              JSON.stringify({ alg: "HS256", typ: "JWT" })
            ).toString("base64url");
            const payload = Buffer.from(
              JSON.stringify({
                sub: userId,
                tenant_id: tenantId,
                org_id: orgId,
                scope: ["orders:read", "orders:write"],
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
              })
            ).toString("base64url");

            const token = `${header}.${payload}.mocksignature`;

            return sendJson(200, {
              access_token: token,
              token_type: "Bearer",
            });
          } catch {
            return sendJson(400, { error: "Invalid login payload" });
          }
        }

        // Handle Resource API Endpoints
        // Inspect Authorization token if present
        const authHeader = req.headers["authorization"] ?? "";
        let requestUser = "";

        if (authHeader.startsWith("Bearer ")) {
          const rawToken = authHeader.slice(7);
          const parts = rawToken.split(".");
          if (parts.length === 3 && parts[1]) {
            try {
              const decodedPayload = JSON.parse(
                Buffer.from(parts[1], "base64url").toString("utf-8")
              );
              requestUser = decodedPayload.sub ?? "";
            } catch {
              // ignore decode error
            }
          }
        }

        if (mode === "vulnerable") {
          // Vulnerable mode: Allow all access (return 200 OK)
          return sendJson(200, {
            status: "success",
            message: "Access granted (Vulnerable Mode)",
            url,
            method,
            requestUser,
          });
        }

        // Secure mode: Check object ownership based on target resource ID
        const isUserA1Resource =
          url.includes("101") ||
          url.includes("102") ||
          url.includes("inv-1") ||
          url.includes("doc-1");

        const isUserB1Resource =
          url.includes("201") ||
          url.includes("202") ||
          url.includes("inv-2") ||
          url.includes("doc-2");

        if (requestUser === "userA1" && isUserA1Resource) {
          return sendJson(200, { status: "success", data: "Owner data" });
        }
        if (requestUser === "userB1" && isUserB1Resource) {
          return sendJson(200, { status: "success", data: "Owner data" });
        }

        // Non-owner unauthorized access in Secure Mode -> 403 Forbidden
        return sendJson(403, { error: "Forbidden: Access denied" });

      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      const port = addr.port;
      const url = `http://127.0.0.1:${port}`;

      resolve({
        url,
        port,
        close: () =>
          new Promise((resClose) => {
            server.close(() => resClose());
          }),
      });
    });

    server.on("error", (err) => reject(err));
  });
}
