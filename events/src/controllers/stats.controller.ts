import { FastifyRequest, FastifyReply } from 'fastify';
import { StatsService, statsService } from '../services/stats.service.js';

export class StatsController {
  constructor(private stats: StatsService = statsService) {}

  public getStats = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await this.stats.getStats();
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: err.message || 'Failed to compute statistics'
      });
    }
  };
}

export const statsController = new StatsController();
