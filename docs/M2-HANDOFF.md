# ZeroTrustAPI - Milestone 2 Handoff Specification

**Milestone Status**: `M2 READY FOR TEAM INTEGRATION`  
**Date**: September 30, 2026  
**Module**: Milestone 2 (Orders API, Ownership Service, Redis, Docker Compose, OpenAPI 3.0.3, Test Fixtures)

---

## 1. System Architecture

```
                       [ Client / Scanner / Gateway ]
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   Sample Application      │  (Port 3000)
                        │   (APP_MODE=vulnerable)   │
                        └─────────────┬─────────────┘
                                      │ Synchronous write-through / delete
                                      ▼
                        ┌───────────────────────────┐
                        │   Ownership Service       │  (Port 4000)
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │      Redis Store          │  (Port 6379)
                        └───────────────────────────┘
```

---

## 2. Port Allocations & Endpoints

| Service | Port | Internal Docker Hostname | Key Endpoints |
|---|---|---|---|
| **Sample App** | `3000` | `sample-app` | `POST /auth/login`<br>`GET /health`<br>`GET /openapi.json`<br>`GET /_test/fixtures`<br>`GET /api/orders/:orderId`<br>`POST /api/orders`<br>`DELETE /api/orders/:orderId`<br>`GET /api/invoices/:invoiceId`<br>`GET /api/users/:userId/documents/:documentId` |
| **Ownership Service** | `4000` | `ownership` | `GET /health`<br>`PUT /v1/ownership`<br>`GET /v1/ownership/:resourceType/:objectId`<br>`DELETE /v1/ownership/:resourceType/:objectId`<br>`POST /v1/delegations`<br>`GET /v1/delegations/:delegationId`<br>`DELETE /v1/delegations/:delegationId` |
| **Redis** | `6379` | `redis` | In-memory key-value & hash store |

---

## 3. Redis Data Schemas

### 3.1 Object Ownership Schema
- **Key Pattern**: `obj:{resourceType}:{objectId}`
- **Type**: Redis Hash
- **Fields**:
  - `tenantId`: Tenant identifier (e.g. `tenantA`)
  - `ownerUserId`: User ID owning the object (e.g. `userA1`)
- **Example**:
  ```text
  Key: obj:orders:101
  Fields:
    tenantId = "tenantA"
    ownerUserId = "userA1"
  ```

### 3.2 Delegation Schema
- **Key Pattern**: `deleg:{granteeUserId}:{ownerTenantId}:{resourceType}`
- **Type**: Redis Hash
- **Fields**:
  - `actions`: Comma-separated actions permitted (e.g. `"read"`)
  - `expiresAt`: Unix epoch seconds timestamp string (e.g. `"1759324800"`)
- **Validation Rule**: A delegation is valid only if `current_unix_time < expiresAt`.
- **Example**:
  ```text
  Key: deleg:userB1:tenantA:orders
  Fields:
    actions = "read"
    expiresAt = "1759324800"
  ```

---

## 4. Frozen Seed Data & Test Identities

### 4.1 Users & Tenants
| User ID | Email | Test Password | Tenant ID | Org ID | Scopes | Initial Owned Orders |
|---|---|---|---|---|---|---|
| `userA1` | `userA1@example.com` | `password123` | `tenantA` | `tenantA` | `["orders:read"]` | `101`, `102` |
| `userA2` | `userA2@example.com` | `password123` | `tenantA` | `tenantA` | `["orders:read:tenant"]` | None |
| `userB1` | `userB1@example.com` | `password123` | `tenantB` | `tenantB` | `["orders:read"]` | `201`, `202` |

### 4.2 Initial Orders
| Order ID | Tenant ID | Owner User ID | Items | Amount | Status |
|---|---|---|---|---|---|
| `101` | `tenantA` | `userA1` | Mechanical Keyboard (x1) | $120.00 | `completed` |
| `102` | `tenantA` | `userA1` | USB-C Hub (x2) | $80.00 | `processing` |
| `201` | `tenantB` | `userB1` | Ergonomic Chair (x1) | $450.00 | `shipped` |
| `202` | `tenantB` | `userB1` | 4K Ultra-wide Monitor (x1) | $650.00 | `pending` |

### 4.3 Frozen Demo Delegation
- **Grantee User**: `userB1`
- **Owner Tenant**: `tenantA`
- **Resource Type**: `orders`
- **Action**: `read`
- **Status**: Active (expires in 24 hours from service start)

---

## 5. OpenAPI & Test Fixtures

### 5.1 OpenAPI Specification (`GET /openapi.json`)
- Returns OpenAPI 3.0.3 document.
- Fully typed path parameters:
  - `/api/orders/{orderId}` -> `orderId`
  - `/api/invoices/{invoiceId}` -> `invoiceId`
  - `/api/users/{userId}/documents/{documentId}` -> `userId`, `documentId`
- Security scheme: `BearerAuth` (JWT bearer).

