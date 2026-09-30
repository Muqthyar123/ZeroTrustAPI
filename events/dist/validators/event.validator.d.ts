import { z } from 'zod';
export declare const DecisionSchema: z.ZodEnum<["ALLOW", "BLOCK"]>;
export declare const ReasonSchema: z.ZodEnum<["OK_OWNER", "OK_TENANT_SCOPE", "OK_DELEGATION", "TENANT_MISMATCH", "NOT_OWNER", "NO_SCOPE", "UNKNOWN_OBJECT", "INVALID_TOKEN", "UNPROTECTED_ROUTE"]>;
export declare const CreateEventSchema: z.ZodObject<{
    decisionId: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
    method: z.ZodString;
    routeTemplate: z.ZodString;
    resourceType: z.ZodString;
    objectIdHash: z.ZodString;
    subjectHash: z.ZodString;
    tenantId: z.ZodString;
    objectTenantId: z.ZodString;
    decision: z.ZodEnum<["ALLOW", "BLOCK"]>;
    reason: z.ZodEnum<["OK_OWNER", "OK_TENANT_SCOPE", "OK_DELEGATION", "TENANT_MISMATCH", "NOT_OWNER", "NO_SCOPE", "UNKNOWN_OBJECT", "INVALID_TOKEN", "UNPROTECTED_ROUTE"]>;
    authzLatencyUs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    method: string;
    routeTemplate: string;
    resourceType: string;
    objectIdHash: string;
    subjectHash: string;
    tenantId: string;
    objectTenantId: string;
    decision: "ALLOW" | "BLOCK";
    reason: "OK_OWNER" | "OK_TENANT_SCOPE" | "OK_DELEGATION" | "TENANT_MISMATCH" | "NOT_OWNER" | "NO_SCOPE" | "UNKNOWN_OBJECT" | "INVALID_TOKEN" | "UNPROTECTED_ROUTE";
    authzLatencyUs: number;
    decisionId?: string | undefined;
    timestamp?: string | undefined;
}, {
    method: string;
    routeTemplate: string;
    resourceType: string;
    objectIdHash: string;
    subjectHash: string;
    tenantId: string;
    objectTenantId: string;
    decision: "ALLOW" | "BLOCK";
    reason: "OK_OWNER" | "OK_TENANT_SCOPE" | "OK_DELEGATION" | "TENANT_MISMATCH" | "NOT_OWNER" | "NO_SCOPE" | "UNKNOWN_OBJECT" | "INVALID_TOKEN" | "UNPROTECTED_ROUTE";
    authzLatencyUs: number;
    decisionId?: string | undefined;
    timestamp?: string | undefined;
}>;
export declare const EventQuerySchema: z.ZodObject<{
    decision: z.ZodOptional<z.ZodEnum<["ALLOW", "BLOCK"]>>;
    tenant: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    decision?: "ALLOW" | "BLOCK" | undefined;
    tenant?: string | undefined;
}, {
    decision?: "ALLOW" | "BLOCK" | undefined;
    tenant?: string | undefined;
    limit?: number | undefined;
}>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type EventQueryInput = z.infer<typeof EventQuerySchema>;
