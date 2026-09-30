import { ScanResult } from '../models/scan.js';
import { IScanStore, scanStore } from '../storage/scan.store.js';
import { generateScanId } from '../utils/id.js';

export class ScanService {
  constructor(private store: IScanStore = scanStore) {}

  public async recordScan(rawPayload: Record<string, any>): Promise<ScanResult> {
    const scan: ScanResult = {
      scanId: rawPayload.scanId || generateScanId(),
      commit: rawPayload.commit || 'unknown',
      startedAt: rawPayload.startedAt || new Date().toISOString(),
      target: rawPayload.target || 'sample-app',
      summary: {
        total: Number(rawPayload.summary?.total) || 0,
        passed: Number(rawPayload.summary?.passed) || 0,
        failed: Number(rawPayload.summary?.failed) || 0
      },
      findings: Array.isArray(rawPayload.findings)
        ? rawPayload.findings.map((f: any) => ({
            method: String(f.method).toUpperCase(),
            routeTemplate: String(f.routeTemplate),
            attackerTenant: String(f.attackerTenant),
            victimTenant: String(f.victimTenant),
            expectedStatus: Number(f.expectedStatus),
            actualStatus: Number(f.actualStatus),
            severity: f.severity
          }))
        : []
    };

    return this.store.save(scan);
  }

  public async getScanById(scanId: string): Promise<ScanResult | null> {
    return this.store.findById(scanId);
  }

  public async getAllScans(): Promise<ScanResult[]> {
    return this.store.getAll();
  }

  public async getLatestScan(): Promise<ScanResult | null> {
    return this.store.getLatest();
  }
}

export const scanService = new ScanService();
