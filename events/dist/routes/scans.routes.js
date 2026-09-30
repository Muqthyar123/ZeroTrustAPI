"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scansRoutes = scansRoutes;
const scans_controller_js_1 = require("../controllers/scans.controller.js");
async function scansRoutes(fastify) {
    fastify.post('/v1/scans', scans_controller_js_1.scansController.postScan);
    fastify.get('/v1/scans', scans_controller_js_1.scansController.getScans);
    fastify.get('/v1/scans/:scanId', scans_controller_js_1.scansController.getScanById);
}
