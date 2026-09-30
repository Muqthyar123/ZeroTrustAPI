import { buildOwnershipApp } from "../ownership/src/app.js";
import { createRedisMock } from "../ownership/src/redis/client.js";
import { seedOwnershipData } from "../ownership/src/seed/seedOwnership.js";

async function runPerfSanity() {
  const redis = createRedisMock();
  await seedOwnershipData(redis);

  const app = buildOwnershipApp({ redis, fastifyOpts: { logger: false } });
  await app.listen({ port: 4088, host: "127.0.0.1" });

  const url = "http://127.0.0.1:4088/v1/ownership/orders/101";

  // Warmup
  for (let i = 0; i < 50; i++) {
    await fetch(url);
  }

  const iterations = 500;
  const latencies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const res = await fetch(url);
    const end = performance.now();
    if (!res.ok) throw new Error("Request failed");
    await res.json();
    latencies.push(end - start);
  }

  await app.close();

  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const avg = sum / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const min = latencies[0];
  const max = latencies[latencies.length - 1];

  console.log("==========================================================");
  console.log(" Ownership Service GET Lookup - Performance Sanity Check");
  console.log(" Target: GET /v1/ownership/orders/101");
  console.log(` Samples: ${iterations} requests`);
  console.log("==========================================================");
  console.log(` Min:  ${min?.toFixed(3)} ms`);
  console.log(` Avg:  ${avg.toFixed(3)} ms`);
  console.log(` P50:  ${p50?.toFixed(3)} ms`);
  console.log(` P95:  ${p95?.toFixed(3)} ms`);
  console.log(` P99:  ${p99?.toFixed(3)} ms`);
  console.log(` Max:  ${max?.toFixed(3)} ms`);
  console.log("==========================================================");
}

runPerfSanity().catch((err) => {
  console.error("Perf sanity test error:", err);
  process.exit(1);
});
