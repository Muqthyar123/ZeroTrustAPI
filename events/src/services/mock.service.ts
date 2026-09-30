import { EventService, eventService } from './event.service.js';
import { ScanService, scanService } from './scan.service.js';
import { DecisionReason, DecisionType } from '../models/event.js';
import { sha256 } from '../utils/id.js';

export class MockService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private events: EventService = eventService,
    private scans: ScanService = scanService
  ) {}

  public async seedInitialData(): Promise<void> {
    // 1. Seed realistic scan results (BOLA / IDOR findings)
    await this.scans.recordScan({
      scanId: 'scan_init_demo_001',
      commit: 'a9f4c3b',
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      target: 'http://sample-app:3000',
      summary: {
        total: 24,
        passed: 18,
        failed: 6
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
          routeTemplate: '/api/v1/accounts/{accountId}',
          attackerTenant: 'tenant-gamma',
          victimTenant: 'tenant-alpha',
          expectedStatus: 403,
          actualStatus: 204,
          severity: 'HIGH'
        },
        {
          method: 'GET',
          routeTemplate: '/api/v1/orders/{orderId}',
          attackerTenant: 'tenant-beta',
          victimTenant: 'tenant-gamma',
          expectedStatus: 403,
          actualStatus: 200,
          severity: 'MEDIUM'
        },
        {
          method: 'POST',
          routeTemplate: '/api/v1/reports/export',
          attackerTenant: 'tenant-delta',
          victimTenant: 'tenant-beta',
          expectedStatus: 403,
          actualStatus: 200,
          severity: 'MEDIUM'
        }
      ]
    });

    // 2. Seed initial history of security events
    const initialEvents = [
      {
        method: 'GET',
        routeTemplate: '/api/v1/documents/{documentId}',
        resourceType: 'document',
        tenantId: 'tenant-alpha',
        objectTenantId: 'tenant-alpha',
        decision: 'ALLOW' as DecisionType,
        reason: 'OK_OWNER' as DecisionReason,
        authzLatencyUs: 420
      },
      {
        method: 'GET',
        routeTemplate: '/api/v1/documents/{documentId}',
        resourceType: 'document',
        tenantId: 'tenant-beta',
        objectTenantId: 'tenant-alpha',
        decision: 'BLOCK' as DecisionType,
        reason: 'TENANT_MISMATCH' as DecisionReason,
        authzLatencyUs: 310
      },
      {
        method: 'POST',
        routeTemplate: '/api/v1/orders/{orderId}/checkout',
        resourceType: 'order',
        tenantId: 'tenant-alpha',
        objectTenantId: 'tenant-alpha',
        decision: 'ALLOW' as DecisionType,
        reason: 'OK_TENANT_SCOPE' as DecisionReason,
        authzLatencyUs: 550
      },
      {
        method: 'PUT',
        routeTemplate: '/api/v1/accounts/{accountId}',
        resourceType: 'account',
        tenantId: 'tenant-gamma',
        objectTenantId: 'tenant-gamma',
        decision: 'BLOCK' as DecisionType,
        reason: 'NOT_OWNER' as DecisionReason,
        authzLatencyUs: 280
      },
      {
        method: 'GET',
        routeTemplate: '/api/v1/invoices/{invoiceId}',
        resourceType: 'invoice',
        tenantId: 'tenant-finance',
        objectTenantId: 'tenant-alpha',
        decision: 'ALLOW' as DecisionType,
        reason: 'OK_DELEGATION' as DecisionReason,
        authzLatencyUs: 610
      },
      {
        method: 'DELETE',
        routeTemplate: '/api/v1/users/{userId}',
        resourceType: 'user',
        tenantId: 'tenant-beta',
        objectTenantId: 'tenant-beta',
        decision: 'BLOCK' as DecisionType,
        reason: 'NO_SCOPE' as DecisionReason,
        authzLatencyUs: 190
      },
      {
        method: 'GET',
        routeTemplate: '/api/v1/unknown/{resourceId}',
        resourceType: 'unknown',
        tenantId: 'tenant-delta',
        objectTenantId: 'tenant-delta',
        decision: 'BLOCK' as DecisionType,
        reason: 'UNKNOWN_OBJECT' as DecisionReason,
        authzLatencyUs: 150
      }
    ];

    for (let i = 0; i < initialEvents.length; i++) {
      const e = initialEvents[i];
      const offsetMs = (initialEvents.length - i) * 60000;
      await this.events.recordEvent({
        timestamp: new Date(Date.now() - offsetMs).toISOString(),
        method: e.method,
        routeTemplate: e.routeTemplate,
        resourceType: e.resourceType,
        objectIdHash: sha256(`obj_${e.resourceType}_${i}`),
        subjectHash: sha256(`user_${e.tenantId}_${i}`),
        tenantId: e.tenantId,
        objectTenantId: e.objectTenantId,
        decision: e.decision,
        reason: e.reason,
        authzLatencyUs: e.authzLatencyUs
      });
    }
  }

  public start(intervalMs = 3000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const templates = [
      {
        method: 'GET',
        routeTemplate: '/api/v1/documents/{documentId}',
        resourceType: 'document',
        allowReason: 'OK_OWNER' as DecisionReason,
        blockReason: 'TENANT_MISMATCH' as DecisionReason
      },
      {
        method: 'POST',
        routeTemplate: '/api/v1/orders/{orderId}/pay',
        resourceType: 'order',
        allowReason: 'OK_TENANT_SCOPE' as DecisionReason,
        blockReason: 'NOT_OWNER' as DecisionReason
      },
      {
        method: 'GET',
        routeTemplate: '/api/v1/invoices/{invoiceId}',
        resourceType: 'invoice',
        allowReason: 'OK_DELEGATION' as DecisionReason,
        blockReason: 'NO_SCOPE' as DecisionReason
      },
      {
        method: 'DELETE',
        routeTemplate: '/api/v1/files/{fileId}',
        resourceType: 'file',
        allowReason: 'OK_OWNER' as DecisionReason,
        blockReason: 'UNKNOWN_OBJECT' as DecisionReason
      }
    ];

    const tenants = ['tenant-alpha', 'tenant-beta', 'tenant-gamma', 'tenant-finance', 'tenant-ops'];

    this.timer = setInterval(async () => {
      if (!this.isRunning) return;

      const tmpl = templates[Math.floor(Math.random() * templates.length)];
      const isAllowed = Math.random() > 0.35; // ~65% allow, 35% block
      const tenant = tenants[Math.floor(Math.random() * tenants.length)];
      const objectTenant = isAllowed ? tenant : tenants[Math.floor(Math.random() * tenants.length)];

      const reason: DecisionReason = isAllowed ? tmpl.allowReason : tmpl.blockReason;
      const decision: DecisionType = isAllowed ? 'ALLOW' : 'BLOCK';
      const latency = Math.floor(Math.random() * 450) + 120; // 120us - 570us

      try {
        await this.events.recordEvent({
          method: tmpl.method,
          routeTemplate: tmpl.routeTemplate,
          resourceType: tmpl.resourceType,
          objectIdHash: sha256(`res_${Date.now()}_${Math.random()}`),
          subjectHash: sha256(`sub_${tenant}_${Math.random()}`),
          tenantId: tenant,
          objectTenantId: objectTenant,
          decision,
          reason,
          authzLatencyUs: latency
        });
      } catch (err) {
        console.error('Failed to emit mock event:', err);
      }
    }, intervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const mockService = new MockService();
