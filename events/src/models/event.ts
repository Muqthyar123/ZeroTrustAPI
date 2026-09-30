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

export interface EventQueryFilters {
  decision?: DecisionType;
  tenant?: string;
  limit?: number;
}
