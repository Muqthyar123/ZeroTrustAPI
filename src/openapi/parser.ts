export interface ParsedEndpoint {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  parameters: string[];
}

export function parseEndpoints(openApi: any): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];

  const paths = openApi.paths ?? {};

  for (const [path, pathItem] of Object.entries(paths)) {
    const methods = [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "options",
      "head",
    ];

    for (const method of methods) {
      const operation = (pathItem as any)[method];

      if (!operation) {
        continue;
      }

      const parameters = extractPathParameters(path);

      endpoints.push({
        method: method.toUpperCase(),
        path,
        operationId: operation.operationId,
        summary: operation.summary,
        parameters,
      });
    }
  }

  return endpoints;
}

function extractPathParameters(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);

  if (!matches) {
    return [];
  }

  return matches.map((match) => match.slice(1, -1));
}