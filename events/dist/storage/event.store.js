"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventStore = exports.InMemoryEventStore = void 0;
class InMemoryEventStore {
    events = [];
    maxCapacity;
    constructor(maxCapacity = 10000) {
        this.maxCapacity = maxCapacity;
    }
    async save(event) {
        this.events.unshift(event); // newest first
        if (this.events.length > this.maxCapacity) {
            this.events.pop();
        }
        return event;
    }
    async findById(decisionId) {
        const found = this.events.find((e) => e.decisionId === decisionId);
        return found ? { ...found } : null;
    }
    async query(filters = {}) {
        let result = [...this.events];
        if (filters.decision) {
            result = result.filter((e) => e.decision === filters.decision);
        }
        if (filters.tenant) {
            result = result.filter((e) => e.tenantId === filters.tenant || e.objectTenantId === filters.tenant);
        }
        const limit = filters.limit ?? 50;
        return result.slice(0, limit);
    }
    async getAll() {
        return [...this.events];
    }
    async count() {
        return this.events.length;
    }
    async clear() {
        this.events = [];
    }
}
exports.InMemoryEventStore = InMemoryEventStore;
exports.eventStore = new InMemoryEventStore();
