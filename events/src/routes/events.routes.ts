import { FastifyInstance } from 'fastify';
import { eventsController } from '../controllers/events.controller.js';

export async function eventsRoutes(fastify: FastifyInstance) {
  fastify.post('/v1/events', eventsController.postEvent);
  fastify.get('/v1/events', eventsController.getEvents);
  fastify.get('/v1/events/stream', eventsController.streamEvents);
  fastify.get('/v1/events/:decisionId', eventsController.getEventById);
}
