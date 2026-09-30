import { FastifyInstance } from 'fastify';
import { scansController } from '../controllers/scans.controller.js';

export async function scansRoutes(fastify: FastifyInstance) {
  fastify.post('/v1/scans', scansController.postScan);
  fastify.get('/v1/scans', scansController.getScans);
  fastify.get('/v1/scans/:scanId', scansController.getScanById);
}
