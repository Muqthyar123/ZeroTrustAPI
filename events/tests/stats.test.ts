import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { eventStore } from '../src/storage/event.store.js';

describe('Stats API Endpoints', () => {
  const app = buildApp();

  beforeEach(async () => {
    await eventStore.clear();
  });

  it('GET /v1/stats - should return zeroed stats when store is empty', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/stats' });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.totalEvents).toBe(0);
    expect(data.allowed).toBe(0);
    expect(data.blocked).toBe(0);
    expect(data.blockRate).toBe(0);
    expect(data.avgAuthzLatencyUs).toBe(0);
  });

  it('GET /v1/stats - should accurately aggregate metrics from stored events', async () => {
    // 2 ALLOW, 1 BLOCK
    await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: {
        method: 'GET',
        routeTemplate: '/api/v1/resource',
        resourceType: 'res',
        objectIdHash: 'h1',
        subjectHash: 's1',
        tenantId: 'tenant-a',
        objectTenantId: 'tenant-a',
        decision: 'ALLOW',
        reason: 'OK_OWNER',
        authzLatencyUs: 100
      }
    });

    await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: {
        method: 'GET',
        routeTemplate: '/api/v1/resource',
        resourceType: 'res',
        objectIdHash: 'h2',
        subjectHash: 's2',
        tenantId: 'tenant-a',
        objectTenantId: 'tenant-a',
        decision: 'ALLOW',
        reason: 'OK_TENANT_SCOPE',
        authzLatencyUs: 200
      }
    });

    await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: {
        method: 'GET',
        routeTemplate: '/api/v1/resource',
        resourceType: 'res',
        objectIdHash: 'h3',
        subjectHash: 's3',
        tenantId: 'tenant-b',
        objectTenantId: 'tenant-a',
        decision: 'BLOCK',
        reason: 'TENANT_MISMATCH',
        authzLatencyUs: 300
      }
    });

    const res = await app.inject({ method: 'GET', url: '/v1/stats' });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);

    expect(data.totalEvents).toBe(3);
    expect(data.allowed).toBe(2);
    expect(data.blocked).toBe(1);
    expect(data.blockRate).toBe(33.33);
    expect(data.avgAuthzLatencyUs).toBe(200);
    expect(data.eventsByReason.OK_OWNER).toBe(1);
    expect(data.eventsByReason.OK_TENANT_SCOPE).toBe(1);
    expect(data.eventsByReason.TENANT_MISMATCH).toBe(1);
    expect(data.eventsByTenant['tenant-a']).toBe(2);
    expect(data.eventsByTenant['tenant-b']).toBe(1);
    expect(data.recentActivity.length).toBeGreaterThan(0);
  });
});
