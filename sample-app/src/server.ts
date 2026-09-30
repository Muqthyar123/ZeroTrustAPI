import { buildApp } from "./app.js";

const app = buildApp({
  fastifyOpts: { logger: true },
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    const host = process.env.HOST || "0.0.0.0";

    await app.listen({
      port,
      host,
    });

    console.log(`Sample App running on http://localhost:${port} [APP_MODE=${process.env.APP_MODE || "vulnerable"}]`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
