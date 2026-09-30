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
        // 1. Seed realistic scan results matching M2/M3 actual contract (36 probes, 13 BOLA findings)
        await this.scans.recordScan({
            scanId: 'scan_init_m3_bola_001',
            commit: 'm3-scanner-v1.0',
            startedAt: new Date(Date.now() - 3600000).toISOString(),
            target: 'http://localhost:3000',
            summary: {
                total: 36,
                passed: 23,
                failed: 13,
                status: 'FAIL',
                totalProbes: 36,
                totalFindings: 13,
                highFindings: 12,
                mediumFindings: 1,
                lowFindings: 0
            },
            findings: [
                {
                    method: 'GET',
                    routeTemplate: '/api/orders/{orderId}',
                    attackerTenant: 'tenantA',
                    victimTenant: 'tenantB',
                    expectedStatus: 403,
                    actualStatus: 200,
                    severity: 'HIGH',
                    findingId: 'find_userA1_order_201',
                    title: 'Cross-Tenant BOLA Vulnerability Detected',
                    description: "User 'userA1' (tenantA) was granted unauthorized GET access to Order 201 (tenantB).",
                    authenticatedUser: 'userA1'
                },
                {
                    method: 'GET',
                    routeTemplate: '/api/orders/{orderId}',
                    attackerTenant: 'tenantA',
                    victimTenant: 'tenantB',
                    expectedStatus: 403,
                    actualStatus: 200,
                    severity: 'HIGH',
                    findingId: 'find_userA1_order_202',
                    title: 'Cross-Tenant BOLA Vulnerability Detected',
                    description: "User 'userA1' (tenantA) was granted unauthorized GET access to Order 202 (tenantB).",
                    authenticatedUser: 'userA1'
                },
                {
                    method: 'DELETE',
                    routeTemplate: '/api/orders/{orderId}',
                    attackerTenant: 'tenantA',
                    victimTenant: 'tenantB',
                    expectedStatus: 403,
                    actualStatus: 200,
                    severity: 'HIGH',
                    findingId: 'find_userA1_delete_201',
                    title: 'Cross-Tenant Unauthorized Order Deletion',
                    description: "User 'userA1' (tenantA) was granted unauthorized DELETE access to Order 201 (tenantB).",
                    authenticatedUser: 'userA1'
                },
                {
                    method: 'GET',
                    routeTemplate: '/api/users/{userId}/documents/{documentId}',
                    attackerTenant: 'tenantA',
                    victimTenant: 'tenantB',
                    expectedStatus: 403,
                    actualStatus: 200,
                    severity: 'HIGH',
                    findingId: 'find_userA1_doc_201',
                    title: 'Nested Subresource IDOR Access',
                    description: "User 'userA1' accessed victim's document doc-201 belonging to userB1 in tenantB.",
                    authenticatedUser: 'userA1'
                },
                {
                    method: 'GET',
                    routeTemplate: '/api/invoices/{invoiceId}',
                    attackerTenant: 'tenantB',
                    victimTenant: 'tenantA',
                    expectedStatus: 403,
                    actualStatus: 200,
                    severity: 'MEDIUM',
                    findingId: 'find_userB1_inv_101',
                    title: 'Cross-Tenant Invoice Read Access',
                    description: "User 'userB1' (tenantB) accessed Invoice inv_101 belonging to tenantA without delegation.",
                    authenticatedUser: 'userB1'
                }
            ]
        });
        // 2. Seed initial history of security events matching tenantA and tenantB
        const initialEvents = [
            {
                method: 'GET',
                routeTemplate: '/api/orders/{orderId}',
                resourceType: 'orders',
                tenantId: 'tenantA',
                objectTenantId: 'tenantA',
                decision: 'ALLOW',
                reason: 'OK_OWNER',
                authzLatencyUs: 280
            },
            {
                method: 'GET',
                routeTemplate: '/api/orders/{orderId}',
                resourceType: 'orders',
                tenantId: 'tenantA',
                objectTenantId: 'tenantB',
                decision: 'BLOCK',
                reason: 'TENANT_MISMATCH',
                authzLatencyUs: 340
            },
            {
                method: 'GET',
                routeTemplate: '/api/orders/{orderId}',
                resourceType: 'orders',
                tenantId: 'tenantB',
                objectTenantId: 'tenantA',
                decision: 'ALLOW',
                reason: 'OK_DELEGATION',
                authzLatencyUs: 310
            },
            {
                method: 'POST',
                routeTemplate: '/api/orders',
                resourceType: 'orders',
                tenantId: 'tenantA',
                objectTenantId: 'tenantA',
                decision: 'ALLOW',
                reason: 'OK_OWNER',
                authzLatencyUs: 450
            },
            {
                method: 'DELETE',
                routeTemplate: '/api/orders/{orderId}',
                resourceType: 'orders',
                tenantId: 'tenantA',
                objectTenantId: 'tenantB',
                decision: 'BLOCK',
                reason: 'TENANT_MISMATCH',
                authzLatencyUs: 290
            },
            {
                method: 'GET',
                routeTemplate: '/api/invoices/{invoiceId}',
                resourceType: 'invoices',
                tenantId: 'tenantA',
                objectTenantId: 'tenantA',
                decision: 'ALLOW',
                reason: 'OK_OWNER',
                authzLatencyUs: 220
            },
            {
                method: 'GET',
                routeTemplate: '/api/users/{userId}/documents/{documentId}',
                resourceType: 'documents',
                tenantId: 'tenantA',
                objectTenantId: 'tenantB',
                decision: 'BLOCK',
                reason: 'TENANT_MISMATCH',
                authzLatencyUs: 360
            },
            {
                method: 'GET',
                routeTemplate: '/api/orders/{orderId}',
                resourceType: 'orders',
                tenantId: 'tenantA',
                objectTenantId: 'tenantA',
                decision: 'ALLOW',
                reason: 'OK_SCOPE',
                authzLatencyUs: 260
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
                objectIdHash: (0, id_js_1.sha256)(`obj_${e.resourceType}_${i + 101}`),
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
                routeTemplate: '/api/orders/{orderId}',
                resourceType: 'orders',
                allowReason: 'OK_OWNER',
                blockReason: 'TENANT_MISMATCH'
            },
            {
                method: 'POST',
                routeTemplate: '/api/orders',
                resourceType: 'orders',
                allowReason: 'OK_OWNER',
                blockReason: 'TENANT_MISMATCH'
            },
            {
                method: 'GET',
                routeTemplate: '/api/orders/{orderId}',
                resourceType: 'orders',
                allowReason: 'OK_DELEGATION',
                blockReason: 'TENANT_MISMATCH'
            },
            {
                method: 'GET',
                routeTemplate: '/api/invoices/{invoiceId}',
                resourceType: 'invoices',
                allowReason: 'OK_OWNER',
                blockReason: 'TENANT_MISMATCH'
            },
            {
                method: 'GET',
                routeTemplate: '/api/users/{userId}/documents/{documentId}',
                resourceType: 'documents',
                allowReason: 'OK_OWNER',
                blockReason: 'TENANT_MISMATCH'
            },
            {
                method: 'DELETE',
                routeTemplate: '/api/orders/{orderId}',
                resourceType: 'orders',
                allowReason: 'OK_OWNER',
                blockReason: 'TENANT_MISMATCH'
            }
        ];
        const tenants = ['tenantA', 'tenantB'];
        this.timer = setInterval(async () => {
            if (!this.isRunning)
                return;
            const tmpl = templates[Math.floor(Math.random() * templates.length)];
            const isAllowed = Math.random() > 0.3; // ~70% allow, 30% block
            const tenant = tenants[Math.floor(Math.random() * tenants.length)];
            const objectTenant = isAllowed ? tenant : (tenant === 'tenantA' ? 'tenantB' : 'tenantA');
            const reason = isAllowed ? tmpl.allowReason : tmpl.blockReason;
            const decision = isAllowed ? 'ALLOW' : 'BLOCK';
            const latency = Math.floor(Math.random() * 320) + 140; // 140us - 460us
            try {
                await this.events.recordEvent({
                    method: tmpl.method,
                    routeTemplate: tmpl.routeTemplate,
                    resourceType: tmpl.resourceType,
                    objectIdHash: (0, id_js_1.sha256)(`order_${Date.now()}_${Math.random()}`),
                    subjectHash: (0, id_js_1.sha256)(`user_${tenant}_${Math.random()}`),
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
