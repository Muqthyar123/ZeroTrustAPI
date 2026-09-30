import type { ParsedEndpoint } from "../openapi/parser.js";
import type { FixtureUser, FixtureObject } from "../fixtures/fixture-loader.js";

export type TestType = "own-object" | "same-tenant" | "cross-tenant" | "nested" | "write-delete";

export interface ProbeResult {
  method: string;
  path: string;
  actualUrl: string;
  testType: TestType;
  authenticatedUser: string;
  expectedAuthorizationBehavior: "allow" | "deny";
  httpStatus: number;
  responseInfo?: unknown;
  objectId?: string | undefined;
  objectOwner?: string | undefined;
  objectTenant?: string | undefined;
  userTenant?: string | undefined;
  accessAllowed: boolean;
}

export interface ProbeContext {
  targetUrl: string;
  endpoints: ParsedEndpoint[];
  users: FixtureUser[];
  objects: FixtureObject[];
  userTokens: Map<string, string>; // username -> JWT token
}
