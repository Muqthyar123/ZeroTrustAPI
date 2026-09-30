import { z } from 'zod';
export declare const FindingSchema: z.ZodObject<{
    method: z.ZodString;
    routeTemplate: z.ZodString;
    attackerTenant: z.ZodString;
    victimTenant: z.ZodString;
    expectedStatus: z.ZodNumber;
    actualStatus: z.ZodNumber;
    severity: z.ZodEnum<["CRITICAL", "HIGH", "MEDIUM", "LOW"]>;
}, "strip", z.ZodTypeAny, {
    method: string;
    routeTemplate: string;
    attackerTenant: string;
    victimTenant: string;
    expectedStatus: number;
    actualStatus: number;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}, {
    method: string;
    routeTemplate: string;
    attackerTenant: string;
    victimTenant: string;
    expectedStatus: number;
    actualStatus: number;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}>;
export declare const CreateScanSchema: z.ZodObject<{
    scanId: z.ZodOptional<z.ZodString>;
    commit: z.ZodString;
    startedAt: z.ZodOptional<z.ZodString>;
    target: z.ZodString;
    summary: z.ZodObject<{
        total: z.ZodNumber;
        passed: z.ZodNumber;
        failed: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        passed: number;
        failed: number;
    }, {
        total: number;
        passed: number;
        failed: number;
    }>;
    findings: z.ZodArray<z.ZodObject<{
        method: z.ZodString;
        routeTemplate: z.ZodString;
        attackerTenant: z.ZodString;
        victimTenant: z.ZodString;
        expectedStatus: z.ZodNumber;
        actualStatus: z.ZodNumber;
        severity: z.ZodEnum<["CRITICAL", "HIGH", "MEDIUM", "LOW"]>;
    }, "strip", z.ZodTypeAny, {
        method: string;
        routeTemplate: string;
        attackerTenant: string;
        victimTenant: string;
        expectedStatus: number;
        actualStatus: number;
        severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    }, {
        method: string;
        routeTemplate: string;
        attackerTenant: string;
        victimTenant: string;
        expectedStatus: number;
        actualStatus: number;
        severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    commit: string;
    target: string;
    summary: {
        total: number;
        passed: number;
        failed: number;
    };
    findings: {
        method: string;
        routeTemplate: string;
        attackerTenant: string;
        victimTenant: string;
        expectedStatus: number;
        actualStatus: number;
        severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    }[];
    scanId?: string | undefined;
    startedAt?: string | undefined;
}, {
    commit: string;
    target: string;
    summary: {
        total: number;
        passed: number;
        failed: number;
    };
    findings: {
        method: string;
        routeTemplate: string;
        attackerTenant: string;
        victimTenant: string;
        expectedStatus: number;
        actualStatus: number;
        severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    }[];
    scanId?: string | undefined;
    startedAt?: string | undefined;
}>;
export type CreateScanInput = z.infer<typeof CreateScanSchema>;
