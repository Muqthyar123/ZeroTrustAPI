import { describe, it, expect } from "vitest";
import { runOwnObjectProbes } from "../src/probes/own-object";

import type { ProbeContext } from "../src/probes/types.js";
import type { ApiClient } from "../src/client/api-client.js";

describe("Probes Infrastructure", () => {
  it("should run own object probe", async () => {
    const context: ProbeContext = {
      targetUrl: "http://localhost:3000",
      endpoints: [
        {
          method: "GET",
          path: "/api/documents/{documentId}",
          parameters: ["documentId"],
        },
      ],
      users: [
        {
          id: "user-1",
          tenant_id: "tenant-1",
          org_id: "org-1",
          username: "user1",
        },
      ],
      objects: [
        {
          id: "doc-1",
          type: "document",
          owner_id: "user-1",
          tenant_id: "tenant-1",
        },
      ],
      userTokens: new Map([["user1", "mock-jwt-token"]]),
    };

    const mockClient = {
      get: async (url: string, token?: string) => ({
        status: 200,
        data: { id: "doc-1", title: "Test Doc" },
        headers: new Headers(),
      }),
    } as unknown as ApiClient;

    const results = await runOwnObjectProbes(context, mockClient);
    expect(results).toHaveLength(1);
    expect(results[0]?.testType).toBe("own-object");
    expect(results[0]?.accessAllowed).toBe(true);
    expect(results[0]?.expectedAuthorizationBehavior).toBe("allow");
  });
});
