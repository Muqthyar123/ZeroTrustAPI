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
