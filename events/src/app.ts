import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { eventsRoutes } from './routes/events.routes.js';
import { scansRoutes } from './routes/scans.routes.js';
import { statsRoutes } from './routes/stats.routes.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: false,
    disableRequestLogging: true
  });

  // Enable CORS for Dashboard on :5173 or other origins
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  });

  // Health check endpoint
  app.get('/health', async () => ({
    status: 'ok',
    service: 'zerotrust-events-service',
    timestamp: new Date().toISOString()
  }));

  // Register domain routes
  app.register(eventsRoutes);
  app.register(scansRoutes);
  app.register(statsRoutes);

  return app;
}
