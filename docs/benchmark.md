# ZeroTrustAPI Benchmark & Load-Testing Documentation

## Overview

The benchmark harness located in `/benchmark` provides repeatable, high-precision load testing to evaluate the throughput and latency characteristics of the Zero-Trust Gateway architecture.

---

## Benchmark Design

- **Harness Engine**: Pure Node.js HTTP pipeline with keep-alive connection reuse and microsecond-level latency measurement using `performance.now()`.
- **Latency Percentiles**: Calculates `p50`, `p95`, `p99`, `min`, `max`, and arithmetic mean.
- **Scenarios Evaluated**:
  1. **Direct Baseline Application**: Tests target endpoints without gateway policy enforcement.
  2. **Zero-Trust Telemetry & Verification Gateway**: Measures overhead when the gateway validates tenant boundaries and streams telemetry events.

---

## How to Run Benchmarks

### 1. Install & Build
```bash
cd benchmark
npm install
npm run build
```

### 2. Run Comparative Benchmark
```bash
npm run bench
```

### 3. Custom Environment Variables
You can configure target URLs, concurrency, and duration:
```bash
$env:BASELINE_URL="http://localhost:3000/api/v1/documents/doc-123"
$env:GATEWAY_URL="http://localhost:8080/api/v1/documents/doc-123"
$env:CONCURRENCY="16"
$env:DURATION="10"
npm run bench
```

---

## Results and Artifacts

- Machine-readable results are saved to `benchmark/results/baseline-result.json` and `benchmark/results/gateway-result.json`.
- A formatted Markdown report is generated at `benchmark/results/comparison-report.md`.
