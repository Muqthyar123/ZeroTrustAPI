export interface ActivityPoint {
  timestamp: string;
  allowed: number;
  blocked: number;
}

export interface SecurityStats {
  totalEvents: number;
  allowed: number;
  blocked: number;
  blockRate: number; // percentage (0.0 to 100.0)
  eventsByReason: Record<string, number>;
  eventsByTenant: Record<string, number>;
  avgAuthzLatencyUs: number;
  recentActivity: ActivityPoint[];
}
