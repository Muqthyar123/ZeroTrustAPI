"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventQuerySchema = exports.CreateEventSchema = exports.ReasonSchema = exports.DecisionSchema = void 0;
const zod_1 = require("zod");
exports.DecisionSchema = zod_1.z.enum(['ALLOW', 'BLOCK']);
exports.ReasonSchema = zod_1.z.enum([
    'OK_OWNER',
    'OK_TENANT_SCOPE',
    'OK_DELEGATION',
    'TENANT_MISMATCH',
    'NOT_OWNER',
    'NO_SCOPE',
    'UNKNOWN_OBJECT',
    'INVALID_TOKEN',
    'UNPROTECTED_ROUTE'
]);
exports.CreateEventSchema = zod_1.z.object({
    decisionId: zod_1.z.string().min(1).optional(),
    timestamp: zod_1.z.string().datetime({ offset: true }).or(zod_1.z.string().min(10)).optional(),
    method: zod_1.z.string().min(1, 'Method is required'),
    routeTemplate: zod_1.z.string().min(1, 'Route template is required'),
    resourceType: zod_1.z.string().min(1, 'Resource type is required'),
    objectIdHash: zod_1.z.string().min(1, 'Object ID hash is required'),
    subjectHash: zod_1.z.string().min(1, 'Subject hash is required'),
    tenantId: zod_1.z.string().min(1, 'Tenant ID is required'),
    objectTenantId: zod_1.z.string().min(1, 'Object Tenant ID is required'),
    decision: exports.DecisionSchema,
    reason: exports.ReasonSchema,
    authzLatencyUs: zod_1.z.number().nonnegative('authzLatencyUs must be non-negative')
});
exports.EventQuerySchema = zod_1.z.object({
    decision: exports.DecisionSchema.optional(),
    tenant: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().int().positive().max(1000).optional().default(50)
});
