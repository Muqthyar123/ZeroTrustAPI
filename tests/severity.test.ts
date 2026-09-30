import { describe, it, expect } from "vitest";
import { calculateSeverity } from "../src/analyzer/severity";
import type { ProbeResult } from "../src/probes/types";

describe("Severity Calculator", () => {
  it("should calculate HIGH for cross-tenant GET", () => {
    const probe: ProbeResult = {
      method: "GET",
      path: "/api/documents/{id}",
      actualUrl: "http://localhost:3000/api/documents/doc-2",
      testType: "cross-tenant",
      authenticatedUser: "user1",
      expectedAuthorizationBehavior: "deny",
      httpStatus: 200,
      objectId: "doc-2",
      objectOwner: "user2",
      objectTenant: "tenant-2",
      userTenant: "tenant-1",
      accessAllowed: true,
    };

    expect(calculateSeverity(probe)).toBe("HIGH");
  });

  it("should calculate MEDIUM for same-tenant non-owner GET", () => {
    const probe: ProbeResult = {
      method: "GET",
      path: "/api/documents/{id}",
      actualUrl: "http://localhost:3000/api/documents/doc-3",
      testType: "same-tenant",
      authenticatedUser: "user1",
      expectedAuthorizationBehavior: "deny",
      httpStatus: 200,
      objectId: "doc-3",
      objectOwner: "user3",
      objectTenant: "tenant-1",
      userTenant: "tenant-1",
      accessAllowed: true,
    };

    expect(calculateSeverity(probe)).toBe("MEDIUM");
  });

  it("should calculate HIGH for cross-tenant DELETE", () => {
    const probe: ProbeResult = {
      method: "DELETE",
      path: "/api/documents/{id}",
      actualUrl: "http://localhost:3000/api/documents/doc-2",
      testType: "cross-tenant",
      authenticatedUser: "user1",
      expectedAuthorizationBehavior: "deny",
      httpStatus: 200,
      objectId: "doc-2",
      objectOwner: "user2",
      objectTenant: "tenant-2",
      userTenant: "tenant-1",
      accessAllowed: true,
    };

    expect(calculateSeverity(probe)).toBe("HIGH");
  });

  it("should calculate HIGH for same-tenant non-owner DELETE (upgraded from MEDIUM)", () => {
    const probe: ProbeResult = {
      method: "DELETE",
      path: "/api/documents/{id}",
      actualUrl: "http://localhost:3000/api/documents/doc-3",
      testType: "write-delete",
      authenticatedUser: "user1",
      expectedAuthorizationBehavior: "deny",
      httpStatus: 200,
      objectId: "doc-3",
      objectOwner: "user3",
      objectTenant: "tenant-1",
      userTenant: "tenant-1",
      accessAllowed: true,
    };

    expect(calculateSeverity(probe)).toBe("HIGH");
  });
});
