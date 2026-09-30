import type { ScanReport } from "./report-builder.js";

export function serializeReport(report: ScanReport): string {
  return JSON.stringify(report, null, 2);
}

export function parseReport(json: string): ScanReport {
  return JSON.parse(json) as ScanReport;
}
