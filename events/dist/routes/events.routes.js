"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsRoutes = eventsRoutes;
const events_controller_js_1 = require("../controllers/events.controller.js");
async function eventsRoutes(fastify) {
    fastify.post('/v1/events', events_controller_js_1.eventsController.postEvent);
    fastify.get('/v1/events', events_controller_js_1.eventsController.getEvents);
    fastify.get('/v1/events/stream', events_controller_js_1.eventsController.streamEvents);
    fastify.get('/v1/events/:decisionId', events_controller_js_1.eventsController.getEventById);
}
