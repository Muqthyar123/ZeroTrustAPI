import { ApiClient } from "../client/api-client.js";
export async function loadFixtures(fixturesUrl, client) {
    console.log("");
    console.log("Loading test fixtures...");
    console.log(`URL: ${fixturesUrl}`);
    const response = await client.get(fixturesUrl);
    if (response.status < 200 || response.status >= 300) {
        throw new Error(`Failed to load fixtures. HTTP status: ${response.status}`);
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
//# sourceMappingURL=fixture-loader.js.map