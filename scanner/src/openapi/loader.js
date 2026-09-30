import SwaggerParser from "@apidevtools/swagger-parser";
export async function loadOpenApi(url) {
    console.log("");
    console.log("Loading OpenAPI specification...");
    console.log(`URL: ${url}`);
    try {
        const api = await SwaggerParser.parse(url);
        console.log("OpenAPI specification loaded successfully.");
        return api;
    }
    catch (error) {
        console.error("Failed to load OpenAPI specification.");
        if (error instanceof Error) {
            console.error(error.message);
        }
        else {
            console.error(error);
        }
        throw error;
    }
}
//# sourceMappingURL=loader.js.map