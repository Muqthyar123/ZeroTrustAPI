const { buildGatewayApp } = require("./src/app");

const app = buildGatewayApp({ logger: true });

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const HOST = process.env.HOST || "0.0.0.0";

app.listen({ port: PORT, host: HOST })
  .then(() => {
    console.log(`ZeroTrustAPI Gateway running on port ${PORT}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });