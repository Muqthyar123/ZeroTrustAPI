import SwaggerParser from "@apidevtools/swagger-parser";

export async function loadOpenApi(url: string): Promise<any> {
  console.log("");
  console.log("Loading OpenAPI specification...");
  console.log(`URL: ${url}`);

  try {
    let spec: unknown = url;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      spec = await response.json();
    }

    const api = await SwaggerParser.parse(spec as any);

    console.log("OpenAPI specification loaded successfully.");

    return api;
  } catch (error) {
    console.error("Failed to load OpenAPI specification.");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    throw error;
  }
}