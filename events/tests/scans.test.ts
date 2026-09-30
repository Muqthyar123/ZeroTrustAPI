import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { scanStore } from '../src/storage/scan.store.js';

describe('Scans API Endpoints', () => {
  const app = buildApp();

  beforeEach(async () => {
    await scanStore.clear();
  });

  it('POST /v1/scans - should record valid scan results with findings', async () => {
    const scanPayload = {
      commit: 'c7d8e9f',
      target: 'http://sample-app:3000',
      summary: {
        total: 10,
        passed: 8,
        failed: 2
      },
      findings: [
        {
          method: 'GET',
          routeTemplate: '/api/v1/documents/{documentId}',
          attackerTenant: 'tenant-beta',
          victimTenant: 'tenant-alpha',
          expectedStatus: 403,
          actualStatus: 200,
          severity: 'HIGH'
        },
        {
          method: 'DELETE',
          routeTemplate: '/api/v1/orders/{orderId}',
          attackerTenant: 'tenant-gamma',
          victimTenant: 'tenant-beta',
          expectedStatus: 403,
          actualStatus: 200,
          severity: 'MEDIUM'
        }
      ]
    };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/scans',
      payload: scanPayload
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.scanId).toBeDefined();
    expect(body.scanId).toMatch(/^scan_/);
    expect(body.summary.failed).toBe(2);
    expect(body.findings.length).toBe(2);
  });

  it('GET /v1/scans and GET /v1/scans/:scanId - should list scans and fetch details', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/v1/scans',
      payload: {
        commit: '1234567',
        target: 'http://sample-app:3000',
        summary: { total: 5, passed: 5, failed: 0 },
        findings: []
      }
    });
    const created = JSON.parse(postRes.body);

    const listRes = await app.inject({ method: 'GET', url: '/v1/scans' });
    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body);
    expect(list.length).toBe(1);

    const getRes = await app.inject({ method: 'GET', url: `/v1/scans/${created.scanId}` });
    expect(getRes.statusCode).toBe(200);
    expect(JSON.parse(getRes.body).scanId).toBe(created.scanId);

    const notFoundRes = await app.inject({ method: 'GET', url: '/v1/scans/missing_scan' });
    expect(notFoundRes.statusCode).toBe(404);
  });
});