### 5.2 Test Fixtures Discovery (`GET /_test/fixtures`)
- Deterministic JSON fixture describing tenants, users, objects, delegations, and expected authorization scenarios.
- **Security Invariant**: Strictly omits passwords, private signing keys, and secrets.

---

## 6. M1 Integration Guide (ZeroTrustAPI Gateway)

When the **ZeroTrustAPI Gateway (M1)** is implemented, it must intercept incoming HTTP requests before they reach the Sample App and make zero-trust authorization decisions as follows:

```
[ Inbound Request ]
        │
        ▼
[ M1 Gateway ] ──(1. Verify JWT)──────────────> Extract `sub`, `tenant_id`, `scope`
        │
        ├──(2. Match Route & Extract Object ID)─> e.g. /api/orders/:orderId -> ("orders", "101")
        │
        ├──(3. Query Ownership Service / Redis)─> GET /v1/ownership/orders/101
        │                                         -> tenantId="tenantA", ownerUserId="userA1"
        │
        ├──(4. Authorization Decision):
        │     ├─ Case A (Owner): user.sub == record.ownerUserId ───────────────> ALLOW (200)
        │     ├─ Case B (Tenant-wide Reader): user.tenant_id == record.tenantId
        │     │                               && user.scope has orders:read:tenant > ALLOW (200)
        │     ├─ Case C (Delegation): Check GET /v1/delegations/:sub/:tenantId/orders
        │     │                       If active and action permitted ──────────> ALLOW (200)
        │     └─ Case D (BOLA / Cross-tenant violation): None match ───────────> BLOCK (403 Forbidden)
        ▼
[ Sample App ] (only reached if Gateway permits)
```

### Specific Gateway Instructions:
1. **Route Matching & Object Identification**:
   - Gateway reads route templates from `/openapi.json` to extract path parameters (e.g. `orderId` in `/api/orders/:orderId`).
   - Resource type is inferred from the path (e.g. `/api/orders/*` -> `resourceType = "orders"`).
2. **JWT Claims Extraction**:
   - Verify JWT using `JWT_SECRET`.
   - Extract `sub` (caller userId), `tenant_id` (caller tenant), `scope` (permissions).
3. **Ownership Lookup**:
   - Query Ownership Service `GET /v1/ownership/:resourceType/:objectId` or direct Redis hash `obj:{resourceType}:{objectId}`.
4. **Delegation Lookup**:
   - Query Ownership Service `GET /v1/delegations/:granteeUserId::ownerTenantId::resourceType` or Redis hash `deleg:{granteeUserId}:{ownerTenantId}:{resourceType}`.
   - Verify `current_time < expiresAt`.

---

## 7. M3 Integration Guide (Automated Scanner)

When the **Automated Vulnerability Scanner (M3)** is implemented, it should perform automated BOLA security audits against the testbed as follows:

1. **Discovery**:
   - Request `GET /openapi.json` to automatically discover all protected routes and path parameters.
   - Request `GET /_test/fixtures` to discover test identities (`userA1`, `userA2`, `userB1`), object IDs (`101`, `102`, `201`, `202`), and active delegations.
2. **Authentication**:
   - Authenticate against `POST /auth/login` using test fixture credentials (e.g. `userA1@example.com` / `password123`) to obtain JWTs for each test persona.
3. **Vulnerability Verification (Baseline Testing)**:
   - Run cross-tenant request: Authenticate as `userA1` (tenantA) and send `GET /api/orders/201` (tenantB order).
   - In `APP_MODE=vulnerable` without Gateway: Scanner observes status `200 OK` and logs **OWASP API1:2023 Broken Object Level Authorization (BOLA) Detected**.
4. **Gateway Protection Verification**:
   - When Gateway is placed in front: Scanner repeats the test and verifies that `GET /api/orders/201` is blocked with `403 Forbidden`.

---

## 8. Summary of Added Endpoints During M2

The following routes were added to support contract completeness and test fixtures:
- `GET /openapi.json`: Returns OpenAPI 3.0.3 contract.
- `GET /_test/fixtures`: Returns deterministic test fixtures without secrets.
- `GET /api/invoices/:invoiceId`: Parameterized resource route stub documented in OpenAPI.
- `GET /api/users/:userId/documents/:documentId`: Compound parameterized resource route stub documented in OpenAPI.
- `PUT /v1/ownership`: Creates/updates ownership in Ownership Service.
- `GET /v1/ownership/:resourceType/:objectId`: Reads ownership from Ownership Service.
- `DELETE /v1/ownership/:resourceType/:objectId`: Removes ownership from Ownership Service.
- `POST /v1/delegations`: Creates delegation in Ownership Service.
- `GET /v1/delegations/:delegationId`: Reads and validates delegation in Ownership Service.
- `DELETE /v1/delegations/:delegationId`: Deletes delegation from Ownership Service.

---

## 9. Verification Summary

- **Total Test Suites**: 6 test files
- **Total Tests Passing**: 50/50 (100%)
- **TypeScript Builds**: 0 errors
- **Docker Compose Networking**: Clean inter-service DNS resolution
- **Write-Through Ownership & Deletion Sync**: Verified end-to-end
