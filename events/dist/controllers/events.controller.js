"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsController = exports.EventsController = void 0;
const event_validator_js_1 = require("../validators/event.validator.js");
const event_service_js_1 = require("../services/event.service.js");
const sse_service_js_1 = require("../services/sse.service.js");
const node_crypto_1 = require("node:crypto");
class EventsController {
    events;
    sse;
    constructor(events = event_service_js_1.eventService, sse = sse_service_js_1.sseService) {
        this.events = events;
        this.sse = sse;
    }
    postEvent = async (request, reply) => {
        const parseResult = event_validator_js_1.CreateEventSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: 'Invalid event payload structure',
                details: parseResult.error.format()
            });
        }
        try {
            const saved = await this.events.recordEvent(request.body);
            return reply.status(201).send(saved);
        }
        catch (err) {
            if (err.message && err.message.startsWith('Privacy Violation')) {
                return reply.status(422).send({
                    error: 'Unprocessable Entity',
                    message: err.message
                });
            }
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: err.message || 'Failed to process event'
            });
        }
    };
    getEvents = async (request, reply) => {
        const parseResult = event_validator_js_1.EventQuerySchema.safeParse(request.query);
        if (!parseResult.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: 'Invalid query parameters',
                details: parseResult.error.format()
            });
        }
        const events = await this.events.queryEvents(parseResult.data);
        return reply.status(200).send(events);
    };
    getEventById = async (request, reply) => {
        const { decisionId } = request.params;
        const event = await this.events.getEventById(decisionId);
        if (!event) {
            return reply.status(404).send({
                error: 'Not Found',
                message: `Decision event with ID '${decisionId}' not found`
            });
        }
        return reply.status(200).send(event);
    };
    streamEvents = async (request, reply) => {
        const clientId = `client_${(0, node_crypto_1.randomUUID)()}`;
        // Fastify raw response for SSE
        this.sse.addClient(clientId, reply.raw);
    };
}
exports.EventsController = EventsController;
exports.eventsController = new EventsController();
