import type { ParsedEndpoint } from "./parser.js";

export function printEndpoints(endpoints: ParsedEndpoint[]): void {
  console.log("");
  console.log("Discovered API Endpoints");
  console.log("======================================");

  if (endpoints.length === 0) {
    console.log("No endpoints found.");
    return;
  }

  for (const endpoint of endpoints) {
    console.log(
      `${endpoint.method.padEnd(7)} ${endpoint.path}`
    );

    if (endpoint.parameters.length > 0) {
      console.log(
        `         Parameters: ${endpoint.parameters.join(", ")}`
      );
    }

    if (endpoint.summary) {
      console.log(`         ${endpoint.summary}`);
    }
  }

  console.log("======================================");
  console.log(`Total endpoints: ${endpoints.length}`);
}