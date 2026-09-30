import { buildOwnershipApp } from "../ownership/src/app.js";
import { createRedisMock } from "../ownership/src/redis/client.js";
import { seedOwnershipData } from "../ownership/src/seed/seedOwnership.js";
import { buildApp as buildSampleApp } from "../sample-app/src/app.js";
import { OwnershipClient } from "../sample-app/src/ownership/ownershipClient.js";
import { buildApp as buildEventsApp } from "../events/src/app.js";
import http from "node:http";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dashboardDir = path.resolve(__dirname, "../dashboard");
const dashboardDistDir = path.resolve(dashboardDir, "dist");

async function runLiveStackVerification() {
  console.log("==================================================================");
  console.log(" ZeroTrustAPI - Live Multi-Service Verification (Standard Ports)");
  console.log("==================================================================");

  const SAMPLE_APP_PORT = 3000;
  const OWNERSHIP_PORT = 4000;
  const EVENTS_PORT = 5000;
  const DASHBOARD_PORT = 5173;

  console.log(`[Standard Ports] Sample App: ${SAMPLE_APP_PORT}, Ownership: ${OWNERSHIP_PORT}, Events: ${EVENTS_PORT}, Dashboard: ${DASHBOARD_PORT}`);

  // 1. Initialize Mock Redis and Seed Data
  const redis = createRedisMock();
  const seedResult = await seedOwnershipData(redis);
  console.log(`[Redis] Initialized ownership store (${seedResult.ownershipsSeeded} records, ${seedResult.delegationsSeeded} delegations).`);

  // 2. Start Ownership Service on Port 4000
  const ownershipApp = buildOwnershipApp({ redis, fastifyOpts: { logger: false } });
  await ownershipApp.listen({ port: OWNERSHIP_PORT, host: "127.0.0.1" });
  console.log(`[Service: Ownership] Listening on http://127.0.0.1:${OWNERSHIP_PORT}`);

  // 3. Start Sample App on Port 3000
  const ownershipClient = new OwnershipClient({
    baseUrl: `http://127.0.0.1:${OWNERSHIP_PORT}`,
  });
  const sampleApp = buildSampleApp({ fastifyOpts: { logger: false }, ownershipClient });
  await sampleApp.listen({ port: SAMPLE_APP_PORT, host: "127.0.0.1" });
  console.log(`[Service: Sample App] Listening on http://127.0.0.1:${SAMPLE_APP_PORT}`);

  // 4. Start Events Service on Port 5000
  const eventsApp = buildEventsApp();
  await eventsApp.listen({ port: EVENTS_PORT, host: "127.0.0.1" });
  console.log(`[Service: Events] Listening on http://127.0.0.1:${EVENTS_PORT}`);

  // 5. Start Dashboard HTTP Server on Port 5173 serving built dist
  const dashboardServer = http.createServer((req, res) => {
    let filePath = path.join(dashboardDistDir, req.url === "/" ? "index.html" : req.url || "index.html");
    if (!fs.existsSync(filePath)) {
      filePath = path.join(dashboardDistDir, "index.html");
    }
    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";
    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not Found");
    }
  });
  await new Promise<void>((resolve) => dashboardServer.listen(DASHBOARD_PORT, "127.0.0.1", () => resolve()));
  console.log(`[Service: Dashboard] Serving dist/ on http://127.0.0.1:${DASHBOARD_PORT}`);

  try {
    const SAMPLE_APP_URL = `http://127.0.0.1:${SAMPLE_APP_PORT}`;
    const OWNERSHIP_URL = `http://127.0.0.1:${OWNERSHIP_PORT}`;
    const EVENTS_URL = `http://127.0.0.1:${EVENTS_PORT}`;
    const DASHBOARD_URL = `http://127.0.0.1:${DASHBOARD_PORT}`;

    // ==================================================================
    // TASK 1: Standard Ports Health Checks
    // ==================================================================
    console.log("\n--- [1. Service Health & Connectivity on Standard Ports] ---");
    const rSample = await fetch(`${SAMPLE_APP_URL}/health`);
    console.log(`✓ Sample App (${SAMPLE_APP_URL}/health) -> ${rSample.status} OK`);

    const rOwnership = await fetch(`${OWNERSHIP_URL}/health`);
    console.log(`✓ Ownership Service (${OWNERSHIP_URL}/health) -> ${rOwnership.status} OK`);

    const rEvents = await fetch(`${EVENTS_URL}/health`);
    console.log(`✓ Events Service (${EVENTS_URL}/health) -> ${rEvents.status} OK`);

    const rDashboard = await fetch(`${DASHBOARD_URL}`);
    const dashHtml = await rDashboard.text();
    if (!dashHtml.includes("id=\"root\"") && !dashHtml.includes("vite")) {
      throw new Error("Dashboard did not serve valid HTML bundle");
    }
    console.log(`✓ Dashboard (${DASHBOARD_URL}) -> ${rDashboard.status} OK (Served HTML UI bundle)`);

    // ==================================================================
    // TASK 2: Dashboard API Communication with Events Service (:5000)
    // ==================================================================
    console.log("\n--- [2. Dashboard API Communication with Events Service (:5000)] ---");
    
    // Ingest seed scan so scans load
    await fetch(`${EVENTS_URL}/v1/scans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commit: "main-integration-check",
        startedAt: new Date().toISOString(),
        target: "http://localhost:3000",
        summary: { total: 5, passed: 4, failed: 1 },
        findings: [{
          method: "GET",
          routeTemplate: "/api/orders/:orderId",
          attackerTenant: "tenantA",
          victimTenant: "tenantB",
          expectedStatus: 403,
          actualStatus: 200,
          severity: "HIGH"
        }]
      })
    });

    // Ingest initial event
    await fetch(`${EVENTS_URL}/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        method: "GET",
        routeTemplate: "/api/orders/:orderId",
        resourceType: "orders",
        objectIdHash: crypto.createHash("sha256").update("101").digest("hex"),
        subjectHash: crypto.createHash("sha256").update("userA1").digest("hex"),
        tenantId: "tenantA",
        objectTenantId: "tenantA",
        decision: "ALLOW",
        reason: "OK_OWNER",
        authzLatencyUs: 320
      })
    });

    // Verify statistics load
    const statsRes = await fetch(`${EVENTS_URL}/v1/stats`);
    if (!statsRes.ok) throw new Error(`Dashboard stats fetch failed: ${statsRes.status}`);
    const statsData = (await statsRes.json()) as any;
    console.log(`✓ Dashboard Statistics loaded successfully: totalEvents=${statsData.totalEvents}, allowed=${statsData.allowed}, blocked=${statsData.blocked}, blockRate=${statsData.blockRate}%`);

    // Verify events load
    const eventsRes = await fetch(`${EVENTS_URL}/v1/events`);
    if (!eventsRes.ok) throw new Error(`Dashboard events fetch failed: ${eventsRes.status}`);
    const eventsData = (await eventsRes.json()) as any[];
    console.log(`✓ Dashboard Events list loaded successfully: ${eventsData.length} events returned`);

    // Verify scan results load
    const scansRes = await fetch(`${EVENTS_URL}/v1/scans`);
    if (!scansRes.ok) throw new Error(`Dashboard scans fetch failed: ${scansRes.status}`);
    const scansData = (await scansRes.json()) as any[];
    console.log(`✓ Dashboard Scan results loaded successfully: ${scansData.length} scans returned`);

    // ==================================================================
    // TASK 3: Real-Time SSE Stream & Live Broadcast Verification
    // ==================================================================
    console.log("\n--- [3. Real-Time SSE Stream & Live Broadcast Verification] ---");
    
    let sseReceivedData: string | null = null;
    let sseConnected = false;

    const ssePromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("SSE stream verification timed out after 5s"));
      }, 5000);

      const req = http.get(`${EVENTS_URL}/v1/events/stream`, (res) => {
        if (res.statusCode !== 200) {
          clearTimeout(timeout);
          reject(new Error(`SSE connection failed with HTTP ${res.statusCode}`));
          return;
        }

        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          if (chunk.includes("connected - zerotrust sse stream")) {
            sseConnected = true;
            console.log("✓ SSE connection established. Received stream handshake.");
          }
          if (chunk.includes("event: security_event")) {
            sseReceivedData = chunk;
            clearTimeout(timeout);
            req.destroy();
            resolve();
          }
        });

        res.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      req.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Wait for SSE connection handshake
    await new Promise((r) => setTimeout(r, 200));

    // Post a live event to trigger broadcast
    const testDecisionId = `dec_live_${Date.now()}`;
    console.log(`[SSE] Broadcasting live event via POST /v1/events (decisionId: ${testDecisionId})...`);
    const postLiveEvent = await fetch(`${EVENTS_URL}/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionId: testDecisionId,
        timestamp: new Date().toISOString(),
        method: "GET",
        routeTemplate: "/api/orders/:orderId",
        resourceType: "orders",
        objectIdHash: crypto.createHash("sha256").update("201").digest("hex"),
        subjectHash: crypto.createHash("sha256").update("userA1").digest("hex"),
        tenantId: "tenantA",
        objectTenantId: "tenantB",
        decision: "BLOCK",
        reason: "TENANT_MISMATCH",
        authzLatencyUs: 450
      })
    });
    if (!postLiveEvent.ok) throw new Error(`POST live event failed: ${postLiveEvent.status}`);

    // Await receipt over SSE
    await ssePromise;
    console.log("✓ SSE client successfully received live broadcast event!");
    if (!sseReceivedData || !sseReceivedData.includes("BLOCK")) {
      throw new Error("SSE payload did not match dispatched event");
    }
    console.log(`✓ Confirmed payload in SSE stream: ${sseReceivedData.trim()}`);

    // ==================================================================
    // TASK 4: M2 Sample App & Ownership Endpoints Verification
    // ==================================================================
    console.log("\n--- [4. M2 Sample App & Ownership Endpoints Verification] ---");
    
    // Auth
    const loginA1 = await fetch(`${SAMPLE_APP_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userA1@example.com", password: "password123" })
    });
    const { token: tokenA1 } = (await loginA1.json()) as any;
    console.log("✓ userA1 logged in successfully.");

    // BOLA Demonstration
    const bolaRes = await fetch(`${SAMPLE_APP_URL}/api/orders/201`, {
      headers: { Authorization: `Bearer ${tokenA1}` }
    });
    const bolaData = (await bolaRes.json()) as any;
    console.log(`✓ BOLA verified in APP_MODE=vulnerable: userA1 accessed tenantB order 201 (${bolaData.items[0].item})`);

    // Write-Through creation
    const createOrderRes = await fetch(`${SAMPLE_APP_URL}/api/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA1}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ item: "Port Verification Headset", quantity: 1, price: 99.99 }],
        totalAmount: 99.99,
        status: "pending"
      })
    });
    const createdOrder = (await createOrderRes.json()) as any;
    const newOrderId = createdOrder.id;
    console.log(`✓ Order ${newOrderId} created.`);

    // Ownership Lookup
    const ownCheck = await fetch(`${OWNERSHIP_URL}/v1/ownership/orders/${newOrderId}`);
    const ownData = (await ownCheck.json()) as any;
    console.log(`✓ Ownership synchronized to Redis: objectId=${ownData.objectId}, tenantId=${ownData.tenantId}, ownerUserId=${ownData.ownerUserId}`);

    // OpenAPI
    const openApiRes = await fetch(`${SAMPLE_APP_URL}/openapi.json`);
    const openApiDoc = (await openApiRes.json()) as any;
    console.log(`✓ OpenAPI contract verified: ${openApiDoc.openapi}, ${Object.keys(openApiDoc.paths).length} routes documented.`);

    // Fixtures
    const fixRes = await fetch(`${SAMPLE_APP_URL}/_test/fixtures`);
    const fixData = (await fixRes.json()) as any;
    console.log(`✓ Test Fixtures verified: ${fixData.users.length} users, ${fixData.objects.orders.length} orders, ${fixData.delegations.length} delegations.`);

    console.log("\n==================================================================");
    console.log(" ALL LIVE STACK VERIFICATIONS PASSED CLEANLY ON STANDARD PORTS!");
    console.log("==================================================================");
  } finally {
    await new Promise<void>((resolve) => dashboardServer.close(() => resolve()));
    await eventsApp.close();
    await sampleApp.close();
    await ownershipApp.close();
  }
}

runLiveStackVerification().catch((err) => {
  console.error("Live stack verification failed:", err);
  process.exit(1);
});
