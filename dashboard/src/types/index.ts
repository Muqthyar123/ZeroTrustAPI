export type DecisionType = 'ALLOW' | 'BLOCK';

export type DecisionReason =
  | 'OK_OWNER'
  | 'OK_TENANT_SCOPE'
  | 'OK_DELEGATION'
  | 'TENANT_MISMATCH'
  | 'NOT_OWNER'
  | 'NO_SCOPE'
  | 'UNKNOWN_OBJECT'
  | 'INVALID_TOKEN'
  | 'UNPROTECTED_ROUTE';

export interface SecurityEvent {
  decisionId: string;
  timestamp: string;
  method: string;
  routeTemplate: string;
  resourceType: string;
  objectIdHash: string;
  subjectHash: string;
  tenantId: string;
  objectTenantId: string;
  decision: DecisionType;
  reason: DecisionReason;
  authzLatencyUs: number;
}

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

export interface ActivityPoint {
  timestamp: string;
  allowed: number;
  blocked: number;
}

export interface SecurityStats {
  totalEvents: number;
  allowed: number;
  blocked: number;
  blockRate: number;
  eventsByReason: Record<string, number>;
  eventsByTenant: Record<string, number>;
  avgAuthzLatencyUs: number;
  recentActivity: ActivityPoint[];
}

export const REASON_DESCRIPTIONS: Record<DecisionReason, string> = {
  OK_OWNER: 'Access allowed: The authenticated subject is the verified owner of the resource.',
  OK_TENANT_SCOPE: 'Access allowed: The resource belongs to the subject\'s tenant and meets scope criteria.',
  OK_DELEGATION: 'Access allowed: Valid cross-tenant delegation or consent token verified.',
  TENANT_MISMATCH: 'Access blocked: Cross-tenant isolation breach (BOLA/IDOR attempt). Target object belongs to a different tenant.',
  NOT_OWNER: 'Access blocked: Subject is not the owner or authorized delegator for this resource.',
  NO_SCOPE: 'Access blocked: Principal lacks the necessary role or scope permission for this endpoint action.',
  UNKNOWN_OBJECT: 'Access blocked: Requested object cannot be found or is not registered in the ownership registry.',
  INVALID_TOKEN: 'Access blocked: Invalid, expired, or malformed authentication credentials.',
  UNPROTECTED_ROUTE: 'Request detected on unprotected route template.'
};
