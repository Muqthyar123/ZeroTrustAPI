import { EventQueryFilters, SecurityEvent } from '../models/event.js';
import { IEventStore, eventStore } from '../storage/event.store.js';
import { SSEService, sseService } from './sse.service.js';
import { generateDecisionId } from '../utils/id.js';
import { validatePayloadPrivacy } from '../utils/privacy.js';

export class EventService {
  constructor(
    private store: IEventStore = eventStore,
    private sse: SSEService = sseService
  ) {}

  public async recordEvent(rawPayload: Record<string, any>): Promise<SecurityEvent> {
    // 1. Validate privacy invariants
    const privacyCheck = validatePayloadPrivacy(rawPayload);
    if (!privacyCheck.valid) {
      throw new Error(privacyCheck.reason);
    }

    // 2. Build canonical SecurityEvent
    const event: SecurityEvent = {
      decisionId: rawPayload.decisionId || generateDecisionId(),
      timestamp: rawPayload.timestamp || new Date().toISOString(),
      method: String(rawPayload.method).toUpperCase(),
      routeTemplate: String(rawPayload.routeTemplate),
      resourceType: String(rawPayload.resourceType),
      objectIdHash: String(rawPayload.objectIdHash),
      subjectHash: String(rawPayload.subjectHash),
      tenantId: String(rawPayload.tenantId),
      objectTenantId: String(rawPayload.objectTenantId),
      decision: rawPayload.decision,
      reason: rawPayload.reason,
      authzLatencyUs: Number(rawPayload.authzLatencyUs) || 0
    };

    // 3. Save to store
    const saved = await this.store.save(event);

    // 4. Broadcast via SSE to connected listeners
    this.sse.broadcast(saved);

    return saved;
  }

  public async getEventById(decisionId: string): Promise<SecurityEvent | null> {
    return this.store.findById(decisionId);
  }

  public async queryEvents(filters: EventQueryFilters): Promise<SecurityEvent[]> {
    return this.store.query(filters);
  }

  public async getAllEvents(): Promise<SecurityEvent[]> {
    return this.store.getAll();
  }
}

export const eventService = new EventService();
