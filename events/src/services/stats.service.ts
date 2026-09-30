import { ActivityPoint, SecurityStats } from '../models/stats.js';
import { IEventStore, eventStore } from '../storage/event.store.js';

export class StatsService {
  constructor(private store: IEventStore = eventStore) {}

  public async getStats(): Promise<SecurityStats> {
    const events = await this.store.getAll();
    const totalEvents = events.length;

    if (totalEvents === 0) {
      return {
        totalEvents: 0,
        allowed: 0,
        blocked: 0,
        blockRate: 0,
        eventsByReason: {},
        eventsByTenant: {},
        avgAuthzLatencyUs: 0,
        recentActivity: []
      };
    }

    let allowed = 0;
    let blocked = 0;
    let totalLatencyUs = 0;
    const eventsByReason: Record<string, number> = {};
    const eventsByTenant: Record<string, number> = {};

    for (const event of events) {
      if (event.decision === 'ALLOW') {
        allowed++;
      } else if (event.decision === 'BLOCK') {
        blocked++;
      }

      totalLatencyUs += event.authzLatencyUs || 0;

      // Group by reason
      eventsByReason[event.reason] = (eventsByReason[event.reason] || 0) + 1;

      // Group by tenant
      eventsByTenant[event.tenantId] = (eventsByTenant[event.tenantId] || 0) + 1;
    }

    const blockRate = Number(((blocked / totalEvents) * 100).toFixed(2));
    const avgAuthzLatencyUs = Number((totalLatencyUs / totalEvents).toFixed(1));

    // Calculate recent activity: group into time buckets (last 10 buckets chronologically)
    const recentActivity = this.computeRecentActivity(events);

    return {
      totalEvents,
      allowed,
      blocked,
      blockRate,
      eventsByReason,
      eventsByTenant,
      avgAuthzLatencyUs,
      recentActivity
    };
  }

  private computeRecentActivity(events: Array<{ timestamp: string; decision: string }>): ActivityPoint[] {
    // Events are in reverse chronological order (newest first). Let's take up to last 100 events and group by minute
    const chronEvents = [...events].reverse();
    const groups = new Map<string, { allowed: number; blocked: number }>();

    for (const e of chronEvents) {
      try {
        const d = new Date(e.timestamp);
        // Format to HH:MM:SS or HH:MM
        const timeKey = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (!groups.has(timeKey)) {
          groups.set(timeKey, { allowed: 0, blocked: 0 });
        }
        const bucket = groups.get(timeKey)!;
        if (e.decision === 'ALLOW') {
          bucket.allowed++;
        } else {
          bucket.blocked++;
        }
      } catch {
        // Skip invalid timestamps
      }
    }

    const activity: ActivityPoint[] = [];
    for (const [timestamp, counts] of groups.entries()) {
      activity.push({
        timestamp,
        allowed: counts.allowed,
        blocked: counts.blocked
      });
    }

    // Return the latest 15 time buckets
    return activity.slice(-15);
  }
}

export const statsService = new StatsService();
