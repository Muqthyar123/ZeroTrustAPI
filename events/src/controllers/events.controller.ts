import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateEventSchema, EventQuerySchema } from '../validators/event.validator.js';
import { EventService, eventService } from '../services/event.service.js';
import { SSEService, sseService } from '../services/sse.service.js';
import { randomUUID } from 'node:crypto';

export class EventsController {
  constructor(
    private events: EventService = eventService,
    private sse: SSEService = sseService
  ) {}

  public postEvent = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateEventSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid event payload structure',
        details: parseResult.error.format()
      });
    }

    try {
      const saved = await this.events.recordEvent(request.body as Record<string, any>);
      return reply.status(201).send(saved);
    } catch (err: any) {
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

  public getEvents = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = EventQuerySchema.safeParse(request.query);
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

  public getEventById = async (
    request: FastifyRequest<{ Params: { decisionId: string } }>,
    reply: FastifyReply
  ) => {
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

  public streamEvents = async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = `client_${randomUUID()}`;
    // Fastify raw response for SSE
    this.sse.addClient(clientId, reply.raw);
  };
}

export const eventsController = new EventsController();
