import { describe, it, expect } from "vitest";
import { parseEndpoints } from "../src/openapi/parser.js";

describe("OpenAPI Parser", () => {
  it("should parse endpoints correctly", () => {
    const openApi = {
      paths: {
        "/api/users/{userId}": {
          get: {
            operationId: "getUser",
            summary: "Get user by ID",
          },
        },
      },
    };

    const endpoints = parseEndpoints(openApi);
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]?.method).toBe("GET");
    expect(endpoints[0]?.path).toBe("/api/users/{userId}");
    expect(endpoints[0]?.parameters).toEqual(["userId"]);
  });
});
