const { findRouteMetadata } = require("../metadata/routeMetadata");

/**
 * Normalizes a URL path string by removing query parameters and hash fragments.
 *
 * @param {string} rawUrl - The raw request URL string.
 * @returns {string} Clean path string.
 */
function normalizePath(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "/";
  }
  const qIndex = rawUrl.indexOf("?");
  const pathWithoutQuery = qIndex !== -1 ? rawUrl.substring(0, qIndex) : rawUrl;
  const hashIndex = pathWithoutQuery.indexOf("#");
  return hashIndex !== -1 ? pathWithoutQuery.substring(0, hashIndex) : pathWithoutQuery;
}

/**
 * Extracts the API resource name from a normalized path.
 * Considers '/api' as the API prefix and identifies the first path segment after it.
 * Returns null if no resource segment is present.
 *
 * @param {string} path - The normalized URL path.
 * @returns {string|null} The resource name or null.
 */
function extractResource(path) {
  if (!path || typeof path !== "string") {
    return null;
  }

  // Split path into non-empty segments, handling multiple or trailing slashes
  const segments = path.split("/").filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return null;
  }

  // If path starts with 'api', resource is the segment immediately after 'api'
  if (segments[0] === "api") {
    return segments.length > 1 ? segments[1] : null;
  }

  // Fallback for paths without '/api' prefix
  return segments[0] || null;
}

/**
 * Extracts the object ID from a normalized API path.
 * For '/api/resource/objectId/...', extracts the segment immediately following the resource name.
 * Returns null if no object ID segment exists in the path.
 *
 * @param {string} path - The normalized URL path.
 * @returns {string|null} The extracted object ID or null.
 */
function extractObjectId(path) {
  if (!path || typeof path !== "string") {
    return null;
  }

  const segments = path.split("/").filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return null;
  }

  if (segments[0] === "api") {
    return segments.length > 2 ? segments[2] : null;
  }

  return segments.length > 1 ? segments[1] : null;
}

/**
 * Extracts object ID parameter value based on matched route metadata parameter placeholder.
 *
 * @param {Object|null} routeMetadata
 * @param {string} path
 * @returns {string|null}
 */
function extractFromRouteMetadata(routeMetadata, path) {
  if (!routeMetadata || !routeMetadata.objectIdParam || !path || !routeMetadata.pathPattern) {
    return null;
  }

  const patternSegments = routeMetadata.pathPattern.split("/").filter((s) => s.length > 0);
  const pathSegments = path.split("/").filter((s) => s.length > 0);

  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const targetParam = `{${routeMetadata.objectIdParam}}`;
  const paramIndex = patternSegments.indexOf(targetParam);

  if (paramIndex !== -1 && pathSegments[paramIndex]) {
    return pathSegments[paramIndex];
  }

  return null;
}

/**
 * Builds a clean, reusable request context for an authenticated request.
 * Captures HTTP method, normalized request path, detected resource name, extracted object ID, verified request.user payload, and route metadata.
 * Excludes sensitive credentials such as raw Authorization headers or tokens.
 *
 * @param {import('fastify').FastifyRequest} request - Fastify request object.
 * @returns {Object} Clean request context object.
 */
function buildRequestContext(request) {
  if (!request) {
    throw new Error("Fastify request object is required to build request context");
  }

  const method = (request.method || "GET").toUpperCase();
  const rawUrl = request.url || request.raw?.url || "/";
  const path = normalizePath(rawUrl);
  const routeMetadata = findRouteMetadata(method, path);

  const resource = routeMetadata?.resource || extractResource(path);
  const objectId = extractFromRouteMetadata(routeMetadata, path) || extractObjectId(path);

  return {
    method,
    path,
    resource,
    objectId,
    user: request.user || null,
    routeMetadata
  };
}

module.exports = {
  buildRequestContext,
  normalizePath,
  extractResource,
  extractObjectId,
  extractFromRouteMetadata
};

