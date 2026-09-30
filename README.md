# ZeroTrustAPI - Integrated Multi-Service Architecture (M1 + M2 + M3 + M4)

## Architecture Overview
ZeroTrustAPI is a cloud-native API security platform and reference testbed for detecting, mitigating, and monitoring **Broken Object Level Authorization (BOLA / IDOR)** vulnerabilities in multi-tenant environments.

```
                  ┌────────────────────────────────────────────────────────┐
                  │                   Client / M3 Scanner                  │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                       ┌──────────────────────┴──────────────────────┐
                       │                                             │
                       ▼ (Protected Path)                            ▼ (Direct Benchmark / Test)
           ┌───────────────────────┐                     ┌───────────────────────┐
           │   M1 Gateway (:8080)  │                     │ M2 Sample App (:3000) │
           └───────────┬───────────┘                     │  (Vulnerable Upstream)│
                       │                                 └───────────────────────┘
          ┌────────────┴────────────┐                                ▲
          │                         │                                │
          ▼ (Ownership Check)       ▼ (Audit Telemetry)              │
┌───────────────────┐     ┌───────────────────┐                      │
│   Redis (:6379)   │     │ M4 Events (:5000) │                      │
│ (obj:* / deleg:*) │     └─────────┬─────────┘                      │
└───────────────────┘               │ (SSE Stream / REST)            │
          ▲                         ▼                                │
          │               ┌───────────────────┐                      │
          │               │M4 Dashboard(:5173)│                      │
          │               └───────────────────┘                      │
          │                                                          │
          └──────────────────────────────────────────────────────────┘
```

---

## Service Matrix

| Service / Tool | Directory | Port / Mode | Role & Description |
| :--- | :--- | :--- | :--- |
| **M1 Zero-Trust Gateway** | `gateway/` | `8080` | High-performance reverse proxy enforcing JWT auth, scope auth, Redis object ownership (`obj:*`), and delegation checks (`deleg:*`). Emits non-blocking security decision events to M4. |
| **M2 Sample App** | `sample-app/` | `3000` | Multi-tenant reference API (orders, invoices, user documents, OpenAPI contract, fixtures). Runs in `vulnerable` mode to demonstrate BOLA. |
| **M2 Ownership Service** | `ownership/` | `4000` | Microservice managing object ownership metadata and tenant delegation records backed by Redis. |
| **Redis Cache** | Docker | `6379` | In-memory distributed data store holding ownership hashes (`obj:{resource}:{id}`) and delegation grants (`deleg:{grantee}:{tenant}:{resource}`). |
| **M4 Events Service** | `events/` | `5000` | Security decision ingestion (`POST /v1/events`), audit logging, aggregated statistics, SSE real-time stream, and scanner report storage (`/v1/scans`). |
| **M4 Security Dashboard** | `dashboard/` | `5173` | Real-time React SPA with SSE telemetry, BOLA attack alerts, decision breakdown, and vulnerability scan reports. |
| **M3 BOLA Scanner** | `scanner/` | CLI / CI Tool | Automated OpenAPI-driven probe generator and scanner validating BOLA protection across all endpoints with severity grading. |
| **Benchmark Suite** | `benchmark/` | CLI | High-throughput load testing and comparative latency benchmarking harness. |

---

## Key Security Invariants & Guarantees

1. **Fail-Closed Object Authorization**:
   - Every request to `/api/*` is evaluated by Gateway middleware (`authenticate` $\rightarrow$ `authorize` $\rightarrow$ `checkOwnership`).
   - If Redis is unreachable or an object is missing, the Gateway returns `403 Forbidden` (`UNKNOWN_OBJECT`) without leaking object existence (`404`) or internal state.
2. **Deterministic Ownership & Cross-Tenant Isolation**:
   - `userA1` (tenantA) cannot access resources owned by `userB1` (tenantB) unless an active, unexpired delegation grant exists in Redis (`deleg:userB1:tenantA:orders`).
3. **Privacy & Redaction Contract**:
   - Gateway and Scanner **never emit raw passwords, Bearer tokens, or Authorization headers** to the Events Service.
   - User identities and Object IDs are hashed with SHA-256 (`subjectHash`, `objectIdHash`) before transmission.
4. **Isolated Telemetry Non-Blocking Dispatch**:
   - Event emission to `M4 (:5000)` occurs asynchronously via `setImmediate()`. Network latencies, timeouts, or Events Service downtime never block or alter authorization outcomes on the Gateway.

---

## Quick Start (Run Live Stack)

### 1. Start All Services Locally
```bash
npx tsx scripts/start-all.ts
```
This boots all 6 services simultaneously:
- **Security Dashboard UI**: http://localhost:5173
- **M1 Gateway (Protected)**: http://localhost:8080
- **M2 Sample App (Upstream)**: http://localhost:3000
- **M2 Ownership Service**: http://localhost:4000
- **M4 Events Service**: http://localhost:5000
- **Redis Memory Store**: In-Memory / Docker

### 2. Docker Compose
```bash
# Build and start all 6 services
docker compose up -d --build

# View logs
docker compose logs -f

# Teardown
docker compose down
```

---

## Running the M3 BOLA Scanner

```bash
# Build scanner CLI
cd scanner && npm run build

# 1. Run scanner against Protected Gateway (Result: 0 findings, Status: PASS, Exit Code: 0)
node dist/cli.js scan \
  --openapi http://localhost:8080/openapi.json \
  --fixtures http://localhost:8080/_test/fixtures \
  --target http://localhost:8080 \
  --report http://localhost:5000

# 2. Run scanner against Direct Vulnerable Sample App (Result: 13 findings, Status: FAIL, Exit Code: 1)
node dist/cli.js scan \
  --openapi http://localhost:3000/openapi.json \
  --fixtures http://localhost:3000/_test/fixtures \
  --target http://localhost:3000 \
  --report http://localhost:5000
```

---

## Test Suites & Regression Verification

The repository contains **226 automated tests** across all 4 milestones:

```bash
# 1. M1 Gateway Tests (135 tests)
cd gateway && npm test

# 2. M2 Ownership Service Tests (19 tests)
cd ownership && npm test

# 3. M2 Sample App Tests (31 tests)
cd sample-app && npm test

# 4. M4 Events Service Tests (15 tests)
cd events && npm test

# 5. M3 Scanner Tests (26 tests)
cd scanner && npm test

# 6. Comprehensive M1 + M2 + M3 + M4 Full End-to-End Verification
npx tsx scripts/verify-full-m1-m2-m3-m4-e2e.ts
```
