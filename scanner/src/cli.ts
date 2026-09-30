import { ApiClient } from "./client/api-client.js";
import { loadFixtures } from "./fixtures/fixture-loader.js";
import { Command } from "commander";
import { login } from "./auth/login.js";
import { decodeJwt } from "./auth/jwt.js";
import { createConfig } from "./config.js";
import { loadOpenApi } from "./openapi/loader.js";
import { parseEndpoints } from "./openapi/parser.js";
import { printEndpoints } from "./openapi/endpoint-discovery.js";

import type { ProbeContext } from "./probes/types.js";
import { runOwnObjectProbes } from "./probes/own-object.js";
import { runCrossTenantProbes } from "./probes/cross-tenant.js";
import { runSameTenantProbes } from "./probes/same-tenant.js";
import { runNestedProbes } from "./probes/nested.js";
import { runWriteDeleteProbes } from "./probes/write-delete.js";
import { analyzeProbeResults } from "./analyzer/response-analyzer.js";
import { buildScanReport } from "./report/report-builder.js";
import { submitScanReport } from "./report/events-client.js";




const program = new Command();

program
  .name("zerotrust")
  .description("ZeroTrustAPI Security Scanner")
  .version("1.0.0");

program
  .command("scan [openapiPos] [fixturesPos] [targetPos] [reportPos]")
  .description("Scan an API for authorization vulnerabilities")
  .option("--openapi <url>", "OpenAPI specification URL")
  .option("--fixtures <url>", "Test fixtures URL")
  .option("--target <url>", "Target API URL")
  .option("--report <url>", "Report service URL")
  .action(async (openapiPos, fixturesPos, targetPos, reportPos, options) => {
    try {
      const rawOpenapi = options.openapi || openapiPos;
      const rawFixtures = options.fixtures || fixturesPos;
      const rawTarget = options.target || targetPos;
      const rawReport = options.report || reportPos;

      if (!rawOpenapi || !rawFixtures || !rawTarget || !rawReport) {
        throw new Error(
          "Missing required options. Usage: zerotrust scan --openapi <url> --fixtures <url> --target <url> --report <url>"
        );
      }

      const config = createConfig({
        openapi: rawOpenapi,
        fixtures: rawFixtures,
        target: rawTarget,
        report: rawReport,
      });
      const client = new ApiClient(config.timeoutMs);


      console.log("");
      console.log("======================================");
      console.log("        ZeroTrustAPI Scanner");
      console.log("======================================");
      console.log("");

      console.log("Configuration:");
      console.log("--------------------------------------");
      console.log(`OpenAPI  : ${config.openapiUrl}`);
      console.log(`Fixtures : ${config.fixturesUrl}`);
      console.log(`Target   : ${config.targetUrl}`);
      console.log(`Report   : ${config.reportUrl}`);
      console.log(`Timeout  : ${config.timeoutMs} ms`);
      console.log("--------------------------------------");

      const openApi = await loadOpenApi(config.openapiUrl);

      const endpoints = parseEndpoints(openApi);

      printEndpoints(endpoints);
      const fixtures = await loadFixtures(
  config.fixturesUrl,
  client
);
if (!Array.isArray(fixtures.users)) {
  throw new Error(
    "Fixtures do not contain a users array."
  );
}

if (fixtures.users.length === 0) {
  throw new Error(
    "No users found in fixtures."
  );
}

console.log("");
console.log("Authentication");
console.log("======================================");

const authenticatedUsers = [];

for (const user of fixtures.users) {
  if (!user.username || !user.password) {
    console.log(
      `Skipping ${user.id}: username/password not available.`
    );
    continue;
  }

  const token = await login(
    config.targetUrl,
    {
      username: user.username,
      password: user.password,
    },
    client
  );

  const claims = decodeJwt(token);

  authenticatedUsers.push({
    username: user.username,
    token,
    claims,
  });

  console.log("JWT claims:");
  console.log(JSON.stringify(claims, null, 2));
}

console.log("======================================");
console.log("");
console.log("Fixture Summary");
console.log("======================================");
console.log(JSON.stringify(fixtures, null, 2));
console.log("======================================");

const userTokens = new Map<string, string>();
for (const user of authenticatedUsers) {
  userTokens.set(user.username, user.token);
}

const probeContext: ProbeContext = {
  targetUrl: config.targetUrl,
  endpoints,
  users: fixtures.users,
  objects: fixtures.objects ?? [],
  delegations: fixtures.delegations ?? [],
  userTokens,
};

console.log("");
console.log("Executing BOLA Probes...");
console.log("======================================");

const startTime = Date.now();
const startedAt = new Date(startTime).toISOString();

const ownObjectResults = await runOwnObjectProbes(probeContext, client);
const crossTenantResults = await runCrossTenantProbes(probeContext, client);
const sameTenantResults = await runSameTenantProbes(probeContext, client);
const nestedResults = await runNestedProbes(probeContext, client);
const writeDeleteResults = await runWriteDeleteProbes(probeContext, client);

const endTime = Date.now();
const completedAt = new Date(endTime).toISOString();
const durationMs = endTime - startTime;

const allResults = [
  ...ownObjectResults,
  ...crossTenantResults,
  ...sameTenantResults,
  ...nestedResults,
  ...writeDeleteResults,
];

console.log(`Executed ${allResults.length} probes in total.`);
console.log(`- Own Object   : ${ownObjectResults.length}`);
console.log(`- Cross Tenant : ${crossTenantResults.length}`);
console.log(`- Same Tenant  : ${sameTenantResults.length}`);
console.log(`- Nested       : ${nestedResults.length}`);
console.log(`- Write/Delete : ${writeDeleteResults.length}`);
console.log("======================================");

const findings = analyzeProbeResults(allResults);

const report = buildScanReport({
  openapiUrl: config.openapiUrl,
  targetUrl: config.targetUrl,
  probeResults: allResults,
  findings,
  startedAt,
  completedAt,
  durationMs,
  scannerVersion: "1.0.0",
});

console.log("");
console.log("======================================");
console.log("ZeroTrustAPI Scan Summary");
console.log("======================================");
console.log(`Probes    : ${report.summary.totalProbes}`);
console.log(`Findings  : ${report.summary.totalFindings}`);
console.log(`HIGH      : ${report.summary.highFindings}`);
console.log(`MEDIUM    : ${report.summary.mediumFindings}`);
console.log(`LOW       : ${report.summary.lowFindings}`);
console.log(`Status    : ${report.summary.status}`);
console.log("======================================");
if (findings.length > 0) {
  console.log("Findings Details:");
  for (const f of findings) {
    console.log(`- [${f.severity}] ${f.method} ${f.path} (User: ${f.authenticatedUser}, Expected: ${f.expectedAuthorizationBehavior}, Actual HTTP: ${f.httpStatus}) -> ${f.description}`);
  }
  console.log("======================================");
}
console.log("");

try {
  const eventsResponse = await submitScanReport(config.reportUrl, report, client);
  console.log("Scan report submitted successfully.");
  const scanId = eventsResponse.scanId ?? eventsResponse.id ?? "N/A";
  console.log(`Scan ID: ${scanId}`);
} catch (error) {
  console.error("Failed to submit scan report.");
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exitCode = 1;
}

if (findings.length > 0) {
  process.exitCode = 1;
}



    } catch (error) {
      console.error("");
      console.error("Scanner failed.");

      process.exitCode = 1;
    }
  });

program.parseAsync();