"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateScanSchema = exports.FindingSchema = void 0;
const zod_1 = require("zod");
exports.FindingSchema = zod_1.z.object({
    method: zod_1.z.string().min(1),
    routeTemplate: zod_1.z.string().min(1),
    attackerTenant: zod_1.z.string().min(1),
    victimTenant: zod_1.z.string().min(1),
    expectedStatus: zod_1.z.number().int(),
    actualStatus: zod_1.z.number().int(),
    severity: zod_1.z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
});
exports.CreateScanSchema = zod_1.z.object({
    scanId: zod_1.z.string().min(1).optional(),
    commit: zod_1.z.string().min(1),
    startedAt: zod_1.z.string().optional(),
    target: zod_1.z.string().min(1),
    summary: zod_1.z.object({
        total: zod_1.z.number().int().nonnegative(),
        passed: zod_1.z.number().int().nonnegative(),
        failed: zod_1.z.number().int().nonnegative()
    }),
    findings: zod_1.z.array(exports.FindingSchema)
});
