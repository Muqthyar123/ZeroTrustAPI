import { describe, it, expect } from "vitest";
import { buildScanReport } from "../src/report/report-builder";
import { serializeReport, parseReport } from "../src/report/json-report";
import { submitScanReport } from "../src/report/events-client";
import type { SecurityFinding } from "../src/analyzer/response-analyzer";
import type { ProbeResult } from "../src/probes/types";
import type { ApiClient } from "../src/client/api-client";

describe("Scan Report Builder & Events Client", () => {
  const baseOptions = {
    openapiUrl: "http://localhost:3000/openapi.json",
    targetUrl: "http://localhost:3000",
    startedAt: "2026-09-30T15:00:00.000Z",
    completedAt: "2026-09-30T15:00:05.000Z",
    durationMs: 5000,
  };

  const sampleProbe: ProbeResult = {
    method: "GET",
    path: "/api/documents/{id}",
    actualUrl: "http://localhost:3000/api/documents/doc-1",
    testType: "cross-tenant",
    authenticatedUser: "user1",
    expectedAuthorizationBehavior: "deny",
    httpStatus: 200,
    objectId: "doc-1",
    objectOwner: "user2",
    objectTenant: "tenant-2",
    userTenant: "tenant-1",
    accessAllowed: true,
  };

  it("1. Build a report with zero findings", () => {
    const report = buildScanReport({
      ...baseOptions,
      probeResults: [sampleProbe],
      findings: [],
    });

    expect(report.summary.totalProbes).toBe(1);
    expect(report.summary.totalFindings).toBe(0);
    expect(report.summary.status).toBe("PASS");
    expect(report.findings).toHaveLength(0);
  });

  it("2. Build a report with one HIGH finding", () => {
    const highFinding: SecurityFinding = {
      findingId: "FINDING-1",
      severity: "HIGH",
      title: "BOLA High",
      description: "High severity finding",
      method: "GET",
      path: "/api/documents/{id}",
      actualUrl: "http://localhost:3000/api/documents/doc-1",
      testType: "cross-tenant",
      authenticatedUser: "user1",
      expectedAuthorizationBehavior: "deny",
      httpStatus: 200,
      objectId: "doc-1",
      objectOwner: "user2",
      objectTenant: "tenant-2",
      userTenant: "tenant-1",
      accessAllowed: true,
    };

    const report = buildScanReport({
      ...baseOptions,
      probeResults: [sampleProbe],
      findings: [highFinding],
    });

    expect(report.summary.totalFindings).toBe(1);
    expect(report.summary.highFindings).toBe(1);
    expect(report.summary.mediumFindings).toBe(0);
    expect(report.summary.status).toBe("FAIL");
  });

  it("3. Build a report with one MEDIUM finding", () => {
    const mediumFinding: SecurityFinding = {
      findingId: "FINDING-2",
      severity: "MEDIUM",
      title: "BOLA Medium",
      description: "Medium severity finding",
      method: "GET",
      path: "/api/documents/{id}",
      actualUrl: "http://localhost:3000/api/documents/doc-1",
      testType: "same-tenant",
      authenticatedUser: "user1",
      expectedAuthorizationBehavior: "deny",
      httpStatus: 200,
      objectId: "doc-1",
      objectOwner: "user3",
      objectTenant: "tenant-1",
      userTenant: "tenant-1",
      accessAllowed: true,
    };

    const report = buildScanReport({
      ...baseOptions,
      probeResults: [sampleProbe],
      findings: [mediumFinding],
    });

    expect(report.summary.totalFindings).toBe(1);
    expect(report.summary.mediumFindings).toBe(1);
    expect(report.summary.highFindings).toBe(0);
    expect(report.summary.status).toBe("FAIL");
  });

  it("4. Verify summary counts", () => {
    const findings: SecurityFinding[] = [
      {
        findingId: "F1",
        severity: "HIGH",
        title: "T1",
        description: "D1",
        method: "GET",
        path: "/p1",
        actualUrl: "http://test/p1",
        testType: "cross-tenant",
        authenticatedUser: "u1",
        expectedAuthorizationBehavior: "deny",
        httpStatus: 200,
        accessAllowed: true,
      },
      {
        findingId: "F2",
        severity: "MEDIUM",
        title: "T2",
        description: "D2",
        method: "GET",
        path: "/p2",
        actualUrl: "http://test/p2",
        testType: "same-tenant",
        authenticatedUser: "u1",
        expectedAuthorizationBehavior: "deny",
        httpStatus: 200,
        accessAllowed: true,
      },
    ];

    const report = buildScanReport({
      ...baseOptions,
      probeResults: [sampleProbe, sampleProbe, sampleProbe],
      findings,
    });

    expect(report.summary.totalProbes).toBe(3);
    expect(report.summary.totalFindings).toBe(2);
    expect(report.summary.highFindings).toBe(1);
    expect(report.summary.mediumFindings).toBe(1);
    expect(report.summary.lowFindings).toBe(0);
    expect(report.summary.status).toBe("FAIL");
  });

  it("5. Verify JSON serialization produces valid JSON", () => {
    const report = buildScanReport({
      ...baseOptions,
      probeResults: [sampleProbe],
      findings: [],
    });

    const json = serializeReport(report);
    expect(typeof json).toBe("string");

    const parsed = parseReport(json);
    expect(parsed.metadata.openapiUrl).toBe(baseOptions.openapiUrl);
    expect(parsed.summary.status).toBe("PASS");
  });

  it("6. Verify sensitive values such as JWT tokens/passwords are not included", () => {
    const report = buildScanReport({
      ...baseOptions,
      probeResults: [sampleProbe],
      findings: [],
    });

    const json = serializeReport(report);
    expect(json).not.toContain("token");
    expect(json).not.toContain("password");
    expect(json).not.toContain("secret");
    expect(json).not.toContain("Authorization");
    expect(json).not.toContain("Bearer");
  });

  it("7. Test Events client behavior for successful POST", async () => {
    const mockClient = {
      post: async (url: string, body: unknown) => ({
        status: 201,
        data: { scanId: "scan-12345", status: "RECEIVED" },
        headers: new Headers(),
      }),
    } as unknown as ApiClient;

    const report = buildScanReport({
      ...baseOptions,
      probeResults: [sampleProbe],
      findings: [],
    });

    const response = await submitScanReport("http://events:4000", report, mockClient);
    expect(response.scanId).toBe("scan-12345");
  });

  it("8. Test Events client behavior for non-2xx response", async () => {
    const mockClient = {
      post: async (url: string, body: unknown) => ({
        status: 500,
        data: { error: "Internal Error" },
        headers: new Headers(),
      }),
    } as unknown as ApiClient;

    const report = buildScanReport({
      ...baseOptions,
      probeResults: [sampleProbe],
      findings: [],
    });

    await expect(submitScanReport("http://events:4000", report, mockClient)).rejects.toThrow(
      "Failed to submit scan report. HTTP status: 500"
    );
  });
});
