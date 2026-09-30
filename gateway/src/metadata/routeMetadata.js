/**
 * Server-controlled route metadata registry.
 * Maps API operations to their resource, route metadata, and required authorization scopes.
 */
const DEFAULT_ROUTE_REGISTRY = [
  {
    method: "GET",
    pathPattern: "/api/test",
    resource: "test",
    objectIdParam: null,
    requiredScope: "orders:read"
  },
  {
    method: "GET",
    pathPattern: "/api/orders",
    resource: "orders",
    objectIdParam: null,
    requiredScope: "orders:read"
  },
  {
    method: "POST",
    pathPattern: "/api/orders",
    resource: "orders",
    objectIdParam: null,
    requiredScope: "orders:write"
  },
  {
    method: "GET",
    pathPattern: "/api/orders/{orderId}",
    resource: "orders",
    objectIdParam: "orderId",
    requiredScope: "orders:read"
  },
  {
    method: "DELETE",
    pathPattern: "/api/orders/{orderId}",
    resource: "orders",
    objectIdParam: "orderId",
    requiredScope: "orders:write"
  },
  {
    method: "GET",
    pathPattern: "/api/invoices/{invoiceId}",
    resource: "invoices",
    objectIdParam: "invoiceId",
    requiredScope: "invoices:read"
  },
  {
    method: "GET",
    pathPattern: "/api/users/{userId}/documents/{documentId}",
    resource: "documents",
    objectIdParam: "documentId",
    requiredScope: "documents:read"
  },
  {
    method: "GET",
    pathPattern: "/api/users/{userId}",
    resource: "users",
    objectIdParam: "userId",
    requiredScope: "users:read"
  }
];

/**
 * Strips query strings and hash fragments from a URL path.
 *
 * @param {string} rawUrl - The raw request URL string.
 * @returns {string} Clean path string.
 */
function cleanPath(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "/";
  }
  const qIndex = rawUrl.indexOf("?");
  const pathWithoutQuery = qIndex !== -1 ? rawUrl.substring(0, qIndex) : rawUrl;
  const hashIndex = pathWithoutQuery.indexOf("#");
  return hashIndex !== -1 ? pathWithoutQuery.substring(0, hashIndex) : pathWithoutQuery;
}

/**
 * Checks if a normalized path matches a route pattern with parameter placeholders (e.g., {orderId}).
 *
 * @param {string} pattern - The registered route pattern (e.g., "/api/orders/{orderId}").
 * @param {string} path - The normalized request path (e.g., "/api/orders/201").
 * @returns {boolean} True if the path matches the pattern.
 */
function matchPathPattern(pattern, path) {
  const patternSegments = pattern.split("/").filter((s) => s.length > 0);
  const pathSegments = path.split("/").filter((s) => s.length > 0);

  if (patternSegments.length !== pathSegments.length) {
    return false;
  }

  for (let i = 0; i < patternSegments.length; i++) {
    const pSeg = patternSegments[i];
    const reqSeg = pathSegments[i];

    if (pSeg.startsWith("{") && pSeg.endsWith("}")) {
      if (!reqSeg || reqSeg.length === 0) {
        return false;
      }
      continue;
    }

    if (pSeg !== reqSeg) {
      return false;
    }
  }

  return true;
}

/**
 * Looks up route metadata from the server-controlled registry matching the HTTP method and request path.
 * Returns null if no matching route pattern is found.
 *
 * @param {string} method - HTTP method (e.g., "GET").
 * @param {string} rawOrNormalizedPath - Raw URL or normalized path string.
 * @param {Array<Object>} [registry=DEFAULT_ROUTE_REGISTRY] - Route registry array.
 * @returns {Object|null} Matching route metadata or null.
 */
function findRouteMetadata(method, rawOrNormalizedPath, registry = DEFAULT_ROUTE_REGISTRY) {
  if (!method || !rawOrNormalizedPath) {
    return null;
  }

  const normalizedMethod = method.toUpperCase();
  const normalizedPath = cleanPath(rawOrNormalizedPath);

  for (const entry of registry) {
    if (entry.method.toUpperCase() !== normalizedMethod) {
      continue;
    }

    if (matchPathPattern(entry.pathPattern, normalizedPath)) {
      return {
        method: entry.method,
        pathPattern: entry.pathPattern,
        resource: entry.resource,
        objectIdParam: entry.objectIdParam,
        requiredScope: entry.requiredScope || null
      };
    }
  }

  return null;
}

module.exports = {
  findRouteMetadata,
  matchPathPattern,
  DEFAULT_ROUTE_REGISTRY
};
