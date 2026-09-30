# ZeroTrustAPI - Integrated Multi-Service Architecture (M2 + M4)

## Overview
This repository contains the ZeroTrustAPI reference testbed services:
1. **Sample App** (`sample-app/`): Multi-tenant REST API managing orders, authentication, invoices, user documents, OpenAPI contract, and test fixtures (Port `3000`).
2. **Ownership Service** (`ownership/`): High-performance microservice managing object ownership metadata and tenant delegation records backed by Redis (Port `4000`).
3. **Redis**: In-memory database holding write-through ownership and delegation hashes (Port `6379`).
4. **Events Service** (`events/`): Security event aggregation, auditing, and analytics microservice with SSE streaming, statistics, and scan ingestion (Port `5000`).
5. **Security Dashboard** (`dashboard/`): Real-time React frontend visualizing authorization decisions, BOLA blocks, latency distributions, and scanner reports (Port `5173`).
6. **Benchmark Suite** (`benchmark/`): High-throughput load testing and comparative latency benchmarking harness.

> [!WARNING]
> **Intentionally Vulnerable by Default (`APP_MODE=vulnerable`)**:
> The sample application intentionally demonstrates a **Broken Object Level Authorization (BOLA / IDOR)** vulnerability. While endpoints require valid JWT authentication, the sample application in `vulnerable` mode does not enforce tenant or object ownership boundaries. This allows an authenticated user in `tenantA` (e.g. `userA1`) to access or delete objects belonging to `tenantB` (e.g. order `201`).
>
> In subsequent milestones, the external **ZeroTrustAPI Gateway** (M1) will inspect, detect, and block these unauthorized cross-tenant and unowned access attempts using the Ownership Service as the source of truth, emitting audit events to the Events Service (M4).

---

## Service Port Matrix

| Service | Directory | Port | Protocol | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Sample App** | `sample-app/` | `3000` | HTTP / REST | Vulnerable target API, OpenAPI specs, fixtures |
| **Ownership Service** | `ownership/` | `4000` | HTTP / REST | Object ownership (`obj:*`) & delegations (`deleg:*`) |
| **Events Service** | `events/` | `5000` | HTTP / REST / SSE | Audit logging, stats calculation, scanner findings |
| **Security Dashboard** | `dashboard/` | `5173` | HTTP / React SPA | Live decision monitor, BOLA alerts, scan UI |
| **Redis** | Docker | `6379` | RESP | Distributed ownership cache |

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

### Docker Compose
```bash
# Build and start all 5 services
docker compose up -d --build

# View logs
docker compose logs -f

# Run multi-service end-to-end integration test
npx tsx scripts/run-all-m2-m4-e2e.ts

# Stop all containers
docker compose down
```

### Running Test Suites
```bash
# Ownership Service tests (19 tests)
cd ownership && npm test

# Sample App tests (31 tests)
cd sample-app && npm test

# Events Service tests (15 tests)
cd events && npm test

# Run complete integration script (65 tests + multi-service flows)
npx tsx scripts/run-all-m2-m4-e2e.ts
```
