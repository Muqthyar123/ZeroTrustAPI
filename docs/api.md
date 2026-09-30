# ZeroTrustAPI Frozen API Specification

Base URL: `http://localhost:5000`

---

## Security Events API

### 1. Ingest Security Decision Event
- **Endpoint**: `POST /v1/events`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "decisionId": "dec_94f83b1029a74e2a",
  "timestamp": "2026-09-30T10:00:00.000Z",
  "method": "GET",
  "routeTemplate": "/api/v1/documents/{documentId}",
  "resourceType": "document",
  "objectIdHash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
  "subjectHash": "b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78",
  "tenantId": "tenant-alpha",
  "objectTenantId": "tenant-alpha",
  "decision": "ALLOW",
  "reason": "OK_OWNER",
  "authzLatencyUs": 240
}
```
- **Response**: `201 Created`
- **Privacy Rules**: Rejects with `422 Unprocessable Entity` if any raw JWTs, `Authorization` headers, `requestBody`, or credentials are present.

### 2. List Events
- **Endpoint**: `GET /v1/events?decision={ALLOW|BLOCK}&tenant={tenantId}&limit={50}`
- **Response**: `200 OK` (Array of `SecurityEvent`)

### 3. Get Single Event Details
- **Endpoint**: `GET /v1/events/{decisionId}`
- **Response**: `200 OK` (`SecurityEvent`) or `404 Not Found`

### 4. Server-Sent Events Live Stream
- **Endpoint**: `GET /v1/events/stream`
- **Headers**: `Accept: text/event-stream`
- **Stream format**:
```
event: security_event
data: {"decisionId":"dec_123","timestamp":"...","decision":"BLOCK","reason":"TENANT_MISMATCH",...}

: ping 1727690000000
```

---

## Security Statistics API

### 5. Aggregate Metrics
- **Endpoint**: `GET /v1/stats`
- **Response**: `200 OK`
```json
{
  "totalEvents": 42,
  "allowed": 30,
  "blocked": 12,
  "blockRate": 28.57,
  "eventsByReason": {
    "OK_OWNER": 25,
    "TENANT_MISMATCH": 10,
    "OK_DELEGATION": 5,
    "NOT_OWNER": 2
  },
  "eventsByTenant": {
    "tenant-alpha": 28,
    "tenant-beta": 14
  },
  "avgAuthzLatencyUs": 210.5,
  "recentActivity": [
    { "timestamp": "15:10:00", "allowed": 5, "blocked": 2 }
  ]
}
```

---

## Vulnerability Scans API

### 6. Ingest Scan Results
- **Endpoint**: `POST /v1/scans`
- **Request Body**:
```json
{
  "commit": "a9f4c3b",
  "startedAt": "2026-09-30T09:45:00.000Z",
  "target": "http://sample-app:3000",
  "summary": {
    "total": 20,
    "passed": 16,
    "failed": 4
  },
  "findings": [
    {
      "method": "GET",
      "routeTemplate": "/api/v1/documents/{documentId}",
      "attackerTenant": "tenant-beta",
      "victimTenant": "tenant-alpha",
      "expectedStatus": 403,
      "actualStatus": 200,
      "severity": "HIGH"
    }
  ]
}
```
- **Response**: `201 Created`

### 7. List Scans
- **Endpoint**: `GET /v1/scans`
- **Response**: `200 OK` (Array of `ScanResult`)

### 8. Get Single Scan
- **Endpoint**: `GET /v1/scans/{scanId}`
- **Response**: `200 OK` (`ScanResult`) or `404 Not Found`
