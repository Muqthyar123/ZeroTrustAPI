# ZeroTrustAPI - Integrated Multi-Service Architecture (M2 + M3 + M4)

## Overview
This repository contains the ZeroTrustAPI reference testbed services and security tooling:
1. **Sample App** (`sample-app/`): Multi-tenant REST API managing orders, authentication, invoices, user documents, OpenAPI contract, and test fixtures (Port `3000`).
2. **Ownership Service** (`ownership/`): High-performance microservice managing object ownership metadata and tenant delegation records backed by Redis (Port `4000`).
3. **Redis**: In-memory database holding write-through ownership and delegation hashes (Port `6379`).
4. **Events Service** (`events/`): Security event aggregation, auditing, and analytics microservice with SSE streaming, statistics, and scan ingestion (Port `5000`).
5. **Security Dashboard** (`dashboard/`): Real-time React frontend visualizing authorization decisions, BOLA blocks, latency distributions, and scanner reports (Port `5173`).
6. **BOLA Security Scanner** (`scanner/`): Automated CLI vulnerability scanner and probe engine performing dynamic OpenAPI-driven BOLA testing, severity classification, and CI/CD gating.
7. **Benchmark Suite** (`benchmark/`): High-throughput load testing and comparative latency benchmarking harness.

> [!WARNING]
> **Intentionally Vulnerable by Default (`APP_MODE=vulnerable`)**:
> The sample application intentionally demonstrates a **Broken Object Level Authorization (BOLA / IDOR)** vulnerability. While endpoints require valid JWT authentication, the sample application in `vulnerable` mode does not enforce tenant or object ownership boundaries. This allows an authenticated user in `tenantA` (e.g. `userA1`) to access or delete objects belonging to `tenantB` (e.g. order `201`).
>
> In subsequent milestones, the external **ZeroTrustAPI Gateway** (M1) will inspect, detect, and block these unauthorized cross-tenant and unowned access attempts using the Ownership Service as the source of truth, emitting audit events to the Events Service (M4).

---

## Service & Tool Matrix

| Service / Tool | Directory | Port / Mode | Protocol | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Sample App** | `sample-app/` | `3000` | HTTP / REST | Vulnerable target API, OpenAPI specs, fixtures |
| **Ownership Service** | `ownership/` | `4000` | HTTP / REST | Object ownership (`obj:*`) & delegations (`deleg:*`) |
| **Events Service** | `events/` | `5000` | HTTP / REST / SSE | Audit logging, stats calculation, scanner findings |
| **Security Dashboard** | `dashboard/` | `5173` | HTTP / React SPA | Live decision monitor, BOLA alerts, scan UI |
| **Redis** | Docker | `6379` | RESP | Distributed ownership cache |
| **BOLA Scanner** | `scanner/` | CLI / CI Tool | HTTP Client | Automated OpenAPI BOLA probe suite & CI gate |

---

## BOLA Security Scanner (M3)

The automated scanner discovers endpoints from the OpenAPI specification, fetches test fixtures, logs in as fixture users to acquire JWTs, and executes dynamic security probes:

### Probe Categories
- **Own Object Probes**: Verifies legitimate access to user-owned resources (expected `200 OK`).
- **Cross-Tenant Probes**: Attempts cross-tenant object access without delegation (detects BOLA in vulnerable mode, expected `403/404` in secure mode).
- **Same-Tenant Probes**: Tests boundary isolation between distinct users in the same tenant.
- **Nested Resource Probes**: Dynamically parses multi-parameter routes (e.g., `/api/users/{userId}/documents/{documentId}`) to detect IDOR.
- **Write/Delete Mutation Probes**: Tests unauthorized state mutations (`POST`, `DELETE`) across tenant boundaries.
- **Delegation-Aware Testing**: Understands valid delegations (e.g., `userB1` read access on `tenantA` orders) and does not falsely flag authorized delegation access.

### Running Scanner CLI
```bash
# Build scanner
cd scanner && npm run build

# Run scan against target API and submit report to Events Service
node dist/cli.js scan \
  --openapi http://localhost:3000/openapi.json \
  --fixtures http://localhost:3000/_test/fixtures \
  --target http://localhost:3000 \
  --report http://localhost:5000
```

### Scanner CLI Options
- `--openapi <url>`: URL of the OpenAPI 3.0.3 specification JSON (default: `http://localhost:3000/openapi.json`).
- `--fixtures <url>`: URL of the test fixtures endpoint (default: `http://localhost:3000/_test/fixtures`).
- `--target <url>`: Base URL of the target API application (default: `http://localhost:3000`).
- `--report <url>`: Events service endpoint for scan report submission (optional).
- `--timeout <ms>`: HTTP request timeout in milliseconds (default: `10000`).

