# ZeroTrustAPI - OpenAPI Contract & Test Fixtures (Milestone 2)

## Overview
This repository contains the ZeroTrustAPI reference testbed services:
1. **Sample App** (`sample-app/`): Multi-tenant REST API managing orders, authentication, invoices, user documents, OpenAPI contract, and test fixtures (port `3000`).
2. **Ownership Service** (`ownership/`): Microservice managing object ownership metadata and tenant delegation records backed by Redis (port `4000`).
3. **Redis**: In-memory database holding write-through ownership and delegation hashes (port `6379`).

> [!WARNING]
> **Intentionally Vulnerable by Default (`APP_MODE=vulnerable`)**:
> The sample application intentionally demonstrates a **Broken Object Level Authorization (BOLA / IDOR)** vulnerability. While endpoints require valid JWT authentication, the sample application in `vulnerable` mode does not enforce tenant or object ownership boundaries. This allows an authenticated user in `tenantA` (e.g. `userA1`) to access or delete objects belonging to `tenantB` (e.g. order `201`).
>
> In subsequent milestones, the external **ZeroTrustAPI Gateway** will inspect, detect, and block these unauthorized cross-tenant and unowned access attempts using the Ownership Service as the source of truth.

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

### Fixture Structure
```json
{
  "version": "1.0.0",
  "tenants": [
    { "tenantId": "tenantA", "name": "Tenant A Organization" },
    { "tenantId": "tenantB", "name": "Tenant B Organization" }
  ],
  "users": [
    {
      "userId": "userA1",
      "email": "userA1@example.com",
      "tenantId": "tenantA",
      "orgId": "tenantA",
      "scope": ["orders:read"],
      "ownedOrders": ["101", "102"]
    },
    {
      "userId": "userA2",
      "email": "userA2@example.com",
      "tenantId": "tenantA",
      "orgId": "tenantA",
      "scope": ["orders:read:tenant"],
      "ownedOrders": []
    },
    {
      "userId": "userB1",
      "email": "userB1@example.com",
      "tenantId": "tenantB",
      "orgId": "tenantB",
      "scope": ["orders:read"],
      "ownedOrders": ["201", "202"]
    }
  ],
  "objects": {
    "orders": [
      { "id": "101", "tenantId": "tenantA", "ownerUserId": "userA1" },
      { "id": "102", "tenantId": "tenantA", "ownerUserId": "userA1" },
      { "id": "201", "tenantId": "tenantB", "ownerUserId": "userB1" },
      { "id": "202", "tenantId": "tenantB", "ownerUserId": "userB1" }
    ]
  },
  "delegations": [
    {
      "delegationId": "userB1:tenantA:orders",
      "granteeUserId": "userB1",
      "ownerTenantId": "tenantA",
      "resourceType": "orders",
      "actions": "read",
      "status": "active"
    }
  ],
  "expectedAuthorization": [
    {
      "scenario": "Owner accesses own order in Tenant A",
      "userId": "userA1",
      "userTenantId": "tenantA",
      "resourceType": "orders",
      "objectId": "101",
      "objectTenantId": "tenantA",
      "action": "read",
      "expectedResult": "authorized"
    },
    {
      "scenario": "Cross-tenant unauthorized order access attempt (BOLA vulnerability)",
      "userId": "userA1",
      "userTenantId": "tenantA",
      "resourceType": "orders",
      "objectId": "201",
      "objectTenantId": "tenantB",
      "action": "read",
      "expectedResult": "unauthorized"
    },
    {
      "scenario": "Cross-tenant order read permitted via active delegation",
      "userId": "userB1",
      "userTenantId": "tenantB",
      "resourceType": "orders",
      "objectId": "101",
      "objectTenantId": "tenantA",
      "action": "read",
      "expectedResult": "authorized"
    }
  ]
}
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

## Running the Services

### Docker Compose
```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f

# Run end-to-end verification
npx tsx scripts/verify-e2e.ts

# Stop containers
docker compose down
```

### Local Development (Without Docker)
```bash
# Terminal 1 - Ownership Service (Port 4000)
cd ownership
npm install
npm run build
npm start

# Terminal 2 - Sample App (Port 3000)
cd sample-app
npm install
npm run build
npm start
```

### Running Tests
```bash
# Ownership Service tests (19 tests)
cd ownership && npm test

# Sample App tests (31 tests)
cd sample-app && npm test
```
