"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventService = exports.EventService = void 0;
const event_store_js_1 = require("../storage/event.store.js");
const sse_service_js_1 = require("./sse.service.js");
const id_js_1 = require("../utils/id.js");
const privacy_js_1 = require("../utils/privacy.js");
class EventService {
    store;
    sse;
    constructor(store = event_store_js_1.eventStore, sse = sse_service_js_1.sseService) {
        this.store = store;
        this.sse = sse;
    }
    async recordEvent(rawPayload) {
        // 1. Validate privacy invariants
        const privacyCheck = (0, privacy_js_1.validatePayloadPrivacy)(rawPayload);
        if (!privacyCheck.valid) {
            throw new Error(privacyCheck.reason);
        }
        // 2. Build canonical SecurityEvent
        const event = {
            decisionId: rawPayload.decisionId || (0, id_js_1.generateDecisionId)(),
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
    async getEventById(decisionId) {
        return this.store.findById(decisionId);
    }
    async queryEvents(filters) {
        return this.store.query(filters);
    }
    async getAllEvents() {
        return this.store.getAll();
    }
}
exports.EventService = EventService;
exports.eventService = new EventService();
