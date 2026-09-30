"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const env_js_1 = require("./config/env.js");
const mock_service_js_1 = require("./services/mock.service.js");
const sse_service_js_1 = require("./services/sse.service.js");
async function start() {
    const app = (0, app_js_1.buildApp)();
    try {
        if (env_js_1.env.MOCK_DATA) {
            console.log('🚀 MOCK_DATA=true: Initializing mock data generator and demo seeder...');
            await mock_service_js_1.mockService.seedInitialData();
            mock_service_js_1.mockService.start(env_js_1.env.MOCK_INTERVAL_MS);
            console.log(`📡 Mock event streamer active (interval: ${env_js_1.env.MOCK_INTERVAL_MS}ms)`);
        }
        const address = await app.listen({ port: env_js_1.env.PORT, host: env_js_1.env.HOST });
        console.log(`🛡️  ZeroTrustAPI Events Service running at ${address}`);
        console.log(`📊 Endpoints:`);
        console.log(`   - POST /v1/events`);
        console.log(`   - GET  /v1/events`);
        console.log(`   - GET  /v1/events/:decisionId`);
        console.log(`   - GET  /v1/events/stream (SSE)`);
        console.log(`   - GET  /v1/stats`);
        console.log(`   - POST /v1/scans`);
        console.log(`   - GET  /v1/scans`);
        console.log(`   - GET  /v1/scans/:scanId`);
    }
    catch (err) {
        console.error('Error starting server:', err);
        process.exit(1);
    }
    const shutdown = async (signal) => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        mock_service_js_1.mockService.stop();
        sse_service_js_1.sseService.closeAll();
        await app.close();
        process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
start();
