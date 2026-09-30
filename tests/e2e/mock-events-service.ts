import http from "node:http";
import type { AddressInfo } from "node:net";
import type { ScanReport } from "../../src/report/report-builder.js";

export interface MockEventsServer {
  url: string;
  port: number;
  capturedReports: ScanReport[];
  close: () => Promise<void>;
}

export function startMockEventsService(): Promise<MockEventsServer> {
  return new Promise((resolve, reject) => {
    const capturedReports: ScanReport[] = [];

    const server = http.createServer((req, res) => {
      const url = req.url ?? "";
      const method = req.method ?? "GET";

      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("end", () => {
        if (url === "/v1/scans" && method === "POST") {
          try {
            const parsedReport = JSON.parse(body || "{}") as ScanReport;
            capturedReports.push(parsedReport);

            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                scanId: `scan-mock-${Date.now()}`,
                status: "RECEIVED",
              })
            );
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON report payload" }));
          }
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      const port = addr.port;
      const url = `http://127.0.0.1:${port}`;

      resolve({
        url,
        port,
        capturedReports,
        close: () =>
          new Promise((resClose) => {
            server.close(() => resClose());
          }),
      });
    });

    server.on("error", (err) => reject(err));
  });
}
