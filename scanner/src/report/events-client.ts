import { ApiClient } from "../client/api-client.js";
import type { ScanReport } from "./report-builder.js";

export interface EventsScanResponse {
  scanId?: string | undefined;
  id?: string | undefined;
  status?: string | undefined;
  [key: string]: unknown;
}

export async function submitScanReport(
  reportUrl: string,
  report: ScanReport,
  client: ApiClient
): Promise<EventsScanResponse> {
  const url = `${reportUrl.replace(/\/$/, "")}/v1/scans`;

  const total = report.summary.totalProbes;
  const failed = report.summary.totalFindings;
  const passed = Math.max(0, total - failed);

  const findings = report.findings.map((f) => ({
    method: f.method,
    routeTemplate: f.path || f.actualUrl,
    attackerTenant: f.userTenant || "tenantA",
    victimTenant: f.objectTenant || "tenantB",
    expectedStatus: f.expectedAuthorizationBehavior === "deny" ? 403 : 200,
    actualStatus: f.httpStatus || 200,
    severity: f.severity,
    findingId: f.findingId,
    title: f.title,
    description: f.description,
    authenticatedUser: f.authenticatedUser,
  }));

  const payload = {
    commit: process.env.GITHUB_SHA || process.env.COMMIT_HASH || "m3-scanner-commit",
    startedAt: report.metadata.startedAt,
    target: report.metadata.targetUrl,
    summary: {
      total,
      passed,
      failed,
      status: report.summary.status,
      totalProbes: total,
      totalFindings: failed,
      highFindings: report.summary.highFindings,
      mediumFindings: report.summary.mediumFindings,
      lowFindings: report.summary.lowFindings,
    },
    findings,
    metadata: report.metadata,
  };

  const response = await client.post<EventsScanResponse>(url, payload);

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Failed to submit scan report. HTTP status: ${response.status}`
    );
  }

  return response.data;
}
