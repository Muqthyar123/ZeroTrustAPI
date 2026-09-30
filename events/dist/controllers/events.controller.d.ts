import { FastifyRequest, FastifyReply } from 'fastify';
import { EventService } from '../services/event.service.js';
import { SSEService } from '../services/sse.service.js';
export declare class EventsController {
    private events;
    private sse;
    constructor(events?: EventService, sse?: SSEService);
    postEvent: (request: FastifyRequest, reply: FastifyReply) => Promise<never>;
    getEvents: (request: FastifyRequest, reply: FastifyReply) => Promise<never>;
    getEventById: (request: FastifyRequest<{
        Params: {
            decisionId: string;
        };
    }>, reply: FastifyReply) => Promise<never>;
    streamEvents: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}
export declare const eventsController: EventsController;
