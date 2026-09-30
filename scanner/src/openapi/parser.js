export function parseEndpoints(openApi) {
    const endpoints = [];
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
            const operation = pathItem[method];
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
function extractPathParameters(path) {
    const matches = path.match(/\{([^}]+)\}/g);
    if (!matches) {
        return [];
    }
    return matches.map((match) => match.slice(1, -1));
}
//# sourceMappingURL=parser.js.map