### Scanner CI/CD Gate
- **Exit code `0`**: Scan passed (0 vulnerabilities detected).
- **Exit code `1`**: Scan failed (BOLA vulnerabilities detected, fails CI pipeline).

---

## OpenAPI Specification (`/openapi.json`)

The Sample App provides a complete **OpenAPI 3.0.3** specification documenting all API routes, request/response models, path parameters, and security schemes:

- **Endpoint**: `GET /openapi.json`
- **Specification Format**: OpenAPI 3.0.3 JSON
- **Documented Routes**:
  - `GET /health`
  - `POST /auth/login`
  - `GET /api/orders/{orderId}`
  - `POST /api/orders`
  - `DELETE /api/orders/{orderId}`
  - `GET /api/invoices/{invoiceId}`
  - `GET /api/users/{userId}/documents/{documentId}`
  - `GET /_test/fixtures`
  - `GET /openapi.json`

### Fetch OpenAPI Contract
```bash
curl -X GET http://localhost:3000/openapi.json
```

---

## Test Fixtures Discovery (`/_test/fixtures`)

For automated CI scanners and testing environments, the Sample App exposes a deterministic fixtures endpoint:

- **Endpoint**: `GET /_test/fixtures`
- **Purpose**: Enables the scanner in Milestone 3 to dynamically discover test identities, tenant assignments, objects, delegations, and expected authorization relationships without hardcoding them.

> [!CAUTION]
> **Security & Privacy Rule**:
> The fixtures endpoint is strictly designed for testbed discovery in CI/demo environments. It **never exposes passwords, secret keys, or private credentials**.

### Fetch Test Fixtures
```bash
curl -X GET http://localhost:3000/_test/fixtures
```

---

## Redis Ownership & Delegation Schemas

### 1. Redis Ownership Schema
- **Key pattern**: `obj:{resourceType}:{objectId}`
- **Data type**: Redis Hash
- **Fields**:
  - `tenantId`: Tenant identifier (e.g. `tenantA`)
  - `ownerUserId`: User ID owning the resource (e.g. `userA1`)

### 2. Redis Delegation Schema
- **Key pattern**: `deleg:{granteeUserId}:{ownerTenantId}:{resourceType}`
- **Data type**: Redis Hash
- **Fields**:
  - `actions`: Comma-separated allowed actions (e.g. `read` or `read,write`)
  - `expiresAt`: Unix epoch timestamp in seconds
- **Validation Rule**: Valid only when `current_unix_time < expiresAt`.

---

## Events Service & Privacy Redaction (M4)

The Events Service (`events/`) provides audit logging and analytics:
- `POST /v1/events`: Ingest authorization decisions (`ALLOW` or `BLOCK`) with reason codes (`OK_OWNER`, `TENANT_MISMATCH`, etc.).
- `GET /v1/events`: Query security events with pagination and filters.
- `GET /v1/events/:decisionId`: Fetch a specific event by decision ID.
- `GET /v1/events/stream`: Server-Sent Events (SSE) stream for real-time live events.
- `GET /v1/stats`: Aggregate security metrics (allow count, block count, block rate, latency).
- `POST /v1/scans` & `GET /v1/scans`: Ingestion and viewing of vulnerability scanner reports.

### Privacy Redaction Rule
To prevent data leaks into audit logs:
- **No raw credentials**: Authorization headers, cookies, and JWTs are stripped.
- **Hashed identifiers**: `objectIdHash` and `subjectHash` are stored as SHA-256 digests.
- **No body contents**: Request payloads are excluded from event records.

---

## Running the Complete System

### Standard Service Ports
- **Sample App**: `http://localhost:3000`
- **Ownership Service**: `http://localhost:4000`
- **Events Service**: `http://localhost:5000`
- **Security Dashboard**: `http://localhost:5173`
- **Redis Cache**: `localhost:6379`

### Docker Compose
```bash
# Build and start all 5 services on standard ports
docker compose up -d --build

# View logs
docker compose logs -f

# Verify live stack on standard ports (3000, 4000, 5000, 5173)
npx tsx scripts/verify-live-stack.ts

# Stop all containers
docker compose down
```

### Running Test Suites & Verification Scripts
```bash
# 1. Ownership Service tests (19 tests)
cd ownership && npm test

# 2. Sample App tests (31 tests)
cd sample-app && npm test

# 3. Events Service tests (15 tests)
cd events && npm test

# 4. Scanner tests (26 tests)
cd scanner && npm test

# 5. Full M2 + M3 + M4 E2E Integration Suite (Tests Vulnerable mode exit 1, Secure mode exit 0, and M4 report storage)
npx tsx scripts/verify-m2-m3-m4-e2e.ts

# 6. In-process multi-service E2E integration runner (M2+M4)
npx tsx scripts/run-all-m2-m4-e2e.ts
```
