import { EventQueryFilters, SecurityEvent } from '../models/event.js';
export interface IEventStore {
    save(event: SecurityEvent): Promise<SecurityEvent>;
    findById(decisionId: string): Promise<SecurityEvent | null>;
    query(filters?: EventQueryFilters): Promise<SecurityEvent[]>;
    getAll(): Promise<SecurityEvent[]>;
    count(): Promise<number>;
    clear(): Promise<void>;
}
export declare class InMemoryEventStore implements IEventStore {
    private events;
    private maxCapacity;
    constructor(maxCapacity?: number);
    save(event: SecurityEvent): Promise<SecurityEvent>;
    findById(decisionId: string): Promise<SecurityEvent | null>;
    query(filters?: EventQueryFilters): Promise<SecurityEvent[]>;
    getAll(): Promise<SecurityEvent[]>;
    count(): Promise<number>;
    clear(): Promise<void>;
}
export declare const eventStore: InMemoryEventStore;
