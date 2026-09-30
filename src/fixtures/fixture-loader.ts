import { ApiClient } from "../client/api-client.js";

export interface FixtureUser {
  id: string;
  tenant_id: string;
  org_id: string;
  username?: string;
  password?: string;
  scopes?: string[];
}

export interface FixtureObject {
  id: string;
  type: string;
  owner_id?: string;
  tenant_id?: string;
  [key: string]: unknown;
}

export interface Fixtures {
  users?: FixtureUser[];
  objects?: FixtureObject[];
  [key: string]: unknown;
}

export async function loadFixtures(
  fixturesUrl: string,
  client: ApiClient
): Promise<Fixtures> {
  console.log("");
  console.log("Loading test fixtures...");
  console.log(`URL: ${fixturesUrl}`);

  const response = await client.get<Fixtures>(fixturesUrl);

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Failed to load fixtures. HTTP status: ${response.status}`
    );
  }

  const fixtures = response.data;

  if (!fixtures || typeof fixtures !== "object") {
    throw new Error("Invalid fixtures response.");
  }

  console.log("Fixtures loaded successfully.");

  if (Array.isArray(fixtures.users)) {
    console.log(`Users   : ${fixtures.users.length}`);
  }

  if (Array.isArray(fixtures.objects)) {
    console.log(`Objects : ${fixtures.objects.length}`);
  }

  return fixtures;
}