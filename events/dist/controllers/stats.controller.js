"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statsController = exports.StatsController = void 0;
const stats_service_js_1 = require("../services/stats.service.js");
class StatsController {
    stats;
    constructor(stats = stats_service_js_1.statsService) {
        this.stats = stats;
    }
    getStats = async (_request, reply) => {
        try {
            const result = await this.stats.getStats();
            return reply.status(200).send(result);
        }
        catch (err) {
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: err.message || 'Failed to compute statistics'
            });
        }
    };
}
exports.StatsController = StatsController;
exports.statsController = new StatsController();
