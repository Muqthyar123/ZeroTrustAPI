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

  const response = await client.post<EventsScanResponse>(url, report);

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Failed to submit scan report. HTTP status: ${response.status}`
    );
  }

  return response.data;
}
