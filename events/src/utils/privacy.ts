// Pattern detection for sensitive data like JWTs, Bearer tokens, or passwords
const JWT_PATTERN = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
const BEARER_PATTERN = /^Bearer\s+/i;

/**
 * Validates whether a value looks like raw sensitive credentials (e.g. JWT token, Authorization header)
 */
export function isSensitiveCredential(value: string): boolean {
  if (!value) return false;
  return JWT_PATTERN.test(value.trim()) || BEARER_PATTERN.test(value.trim());
}

/**
 * Ensures forbidden fields (such as jwt, authorization, raw body, password) are absent from raw payload.
 */
export function validatePayloadPrivacy(payload: Record<string, unknown>): { valid: boolean; reason?: string } {
  const forbiddenKeys = [
    'authorization',
    'token',
    'jwt',
    'cookie',
    'body',
    'requestbody',
    'password',
    'secret',
    'authheader',
    'rawobjectid',
    'rawuserid'
  ];

  for (const key of Object.keys(payload)) {
    if (forbiddenKeys.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      return {
        valid: false,
        reason: `Privacy Violation: Forbidden property '${key}' detected in event payload. Raw headers/tokens/bodies must not be transmitted.`
      };
    }
  }

  // Check if subjectHash or objectIdHash accidentally looks like a JWT token
  if (typeof payload.subjectHash === 'string' && isSensitiveCredential(payload.subjectHash)) {
    return {
      valid: false,
      reason: 'Privacy Violation: subjectHash appears to be a raw JWT or Bearer token instead of an anonymized hash.'
    };
  }

  if (typeof payload.objectIdHash === 'string' && isSensitiveCredential(payload.objectIdHash)) {
    return {
      valid: false,
      reason: 'Privacy Violation: objectIdHash appears to contain raw credentials.'
    };
  }

  return { valid: true };
}
