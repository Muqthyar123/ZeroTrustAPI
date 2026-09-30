"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statsRoutes = statsRoutes;
const stats_controller_js_1 = require("../controllers/stats.controller.js");
async function statsRoutes(fastify) {
    fastify.get('/v1/stats', stats_controller_js_1.statsController.getStats);
}
