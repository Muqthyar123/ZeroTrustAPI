# ZeroTrustAPI Scanner (`zerotrust-scanner`)

The **ZeroTrustAPI Scanner** is an automated API security scanner designed to discover API endpoints from OpenAPI specifications, load test user/object fixtures, perform multi-method authorization probing, analyze responses for **Broken Object Level Authorization (BOLA / OWASP API1:2023)** vulnerabilities, calculate findings severity, and submit structured scan reports to an Events Service.

---

## Production CLI Usage

The production CLI interface accepts target configuration flags:

```bash
zerotrust scan --openapi <url> --fixtures <url> --target <url> --report <url>
```

### Options:
- `--openapi <url>`: URL of the OpenAPI 3.0 specification (`/openapi.json`)
- `--fixtures <url>`: URL of the test user and object fixtures (`/_test/fixtures`)
- `--target <url>`: Base URL of the target API service
- `--report <url>`: Base URL of the report Events Service (`http://...:5000`)

---

## Local Development & Testing Commands

```bash
# Compile TypeScript code to dist/
npm run build

# Run Unit Test Suites (Parser, Probes, Severity, Analyzer, Report Builder)
npm run test:run

# Run Scanner-side Mock End-to-End (E2E) Integration Harness
npm run test:e2e

# Run CLI in dev mode
npm run dev -- scan --openapi <url> --fixtures <url> --target <url> --report <url>
```

---

## CI/CD Pipeline (`.github/workflows/scanner-ci.yml`)

The repository includes an automated GitHub Actions workflow configured at `.github/workflows/scanner-ci.yml`.

### CI Pipeline Stages:
1. **Checkout**: Checks out source code.
2. **Setup Node.js**: Configures Node.js 20 with npm caching.
3. **Install Dependencies**: Executes `npm ci`.
4. **Build Scanner**: Executes `npm run build` (`tsc`).
5. **Run Unit Tests**: Executes `npm run test:run` (22 passing unit tests).
6. **Run Mock E2E Tests**: Executes `npm run test:e2e` (4 passing E2E integration tests).
7. **Artifact Upload**: Uploads `dist/` build artifacts for inspection.

---

## Scanner-Side E2E Test Harness

The scanner includes an isolated, mock-based E2E test harness located in `tests/e2e/`:
- **[`tests/e2e/mock-sample-app.ts`](file:///c:/Users/valla/OneDrive/Desktop/Scanner/tests/e2e/mock-sample-app.ts)**: Simulates target API endpoints, fixture loading, JWT login, and resource authorization behavior.
- **[`tests/e2e/mock-events-service.ts`](file:///c:/Users/valla/OneDrive/Desktop/Scanner/tests/e2e/mock-events-service.ts)**: Simulates the Events Service (`POST /v1/scans`) to verify report submission and credential sanitization.
- **[`tests/e2e/scanner-e2e.test.ts`](file:///c:/Users/valla/OneDrive/Desktop/Scanner/tests/e2e/scanner-e2e.test.ts)**: Executes the compiled scanner CLI binary (`node dist/cli.js scan ...`) against dynamic localhost ports.

### E2E Modes Verified:
- **Vulnerable Mode**: Simulates an unauthorized target app. The scanner detects BOLA findings, calculates `HIGH` severity findings, posts a report to Events, and exits with code `1` (which the E2E test wrapper asserts as expected behavior).
- **Secure Mode**: Simulates a properly authorized target app. The scanner detects `0` findings, posts a report to Events, and exits with code `0`.
- **Sanitization & Resilience**: Confirms that raw passwords and JWT tokens are not exposed in the scan report, and verifies proper error handling when the Events service is offline.

---

## Future Real Backend Integration (Planned)

When the external ZeroTrustAPI backend services are integrated in future phases, the real microservices stack will run on the following designated ports:

| Service | Host Port | Target Contract |
| :--- | :--- | :--- |
| **Sample App** | `http://localhost:3000` | `/openapi.json`, `/_test/fixtures`, `/auth/login`, `/api/*` |
| **Events Service** | `http://localhost:5000` | `POST /v1/scans`, `GET /v1/scans/{scanId}` |
| **Gateway** | `http://localhost:8080` | Proxy Gateway |
| **Ownership Service** | `http://localhost:4000` | Object Ownership Service |
| **Dashboard** | `http://localhost:5173` | Web UI |
| **Redis** | `localhost:6379` | Token & Session Cache |

### Insertion Point for Live Backend E2E Scan in CI:
Once the real backend stack is available, the live E2E step can be added to `.github/workflows/scanner-ci.yml` after service readiness:

```yaml
- name: Run Live E2E Scan against Real Backend Stack
  run: |
    npm run start -- -- scan \
      --openapi http://localhost:3000/openapi.json \
      --fixtures http://localhost:3000/_test/fixtures \
      --target http://localhost:3000 \
      --report http://localhost:5000
```
