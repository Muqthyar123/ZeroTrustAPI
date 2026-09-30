import { describe, it, expect } from 'vitest';
import { validatePayloadPrivacy } from '../src/utils/privacy.js';

describe('Privacy and Anonymization Invariants', () => {
  it('should accept properly anonymized and hashed payload', () => {
    const valid = {
      method: 'GET',
      routeTemplate: '/api/v1/orders/{orderId}',
      resourceType: 'order',
      objectIdHash: 'a9f4c3b52d384061a94fa467efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
      subjectHash: '8f72a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
      tenantId: 'tenant-123',
      objectTenantId: 'tenant-123',
      decision: 'ALLOW',
      reason: 'OK_OWNER',
      authzLatencyUs: 120
    };

    const result = validatePayloadPrivacy(valid);
    expect(result.valid).toBe(true);
  });

  it('should reject payload with Authorization or Token fields', () => {
    const invalid = {
      method: 'GET',
      authorization: 'Bearer secret_token_123',
      objectIdHash: 'hash1',
      subjectHash: 'hash2'
    };

    const result = validatePayloadPrivacy(invalid);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Forbidden property');
  });

  it('should reject payload with raw request body or password', () => {
    const invalid = {
      method: 'POST',
      requestBody: '{"amount": 100}',
      password: 'password123'
    };

    const result = validatePayloadPrivacy(invalid);
    expect(result.valid).toBe(false);
  });

  it('should reject if subjectHash or objectIdHash is actually a raw JWT token', () => {
    const invalid = {
      method: 'GET',
      objectIdHash: 'hash1',
      subjectHash: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgN_p_m_c_s_z_b_y'
    };

    const result = validatePayloadPrivacy(invalid);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('subjectHash appears to be a raw JWT');
  });

  it('should reject payload with cookie, rawObjectId or rawUserId', () => {
    const invalidCookie = {
      method: 'GET',
      cookie: 'session_id=12345',
      objectIdHash: 'hash1',
      subjectHash: 'hash2'
    };
    expect(validatePayloadPrivacy(invalidCookie).valid).toBe(false);

    const invalidRawId = {
      method: 'GET',
      rawObjectId: 'order-12345',
      rawUserId: 'user-999',
      objectIdHash: 'hash1',
      subjectHash: 'hash2'
    };
    expect(validatePayloadPrivacy(invalidRawId).valid).toBe(false);
  });
});
