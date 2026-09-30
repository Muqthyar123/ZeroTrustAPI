export type SeverityType = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export interface Finding {
    method: string;
    routeTemplate: string;
    attackerTenant: string;
    victimTenant: string;
    expectedStatus: number;
    actualStatus: number;
    severity: SeverityType;
}
export interface ScanSummary {
    total: number;
    passed: number;
    failed: number;
}
export interface ScanResult {
    scanId: string;
    commit: string;
    startedAt: string;
    target: string;
    summary: ScanSummary;
    findings: Finding[];
}
