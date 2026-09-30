import { performance } from 'node:perf_hooks';

export interface BenchmarkOptions {
  name: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  concurrency: number;
  durationSeconds: number;
  warmupSeconds?: number;
}

export interface BenchmarkMetrics {
  name: string;
  url: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  durationMs: number;
  requestsPerSecond: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
}

function calculatePercentile(latencies: number[], p: number): number {
  if (latencies.length === 0) return 0;
  const index = Math.ceil((p / 100) * latencies.length) - 1;
  return Number(latencies[Math.max(0, Math.min(index, latencies.length - 1))].toFixed(2));
}

export async function runLoadTest(opts: BenchmarkOptions): Promise<BenchmarkMetrics> {
  const method = opts.method || 'GET';
  const headers = opts.headers || {};
  const latencies: number[] = [];
  let successful = 0;
  let failed = 0;

  console.log(`\n======================================================`);
  console.log(`🚀 Starting Benchmark: [${opts.name}]`);
  console.log(`📍 URL: ${opts.url}`);
  console.log(`⚡ Concurrency: ${opts.concurrency} | Duration: ${opts.durationSeconds}s`);
  console.log(`======================================================`);

  const startTime = performance.now();
  const endTime = startTime + opts.durationSeconds * 1000;

  async function worker() {
    while (performance.now() < endTime) {
      const reqStart = performance.now();
      try {
        const res = await fetch(opts.url, {
          method,
          headers,
          body: opts.body,
          // keepalive for connection reuse
          keepalive: true
        });

        // Drain response
        await res.text();

        const latency = performance.now() - reqStart;
        latencies.push(latency);

        if (res.ok || res.status === 403) {
          // 403 Forbidden is a valid zero-trust gateway enforcement decision
          successful++;
        } else {
          failed++;
        }
      } catch {
        const latency = performance.now() - reqStart;
        latencies.push(latency);
        failed++;
      }
    }
  }

  // Launch concurrent workers
  const workers = Array.from({ length: opts.concurrency }, () => worker());
  await Promise.all(workers);

  const actualDurationMs = performance.now() - startTime;
  latencies.sort((a, b) => a - b);

  const total = latencies.length;
  const sum = latencies.reduce((acc, val) => acc + val, 0);
  const avgMs = total > 0 ? Number((sum / total).toFixed(2)) : 0;
  const rps = total > 0 ? Number(((total / actualDurationMs) * 1000).toFixed(2)) : 0;

  const metrics: BenchmarkMetrics = {
    name: opts.name,
    url: opts.url,
    totalRequests: total,
    successfulRequests: successful,
    failedRequests: failed,
    durationMs: Number(actualDurationMs.toFixed(2)),
    requestsPerSecond: rps,
    p50Ms: calculatePercentile(latencies, 50),
    p95Ms: calculatePercentile(latencies, 95),
    p99Ms: calculatePercentile(latencies, 99),
    minMs: latencies.length > 0 ? Number(latencies[0].toFixed(2)) : 0,
    maxMs: latencies.length > 0 ? Number(latencies[latencies.length - 1].toFixed(2)) : 0,
    avgMs
  };

  console.log(`📊 Completed: ${total} reqs in ${(actualDurationMs / 1000).toFixed(1)}s (${rps} req/s)`);
  console.log(`   - p50: ${metrics.p50Ms}ms | p95: ${metrics.p95Ms}ms | p99: ${metrics.p99Ms}ms | avg: ${metrics.avgMs}ms`);

  return metrics;
}
