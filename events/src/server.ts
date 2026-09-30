import { buildApp } from './app.js';
import { env } from './config/env.js';
import { mockService } from './services/mock.service.js';
import { sseService } from './services/sse.service.js';

async function start() {
  const app = buildApp();

  try {
    if (env.MOCK_DATA) {
      console.log('🚀 MOCK_DATA=true: Initializing mock data generator and demo seeder...');
      await mockService.seedInitialData();
      mockService.start(env.MOCK_INTERVAL_MS);
      console.log(`📡 Mock event streamer active (interval: ${env.MOCK_INTERVAL_MS}ms)`);
    }

    const address = await app.listen({ port: env.PORT, host: env.HOST });
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
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    mockService.stop();
    sseService.closeAll();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
