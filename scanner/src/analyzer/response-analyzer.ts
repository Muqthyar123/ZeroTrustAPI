import type { ProbeResult, TestType } from "../probes/types.js";
import { calculateSeverity, type Severity } from "./severity.js";

export type { Severity };

export interface SecurityFinding {
  findingId: string;
  severity: Severity;
  title: string;
  description: string;
  method: string;
  path: string;
  actualUrl: string;
  testType: TestType;
  authenticatedUser: string;
  expectedAuthorizationBehavior: "allow" | "deny";
  httpStatus: number;
  objectId?: string | undefined;
  objectOwner?: string | undefined;
  objectTenant?: string | undefined;
  userTenant?: string | undefined;
  accessAllowed: boolean;
}

export function analyzeProbeResults(probeResults: ProbeResult[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const probe of probeResults) {
    // Rule 4: Legitimate owner access must NOT be reported as a vulnerability.
    if (probe.expectedAuthorizationBehavior === "allow" || probe.testType === "own-object") {
      continue;
    }

    // Rule 5: Access that is correctly denied with HTTP 403, 404, or non-2xx must NOT be reported.
    if (!probe.accessAllowed || probe.httpStatus < 200 || probe.httpStatus >= 300) {
      continue;
    }

    // Rule 6: Unauthorized successful access (2xx) is a finding
    const severity = calculateSeverity(probe);
    const sanitizedPath = probe.path.replace(/[^a-zA-Z0-9]/g, "_");
    const findingId = `FINDING-BOLA-${probe.testType.toUpperCase()}-${probe.method.toUpperCase()}-${sanitizedPath}-${probe.authenticatedUser}`;

    const title = `BOLA Vulnerability detected on ${probe.method} ${probe.path}`;
    const description = `User '${probe.authenticatedUser}' was granted unauthorized ${probe.method} access to resource '${probe.actualUrl}' (HTTP ${probe.httpStatus}).`;

    findings.push({
      findingId,
      severity,
      title,
      description,
      method: probe.method,
      path: probe.path,
      actualUrl: probe.actualUrl,
      testType: probe.testType,
      authenticatedUser: probe.authenticatedUser,
      expectedAuthorizationBehavior: probe.expectedAuthorizationBehavior,
      httpStatus: probe.httpStatus,
      objectId: probe.objectId,
      objectOwner: probe.objectOwner,
      objectTenant: probe.objectTenant,
      userTenant: probe.userTenant,
      accessAllowed: probe.accessAllowed,
    });
  }

  return findings;
}
