"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockService = exports.MockService = void 0;
const event_service_js_1 = require("./event.service.js");
const scan_service_js_1 = require("./scan.service.js");
const id_js_1 = require("../utils/id.js");
class MockService {
    events;
    scans;
    timer = null;
    isRunning = false;
    constructor(events = event_service_js_1.eventService, scans = scan_service_js_1.scanService) {
        this.events = events;
        this.scans = scans;
    }
    async seedInitialData() {
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
                decision: 'ALLOW',
                reason: 'OK_OWNER',
                authzLatencyUs: 420
            },
            {
                method: 'GET',
                routeTemplate: '/api/v1/documents/{documentId}',
                resourceType: 'document',
                tenantId: 'tenant-beta',
                objectTenantId: 'tenant-alpha',
                decision: 'BLOCK',
                reason: 'TENANT_MISMATCH',
                authzLatencyUs: 310
            },
            {
                method: 'POST',
                routeTemplate: '/api/v1/orders/{orderId}/checkout',
                resourceType: 'order',
                tenantId: 'tenant-alpha',
                objectTenantId: 'tenant-alpha',
                decision: 'ALLOW',
                reason: 'OK_TENANT_SCOPE',
                authzLatencyUs: 550
            },
            {
                method: 'PUT',
                routeTemplate: '/api/v1/accounts/{accountId}',
                resourceType: 'account',
                tenantId: 'tenant-gamma',
                objectTenantId: 'tenant-gamma',
                decision: 'BLOCK',
                reason: 'NOT_OWNER',
                authzLatencyUs: 280
            },
            {
                method: 'GET',
                routeTemplate: '/api/v1/invoices/{invoiceId}',
                resourceType: 'invoice',
                tenantId: 'tenant-finance',
                objectTenantId: 'tenant-alpha',
                decision: 'ALLOW',
                reason: 'OK_DELEGATION',
                authzLatencyUs: 610
            },
            {
                method: 'DELETE',
                routeTemplate: '/api/v1/users/{userId}',
                resourceType: 'user',
                tenantId: 'tenant-beta',
                objectTenantId: 'tenant-beta',
                decision: 'BLOCK',
                reason: 'NO_SCOPE',
                authzLatencyUs: 190
            },
            {
                method: 'GET',
                routeTemplate: '/api/v1/unknown/{resourceId}',
                resourceType: 'unknown',
                tenantId: 'tenant-delta',
                objectTenantId: 'tenant-delta',
                decision: 'BLOCK',
                reason: 'UNKNOWN_OBJECT',
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
                objectIdHash: (0, id_js_1.sha256)(`obj_${e.resourceType}_${i}`),
                subjectHash: (0, id_js_1.sha256)(`user_${e.tenantId}_${i}`),
                tenantId: e.tenantId,
                objectTenantId: e.objectTenantId,
                decision: e.decision,
                reason: e.reason,
                authzLatencyUs: e.authzLatencyUs
            });
        }
    }
    start(intervalMs = 3000) {
        if (this.isRunning)
            return;
        this.isRunning = true;
        const templates = [
            {
                method: 'GET',
                routeTemplate: '/api/v1/documents/{documentId}',
                resourceType: 'document',
                allowReason: 'OK_OWNER',
                blockReason: 'TENANT_MISMATCH'
            },
            {
                method: 'POST',
                routeTemplate: '/api/v1/orders/{orderId}/pay',
                resourceType: 'order',
                allowReason: 'OK_TENANT_SCOPE',
                blockReason: 'NOT_OWNER'
            },
            {
                method: 'GET',
                routeTemplate: '/api/v1/invoices/{invoiceId}',
                resourceType: 'invoice',
                allowReason: 'OK_DELEGATION',
                blockReason: 'NO_SCOPE'
            },
            {
                method: 'DELETE',
                routeTemplate: '/api/v1/files/{fileId}',
                resourceType: 'file',
                allowReason: 'OK_OWNER',
                blockReason: 'UNKNOWN_OBJECT'
            }
        ];
        const tenants = ['tenant-alpha', 'tenant-beta', 'tenant-gamma', 'tenant-finance', 'tenant-ops'];
        this.timer = setInterval(async () => {
            if (!this.isRunning)
                return;
            const tmpl = templates[Math.floor(Math.random() * templates.length)];
            const isAllowed = Math.random() > 0.35; // ~65% allow, 35% block
            const tenant = tenants[Math.floor(Math.random() * tenants.length)];
            const objectTenant = isAllowed ? tenant : tenants[Math.floor(Math.random() * tenants.length)];
            const reason = isAllowed ? tmpl.allowReason : tmpl.blockReason;
            const decision = isAllowed ? 'ALLOW' : 'BLOCK';
            const latency = Math.floor(Math.random() * 450) + 120; // 120us - 570us
            try {
                await this.events.recordEvent({
                    method: tmpl.method,
                    routeTemplate: tmpl.routeTemplate,
                    resourceType: tmpl.resourceType,
                    objectIdHash: (0, id_js_1.sha256)(`res_${Date.now()}_${Math.random()}`),
                    subjectHash: (0, id_js_1.sha256)(`sub_${tenant}_${Math.random()}`),
                    tenantId: tenant,
                    objectTenantId: objectTenant,
                    decision,
                    reason,
                    authzLatencyUs: latency
                });
            }
            catch (err) {
                console.error('Failed to emit mock event:', err);
            }
        }, intervalMs);
    }
    stop() {
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}
exports.MockService = MockService;
exports.mockService = new MockService();
