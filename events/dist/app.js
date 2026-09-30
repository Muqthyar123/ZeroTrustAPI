"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const events_routes_js_1 = require("./routes/events.routes.js");
const scans_routes_js_1 = require("./routes/scans.routes.js");
const stats_routes_js_1 = require("./routes/stats.routes.js");
function buildApp() {
    const app = (0, fastify_1.default)({
        logger: false,
        disableRequestLogging: true
    });
    // Enable CORS for Dashboard on :5173 or other origins
    app.register(cors_1.default, {
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
    app.register(events_routes_js_1.eventsRoutes);
    app.register(scans_routes_js_1.scansRoutes);
    app.register(stats_routes_js_1.statsRoutes);
    return app;
}
