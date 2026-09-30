import { FastifyInstance } from 'fastify';
import { statsController } from '../controllers/stats.controller.js';

export async function statsRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/stats', statsController.getStats);
}
