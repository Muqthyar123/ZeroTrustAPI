import type { ProbeResult } from "../probes/types.js";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export function calculateSeverity(probe: ProbeResult): Severity {
  // Determine if cross-tenant or same-tenant
  const isCrossTenant =
    probe.testType === "cross-tenant" ||
    (probe.objectTenant !== undefined &&
      probe.userTenant !== undefined &&
      probe.objectTenant !== "" &&
      probe.userTenant !== "" &&
      probe.objectTenant !== probe.userTenant);

  let baseSeverity: Severity = isCrossTenant ? "HIGH" : "MEDIUM";

  // Check if write or delete operation (POST, PUT, PATCH, DELETE)
  const isWriteOrDelete = ["POST", "PUT", "PATCH", "DELETE"].includes(
    probe.method.toUpperCase()
  );

  if (isWriteOrDelete) {
    if (baseSeverity === "MEDIUM") {
      baseSeverity = "HIGH";
    }
    // HIGH remains HIGH
  }

  return baseSeverity;
}
