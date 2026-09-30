import { describe, it, expect, afterEach } from "vitest";
import { execFile } from "node:child_process";
import path from "node:path";
import { startMockSampleApp, type MockSampleAppServer } from "./mock-sample-app.js";
import { startMockEventsService, type MockEventsServer } from "./mock-events-service.js";

function runScannerCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const cliPath = path.resolve(process.cwd(), "dist", "cli.js");

    execFile("node", [cliPath, ...args], { cwd: process.cwd() }, (error, stdout, stderr) => {
      const exitCode = error && typeof error.code === "number" ? error.code : 0;
      resolve({ exitCode, stdout, stderr });
    });
  });
}

describe("Scanner End-to-End (E2E) Integration Tests", () => {
  let sampleApp: MockSampleAppServer | null = null;
  let eventsService: MockEventsServer | null = null;

  afterEach(async () => {
    if (sampleApp) {
      await sampleApp.close();
      sampleApp = null;
    }
    if (eventsService) {
      await eventsService.close();
      eventsService = null;
    }
  });

  it("1. Vulnerable Application: Scanner detects BOLA findings, produces HIGH severity, posts report, exits with 1", async () => {
    sampleApp = await startMockSampleApp("vulnerable");
    eventsService = await startMockEventsService();

    const args = [
      "scan",
      "--openapi",
      `${sampleApp.url}/openapi.json`,
      "--fixtures",
      `${sampleApp.url}/_test/fixtures`,
      "--target",
      sampleApp.url,
      "--report",
      eventsService.url,
    ];

    const result = await runScannerCli(args);

    // Scanner exit code must be 1 for vulnerable target
    expect(result.exitCode).toBe(1);

    // Verify Events Service received report
    expect(eventsService.capturedReports).toHaveLength(1);
    const report = eventsService.capturedReports[0];

    expect(report?.summary.status).toBe("FAIL");
    expect(report?.summary.totalFindings).toBeGreaterThan(0);
    expect(report?.summary.highFindings).toBeGreaterThan(0);

    // Verify output message
    expect(result.stdout).toContain("Scan report submitted successfully.");
  });

  it("2. Secure Application: Scanner finds zero vulnerabilities, posts report, exits with 0", async () => {
    sampleApp = await startMockSampleApp("secure");
    eventsService = await startMockEventsService();

    const args = [
      "scan",
      "--openapi",
      `${sampleApp.url}/openapi.json`,
      "--fixtures",
      `${sampleApp.url}/_test/fixtures`,
      "--target",
      sampleApp.url,
      "--report",
      eventsService.url,
    ];

    const result = await runScannerCli(args);

    // Scanner exit code must be 0 for secure target
    expect(result.exitCode).toBe(0);



    // Verify Events Service received report
    expect(eventsService.capturedReports).toHaveLength(1);
    const report = eventsService.capturedReports[0];

    expect(report?.summary.status).toBe("PASS");
    expect(report?.summary.totalFindings).toBe(0);
    expect(report?.summary.highFindings).toBe(0);
    expect(report?.summary.mediumFindings).toBe(0);

    expect(result.stdout).toContain("Scan report submitted successfully.");
  });

  it("3. Report Sanitization: Event payload contains no raw passwords or JWT tokens", async () => {
    sampleApp = await startMockSampleApp("vulnerable");
    eventsService = await startMockEventsService();

    const args = [
      "scan",
      "--openapi",
      `${sampleApp.url}/openapi.json`,
      "--fixtures",
      `${sampleApp.url}/_test/fixtures`,
      "--target",
      sampleApp.url,
      "--report",
      eventsService.url,
    ];

    await runScannerCli(args);

    expect(eventsService.capturedReports).toHaveLength(1);
    const reportJson = JSON.stringify(eventsService.capturedReports[0]);

    // Must not leak passwords or JWT tokens
    expect(reportJson).not.toContain("passA1");
    expect(reportJson).not.toContain("passA2");
    expect(reportJson).not.toContain("passB1");
    expect(reportJson).not.toContain("mocksignature");
    expect(reportJson).not.toContain("Bearer");
  });

  it("4. Events Failure: Scanner returns failure exit code 1 when Events URL is unreachable", async () => {
    sampleApp = await startMockSampleApp("vulnerable");
    const offlineEventsUrl = "http://127.0.0.1:59999";

    const args = [
      "scan",
      "--openapi",
      `${sampleApp.url}/openapi.json`,
      "--fixtures",
      `${sampleApp.url}/_test/fixtures`,
      "--target",
      sampleApp.url,
      "--report",
      offlineEventsUrl,
    ];

    const result = await runScannerCli(args);

    expect(result.exitCode).toBe(1);
    expect(result.stderr + result.stdout).toContain("Failed to submit scan report.");
  });
});
