/**
 * Validates whether a value looks like raw sensitive credentials (e.g. JWT token, Authorization header)
 */
export declare function isSensitiveCredential(value: string): boolean;
/**
 * Ensures forbidden fields (such as jwt, authorization, raw body, password) are absent from raw payload.
 */
export declare function validatePayloadPrivacy(payload: Record<string, unknown>): {
    valid: boolean;
    reason?: string;
};
