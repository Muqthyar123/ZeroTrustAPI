import type { ProbeResult } from "../probes/types.js";
import type { SecurityFinding } from "../analyzer/response-analyzer.js";

export interface ScanMetadata {
  openapiUrl: string;
  targetUrl: string;
  scannerVersion: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface ScanSummary {
  totalProbes: number;
  totalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  status: "PASS" | "FAIL";
}

export interface SanitizedFinding {
  findingId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  method: string;
  path: string;
  actualUrl: string;
  testType: string;
  authenticatedUser: string;
  expectedAuthorizationBehavior: "allow" | "deny";
  httpStatus: number;
  objectId?: string | undefined;
  objectOwner?: string | undefined;
  objectTenant?: string | undefined;
  userTenant?: string | undefined;
  accessAllowed: boolean;
}

export interface ScanReport {
  metadata: ScanMetadata;
  summary: ScanSummary;
  findings: SanitizedFinding[];
}

export interface BuildReportOptions {
  openapiUrl: string;
  targetUrl: string;
  probeResults: ProbeResult[];
  findings: SecurityFinding[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  scannerVersion?: string | undefined;
}

export function buildScanReport(options: BuildReportOptions): ScanReport {
  const highFindings = options.findings.filter((f) => f.severity === "HIGH").length;
  const mediumFindings = options.findings.filter((f) => f.severity === "MEDIUM").length;
  const lowFindings = options.findings.filter((f) => f.severity === "LOW").length;

  const totalFindings = options.findings.length;
  const status = totalFindings === 0 ? "PASS" : "FAIL";

  const sanitizedFindings: SanitizedFinding[] = options.findings.map((f) => ({
    findingId: f.findingId,
    severity: f.severity,
    title: f.title,
    description: f.description,
    method: f.method,
    path: f.path,
    actualUrl: f.actualUrl,
    testType: f.testType,
    authenticatedUser: f.authenticatedUser,
    expectedAuthorizationBehavior: f.expectedAuthorizationBehavior,
    httpStatus: f.httpStatus,
    objectId: f.objectId,
    objectOwner: f.objectOwner,
    objectTenant: f.objectTenant,
    userTenant: f.userTenant,
    accessAllowed: f.accessAllowed,
  }));

  return {
    metadata: {
      openapiUrl: options.openapiUrl,
      targetUrl: options.targetUrl,
      scannerVersion: options.scannerVersion ?? "1.0.0",
      startedAt: options.startedAt,
      completedAt: options.completedAt,
      durationMs: options.durationMs,
    },
    summary: {
      totalProbes: options.probeResults.length,
      totalFindings,
      highFindings,
      mediumFindings,
      lowFindings,
      status,
    },
    findings: sanitizedFindings,
  };
}
