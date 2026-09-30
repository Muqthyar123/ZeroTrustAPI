import { buildOwnershipApp } from "../ownership/src/app.js";
import { createRedisMock } from "../ownership/src/redis/client.js";
import { seedOwnershipData } from "../ownership/src/seed/seedOwnership.js";
import { buildApp as buildSampleApp } from "../sample-app/src/app.js";
import { OwnershipClient } from "../sample-app/src/ownership/ownershipClient.js";
import { buildApp as buildEventsApp } from "../events/src/app.js";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function runScannerCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const cliPath = path.resolve(projectRoot, "scanner", "dist", "cli.js");

    execFile("node", [cliPath, ...args], { cwd: projectRoot }, (error, stdout, stderr) => {
      const exitCode = error && typeof error.code === "number" ? error.code : 0;
      resolve({ exitCode, stdout, stderr });
    });
  });
}

async function runM2M3M4IntegrationTest() {
  console.log("==================================================================");
  console.log(" ZeroTrustAPI - Full M2 (App) + M3 (Scanner) + M4 (Events) E2E");
  console.log("==================================================================");

  const SAMPLE_APP_PORT = 3000;
  const OWNERSHIP_PORT = 4000;
  const EVENTS_PORT = 5000;

  // 1. Initialize Redis & Seed Data
  const redis = createRedisMock();
  const seedResult = await seedOwnershipData(redis);
  console.log(`[Redis] Seeded ownership records (${seedResult.ownershipsSeeded}) and delegations (${seedResult.delegationsSeeded}).`);

  // 2. Start Ownership Service on Port 4000
  const ownershipApp = buildOwnershipApp({ redis, fastifyOpts: { logger: false } });
  await ownershipApp.listen({ port: OWNERSHIP_PORT, host: "127.0.0.1" });
  console.log(`[Service: Ownership] Listening on http://127.0.0.1:${OWNERSHIP_PORT}`);

  // 3. Start Events Service on Port 5000
  const eventsApp = buildEventsApp();
  await eventsApp.listen({ port: EVENTS_PORT, host: "127.0.0.1" });
  console.log(`[Service: Events] Listening on http://127.0.0.1:${EVENTS_PORT}`);

  const ownershipClient = new OwnershipClient({
    baseUrl: `http://127.0.0.1:${OWNERSHIP_PORT}`,
  });

  // ==================================================================
  // PART A: VULNERABLE MODE (APP_MODE=vulnerable)
  // ==================================================================
  console.log("\n==================================================================");
  console.log(" PART A: Testing Scanner against Sample App in VULNERABLE mode");
  console.log("==================================================================");
  
  process.env.APP_MODE = "vulnerable";
  let sampleApp = buildSampleApp({ fastifyOpts: { logger: false }, ownershipClient });
  await sampleApp.listen({ port: SAMPLE_APP_PORT, host: "127.0.0.1" });
  console.log(`[Service: Sample App] Listening in VULNERABLE mode on http://127.0.0.1:${SAMPLE_APP_PORT}`);

  try {
    const scannerArgs = [
      "scan",
      "--openapi", `http://localhost:${SAMPLE_APP_PORT}/openapi.json`,
      "--fixtures", `http://localhost:${SAMPLE_APP_PORT}/_test/fixtures`,
      "--target", `http://localhost:${SAMPLE_APP_PORT}`,
      "--report", `http://localhost:${EVENTS_PORT}`,
    ];

    console.log(`[Scanner] Executing: zerotrust ${scannerArgs.join(" ")}`);
    const vulnResult = await runScannerCli(scannerArgs);

    console.log("\n--- Scanner Output (Vulnerable Mode) ---");
    console.log(vulnResult.stdout);
    if (vulnResult.stderr) {
      console.error(vulnResult.stderr);
    }

    // Verify Exit Code is 1 for Vulnerable mode
    console.log(`[Verify] Vulnerable mode exit code: ${vulnResult.exitCode} (Expected: 1)`);
    if (vulnResult.exitCode !== 1) {
      throw new Error(`Expected scanner exit code 1 in vulnerable mode, got ${vulnResult.exitCode}`);
    }

    // Verify findings detected
    if (!vulnResult.stdout.includes("Status    : FAIL") || !vulnResult.stdout.includes("HIGH")) {
      throw new Error("Scanner failed to report expected HIGH severity BOLA findings in vulnerable mode");
    }
    console.log("✓ Scanner successfully detected cross-tenant BOLA vulnerability with HIGH severity.");

    // Verify report submission to M4 Events Service
    const scansRes = await fetch(`http://localhost:${EVENTS_PORT}/v1/scans`);
    if (!scansRes.ok) throw new Error(`Failed to fetch scans from Events service: ${scansRes.status}`);
    const scans = (await scansRes.json()) as any[];
    console.log(`✓ Queried M4 Events Service: found ${scans.length} stored scan report(s).`);

    const latestScan = scans[scans.length - 1];
    console.log(`✓ Latest scan summary: total=${latestScan.summary.total}, failed=${latestScan.summary.failed}, passed=${latestScan.summary.passed}`);
    console.log(`✓ Findings recorded in M4: ${latestScan.findings.length} findings`);
    
    // Privacy check on stored report
    const scanJson = JSON.stringify(latestScan);
    if (scanJson.includes("password123") || scanJson.includes("Bearer")) {
      throw new Error("Security Violation: Scan report leaked credentials or raw tokens!");
    }
    console.log("✓ Privacy verified: Stored scan report contains no raw passwords or JWT tokens.");
  } finally {
    await sampleApp.close();
  }

  // ==================================================================
  // PART B: SECURE MODE (APP_MODE=secure)
  // ==================================================================
  console.log("\n==================================================================");
  console.log(" PART B: Testing Scanner against Sample App in SECURE mode");
  console.log("==================================================================");

  process.env.APP_MODE = "secure";
  sampleApp = buildSampleApp({ fastifyOpts: { logger: false }, ownershipClient });
  await sampleApp.listen({ port: SAMPLE_APP_PORT, host: "127.0.0.1" });
  console.log(`[Service: Sample App] Listening in SECURE mode on http://127.0.0.1:${SAMPLE_APP_PORT}`);

  try {
    const scannerArgs = [
      "scan",
      "--openapi", `http://localhost:${SAMPLE_APP_PORT}/openapi.json`,
      "--fixtures", `http://localhost:${SAMPLE_APP_PORT}/_test/fixtures`,
      "--target", `http://localhost:${SAMPLE_APP_PORT}`,
      "--report", `http://localhost:${EVENTS_PORT}`,
    ];

    console.log(`[Scanner] Executing: zerotrust ${scannerArgs.join(" ")}`);
    const secureResult = await runScannerCli(scannerArgs);

    console.log("\n--- Scanner Output (Secure Mode) ---");
    console.log(secureResult.stdout);
    if (secureResult.stderr) {
      console.error(secureResult.stderr);
    }

    // Verify Exit Code is 0 for Secure mode
    console.log(`[Verify] Secure mode exit code: ${secureResult.exitCode} (Expected: 0)`);
    if (secureResult.exitCode !== 0) {
      throw new Error(`Expected scanner exit code 0 in secure mode, got ${secureResult.exitCode}`);
    }

    // Verify zero findings
    if (!secureResult.stdout.includes("Status    : PASS") || !secureResult.stdout.includes("Findings  : 0")) {
      throw new Error("Scanner reported unexpected findings in secure mode");
    }
    console.log("✓ Scanner reported 0 findings and PASS status for secure mode.");

    // Verify report submission to M4 Events Service
    const scansRes2 = await fetch(`http://localhost:${EVENTS_PORT}/v1/scans`);
    const scans2 = (await scansRes2.json()) as any[];
    const secureScan = scans2[scans2.length - 1];
    console.log(`✓ Secure scan stored in M4: total=${secureScan.summary.total}, failed=${secureScan.summary.failed}, passed=${secureScan.summary.passed}`);
  } finally {
    await sampleApp.close();
    await eventsApp.close();
    await ownershipApp.close();
  }

  console.log("\n==================================================================");
  console.log(" ALL REAL M2 + M3 + M4 INTEGRATION VERIFICATIONS PASSED!");
  console.log("==================================================================");
}

runM2M3M4IntegrationTest().catch((err) => {
  console.error("M2 + M3 + M4 integration verification failed:", err);
  process.exit(1);
});
