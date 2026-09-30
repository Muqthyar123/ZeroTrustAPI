import { EventQueryFilters, SecurityEvent } from '../models/event.js';

export interface IEventStore {
  save(event: SecurityEvent): Promise<SecurityEvent>;
  findById(decisionId: string): Promise<SecurityEvent | null>;
  query(filters?: EventQueryFilters): Promise<SecurityEvent[]>;
  getAll(): Promise<SecurityEvent[]>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

export class InMemoryEventStore implements IEventStore {
  private events: SecurityEvent[] = [];
  private maxCapacity: number;

  constructor(maxCapacity = 10000) {
    this.maxCapacity = maxCapacity;
  }

  async save(event: SecurityEvent): Promise<SecurityEvent> {
    this.events.unshift(event); // newest first
    if (this.events.length > this.maxCapacity) {
      this.events.pop();
    }
    return event;
  }

  async findById(decisionId: string): Promise<SecurityEvent | null> {
    const found = this.events.find((e) => e.decisionId === decisionId);
    return found ? { ...found } : null;
  }

  async query(filters: EventQueryFilters = {}): Promise<SecurityEvent[]> {
    let result = [...this.events];

    if (filters.decision) {
      result = result.filter((e) => e.decision === filters.decision);
    }

    if (filters.tenant) {
      result = result.filter(
        (e) => e.tenantId === filters.tenant || e.objectTenantId === filters.tenant
      );
    }

    const limit = filters.limit ?? 50;
    return result.slice(0, limit);
  }

  async getAll(): Promise<SecurityEvent[]> {
    return [...this.events];
  }

  async count(): Promise<number> {
    return this.events.length;
  }

  async clear(): Promise<void> {
    this.events = [];
  }
}

export const eventStore = new InMemoryEventStore();
