import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { eventStore } from '../src/storage/event.store.js';

describe('Events API Endpoints', () => {
  const app = buildApp();

  beforeEach(async () => {
    await eventStore.clear();
  });

  it('POST /v1/events - should successfully record a valid security event', async () => {
    const payload = {
      method: 'GET',
      routeTemplate: '/api/v1/documents/{documentId}',
      resourceType: 'document',
      objectIdHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
      subjectHash: 'b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78',
      tenantId: 'tenant-alpha',
      objectTenantId: 'tenant-alpha',
      decision: 'ALLOW',
      reason: 'OK_OWNER',
      authzLatencyUs: 250
    };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.decisionId).toBeDefined();
    expect(body.decisionId).toMatch(/^dec_/);
    expect(body.decision).toBe('ALLOW');
    expect(body.reason).toBe('OK_OWNER');
    expect(body.tenantId).toBe('tenant-alpha');
  });

  it('POST /v1/events - should reject invalid decision or reason values', async () => {
    const invalidPayload = {
      method: 'GET',
      routeTemplate: '/api/v1/documents/{documentId}',
      resourceType: 'document',
      objectIdHash: 'hash1',
      subjectHash: 'hash2',
      tenantId: 'tenant-alpha',
      objectTenantId: 'tenant-alpha',
      decision: 'PERMIT', // Invalid enum
      reason: 'OK_OWNER',
      authzLatencyUs: 250
    };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: invalidPayload
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /v1/events - should reject privacy-violating payloads containing JWT or passwords', async () => {
    const privacyViolationPayload = {
      method: 'GET',
      routeTemplate: '/api/v1/documents/{documentId}',
      resourceType: 'document',
      objectIdHash: 'hash1',
      subjectHash: 'hash2',
      tenantId: 'tenant-alpha',
      objectTenantId: 'tenant-alpha',
      decision: 'ALLOW',
      reason: 'OK_OWNER',
      authzLatencyUs: 250,
      jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M'
    };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: privacyViolationPayload
    });

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body).message).toContain('Privacy Violation');
  });

  it('GET /v1/events - should list events and support decision & tenant filtering and limit', async () => {
    // Seed test events
    await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: {
        method: 'GET',
        routeTemplate: '/api/v1/orders/{orderId}',
        resourceType: 'order',
        objectIdHash: 'hash1',
        subjectHash: 'sub1',
        tenantId: 'tenant-alpha',
        objectTenantId: 'tenant-alpha',
        decision: 'ALLOW',
        reason: 'OK_OWNER',
        authzLatencyUs: 150
      }
    });

    await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: {
        method: 'GET',
        routeTemplate: '/api/v1/orders/{orderId}',
        resourceType: 'order',
        objectIdHash: 'hash2',
        subjectHash: 'sub2',
        tenantId: 'tenant-beta',
        objectTenantId: 'tenant-alpha',
        decision: 'BLOCK',
        reason: 'TENANT_MISMATCH',
        authzLatencyUs: 180
      }
    });

    // 1. Fetch all
    const resAll = await app.inject({ method: 'GET', url: '/v1/events' });
    expect(resAll.statusCode).toBe(200);
    const all = JSON.parse(resAll.body);
    expect(all.length).toBe(2);

    // 2. Filter by decision=BLOCK
    const resBlocked = await app.inject({ method: 'GET', url: '/v1/events?decision=BLOCK' });
    expect(resBlocked.statusCode).toBe(200);
    const blocked = JSON.parse(resBlocked.body);
    expect(blocked.length).toBe(1);
    expect(blocked[0].decision).toBe('BLOCK');

    // 3. Filter by tenant=tenant-alpha
    const resTenant = await app.inject({ method: 'GET', url: '/v1/events?tenant=tenant-alpha' });
    expect(resTenant.statusCode).toBe(200);
    const tenantEvents = JSON.parse(resTenant.body);
    expect(tenantEvents.length).toBe(2); // one where tenantId is alpha, one where objectTenantId is alpha

    // 4. Limit=1
    const resLimit = await app.inject({ method: 'GET', url: '/v1/events?limit=1' });
    expect(resLimit.statusCode).toBe(200);
    expect(JSON.parse(resLimit.body).length).toBe(1);
  });

  it('GET /v1/events/:decisionId - should retrieve specific event or 404', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: {
        method: 'POST',
        routeTemplate: '/api/v1/checkout',
        resourceType: 'checkout',
        objectIdHash: 'hash1',
        subjectHash: 'sub1',
        tenantId: 'tenant-gamma',
        objectTenantId: 'tenant-gamma',
        decision: 'ALLOW',
        reason: 'OK_DELEGATION',
        authzLatencyUs: 300
      }
    });

    const created = JSON.parse(postRes.body);
    const getRes = await app.inject({ method: 'GET', url: `/v1/events/${created.decisionId}` });
    expect(getRes.statusCode).toBe(200);
    expect(JSON.parse(getRes.body).decisionId).toBe(created.decisionId);

    const notFoundRes = await app.inject({ method: 'GET', url: '/v1/events/non_existent_id' });
    expect(notFoundRes.statusCode).toBe(404);
  });
});
