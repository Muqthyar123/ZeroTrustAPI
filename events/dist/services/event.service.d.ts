import { EventQueryFilters, SecurityEvent } from '../models/event.js';
import { IEventStore } from '../storage/event.store.js';
import { SSEService } from './sse.service.js';
export declare class EventService {
    private store;
    private sse;
    constructor(store?: IEventStore, sse?: SSEService);
    recordEvent(rawPayload: Record<string, any>): Promise<SecurityEvent>;
    getEventById(decisionId: string): Promise<SecurityEvent | null>;
    queryEvents(filters: EventQueryFilters): Promise<SecurityEvent[]>;
    getAllEvents(): Promise<SecurityEvent[]>;
}
export declare const eventService: EventService;
