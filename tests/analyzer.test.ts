import { describe, it, expect } from "vitest";
import { analyzeProbeResults } from "../src/analyzer/response-analyzer";
import type { ProbeResult } from "../src/probes/types";

describe("Response Analyzer & Findings Generator", () => {
  it("1. Owner access -> no finding", () => {
    const ownerProbe: ProbeResult = {
      method: "GET",
      path: "/api/documents/{id}",
      actualUrl: "http://localhost:3000/api/documents/doc-1",
      testType: "own-object",
      authenticatedUser: "user1",
      expectedAuthorizationBehavior: "allow",
      httpStatus: 200,
      objectId: "doc-1",
      objectOwner: "user1",
      objectTenant: "tenant-1",
      userTenant: "tenant-1",
      accessAllowed: true,
    };

    const findings = analyzeProbeResults([ownerProbe]);
    expect(findings).toHaveLength(0);
  });

  it("2. Cross-tenant GET with 2xx -> HIGH finding", () => {
    const crossTenantGet: ProbeResult = {
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

    const findings = analyzeProbeResults([crossTenantGet]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("HIGH");
    expect(findings[0]?.testType).toBe("cross-tenant");
  });

  it("3. Same-tenant non-owner GET with 2xx -> MEDIUM finding", () => {
    const sameTenantGet: ProbeResult = {
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

    const findings = analyzeProbeResults([sameTenantGet]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("MEDIUM");
    expect(findings[0]?.testType).toBe("same-tenant");
  });

  it("4. Cross-tenant DELETE with 2xx -> HIGH finding", () => {
    const crossTenantDelete: ProbeResult = {
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

    const findings = analyzeProbeResults([crossTenantDelete]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("HIGH");
  });

  it("5. Same-tenant non-owner DELETE with 2xx -> HIGH finding", () => {
    const sameTenantDelete: ProbeResult = {
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

    const findings = analyzeProbeResults([sameTenantDelete]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("HIGH");
  });

  it("6. Unauthorized request returning 403 -> no finding", () => {
    const denied403: ProbeResult = {
      method: "GET",
      path: "/api/documents/{id}",
      actualUrl: "http://localhost:3000/api/documents/doc-2",
      testType: "cross-tenant",
      authenticatedUser: "user1",
      expectedAuthorizationBehavior: "deny",
      httpStatus: 403,
      objectId: "doc-2",
      objectOwner: "user2",
      objectTenant: "tenant-2",
      userTenant: "tenant-1",
      accessAllowed: false,
    };

    const findings = analyzeProbeResults([denied403]);
    expect(findings).toHaveLength(0);
  });

  it("7. Unauthorized request returning 404 -> no finding", () => {
    const denied404: ProbeResult = {
      method: "GET",
      path: "/api/documents/{id}",
      actualUrl: "http://localhost:3000/api/documents/doc-2",
      testType: "cross-tenant",
      authenticatedUser: "user1",
      expectedAuthorizationBehavior: "deny",
      httpStatus: 404,
      objectId: "doc-2",
      objectOwner: "user2",
      objectTenant: "tenant-2",
      userTenant: "tenant-1",
      accessAllowed: false,
    };

    const findings = analyzeProbeResults([denied404]);
    expect(findings).toHaveLength(0);
  });

  it("8. Successful authorized owner POST/operation should not create a BOLA finding", () => {
    const ownerPost: ProbeResult = {
      method: "POST",
      path: "/api/documents/{id}",
      actualUrl: "http://localhost:3000/api/documents/doc-1",
      testType: "own-object",
      authenticatedUser: "user1",
      expectedAuthorizationBehavior: "allow",
      httpStatus: 201,
      objectId: "doc-1",
      objectOwner: "user1",
      objectTenant: "tenant-1",
      userTenant: "tenant-1",
      accessAllowed: true,
    };

    const findings = analyzeProbeResults([ownerPost]);
    expect(findings).toHaveLength(0);
  });
});
