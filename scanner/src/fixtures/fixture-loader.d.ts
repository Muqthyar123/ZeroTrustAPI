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
export declare function loadFixtures(fixturesUrl: string, client: ApiClient): Promise<Fixtures>;
//# sourceMappingURL=fixture-loader.d.ts.map