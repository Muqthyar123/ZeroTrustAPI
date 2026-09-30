import { ApiClient } from "./client/api-client.js";
import { loadFixtures } from "./fixtures/fixture-loader.js";
import { Command } from "commander";
import { createConfig } from "./config.js";
import { loadOpenApi } from "./openapi/loader.js";
import { parseEndpoints } from "./openapi/parser.js";
import { printEndpoints } from "./openapi/endpoint-discovery.js";
const program = new Command();
program
    .name("zerotrust")
    .description("ZeroTrustAPI Security Scanner")
    .version("1.0.0");
program
    .command("scan")
    .description("Scan an API for authorization vulnerabilities")
    .requiredOption("--openapi <url>", "OpenAPI specification URL")
    .requiredOption("--fixtures <url>", "Test fixtures URL")
    .requiredOption("--target <url>", "Target API URL")
    .requiredOption("--report <url>", "Report service URL")
    .action(async (options) => {
    try {
        const config = createConfig(options);
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
        const fixtures = await loadFixtures(config.fixturesUrl, client);
        console.log("");
        console.log("Fixture Summary");
        console.log("======================================");
        console.log(JSON.stringify(fixtures, null, 2));
        console.log("======================================");
    }
    catch (error) {
        console.error("");
        console.error("Scanner failed.");
        process.exitCode = 1;
    }
});
program.parseAsync();
//# sourceMappingURL=cli.js.map