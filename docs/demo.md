# ZeroTrustAPI Live Demonstration Walkthrough

This guide details the step-by-step presentation flow for judges and hackathon evaluators.

---

## Prerequisites & Port Allocation

| Component | Port | Role | Member |
| :--- | :--- | :--- | :--- |
| **Gateway** | `:8080` | Zero-Trust Enforcement & Reverse Proxy | Member 1 |
| **Sample App** | `:3000` | Multi-tenant backend application | Member 2 |
| **Ownership Service** | `:4000` | Resource ownership registry | Member 2 |
| **Events Service** | `:5000` | Telemetry ingestion & SSE bus | Member 4 |
| **Security Dashboard** | `:5173` | SOC Visualization UI | Member 4 |

---

## 12-Step Demo Script

### Step 1: Vulnerable Sample App (BOLA / IDOR)
- **Action**: Attacker from `tenant-beta` directly requests `GET /api/v1/documents/doc-alpha` on `:3000`.
- **Result**: `200 OK` (Unauthorized cross-tenant data leak occurs).

### Step 2: Automated Scanner Detection
- **Action**: Run Member 3's security scanner against the unprotected sample app.
- **Result**: Scanner identifies BOLA vulnerabilities on routes without token validation.

### Step 3: Dashboard Displays Failed Scan Findings
- **Action**: Open Dashboard `:5173` and navigate to **Scan Results**.
- **Result**: Highlight findings table showing `HIGH` severity breach on `GET /api/v1/documents/{documentId}` (Expected `403`, Actual `200`).

### Step 4: Zero-Trust Gateway Enabled
- **Action**: Route traffic through the Zero-Trust Gateway `:8080`.

### Step 5: Attack Blocked with 403
- **Action**: Attacker repeats `GET /api/v1/documents/doc-alpha` via `:8080`.
- **Result**: Gateway rejects request with `403 Forbidden`.

### Step 6: Gateway Emits Decision Event
- **Action**: Gateway sends `POST /v1/events` payload to the Events Service `:5000`.

### Step 7: SSE Real-Time Stream
- **Action**: Observe Dashboard without refreshing the browser.
- **Result**: Live stream pulse indicator flashes and delivers the event instantly.

### Step 8: Dashboard Displays BLOCK + Reason
- **Action**: Click on the newly arrived blocked event on the Dashboard.
- **Result**: Modal displays `BLOCK`, reason `TENANT_MISMATCH`, and human-readable explanation: *"Access was blocked because the requested object belongs to a different tenant."*

### Step 9: Valid Delegated Access
- **Action**: Submit cross-tenant request with verified delegation token.
- **Result**: Request succeeds with `200 OK`.

### Step 10: Dashboard Displays ALLOW + OK_DELEGATION
- **Action**: Observe live event feed showing green badge `ALLOW` with reason `OK_DELEGATION`.

### Step 11: Benchmark & Latency Analysis
- **Action**: Show benchmark report at `benchmark/results/comparison-report.md`.
- **Result**: Demonstrate sub-millisecond to ~1.6ms median enforcement overhead under high concurrency.

### Step 12: Architectural Limitations Review
- **Action**: Review `docs/limitations.md`.
