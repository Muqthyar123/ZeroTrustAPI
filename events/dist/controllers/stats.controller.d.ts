import { FastifyRequest, FastifyReply } from 'fastify';
import { StatsService } from '../services/stats.service.js';
export declare class StatsController {
    private stats;
    constructor(stats?: StatsService);
    getStats: (_request: FastifyRequest, reply: FastifyReply) => Promise<never>;
}
export declare const statsController: StatsController;
