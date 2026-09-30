const Fastify = require("fastify");

const app = Fastify({
  logger: true
});

app.get("/api/test", async () => {
  return {
    message: "Response from Sample App"
  };
});

app.listen({ port: 3000, host: "0.0.0.0" })
  .then(() => {
    console.log("Sample App running on port 3000");
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });