import { z } from 'zod';
import { DecisionReason, DecisionType } from '../models/event.js';

export const DecisionSchema = z.enum(['ALLOW', 'BLOCK']);

export const ReasonSchema = z.enum([
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

export const CreateEventSchema = z.object({
  decisionId: z.string().min(1).optional(),
  timestamp: z.string().datetime({ offset: true }).or(z.string().min(10)).optional(),
  method: z.string().min(1, 'Method is required'),
  routeTemplate: z.string().min(1, 'Route template is required'),
  resourceType: z.string().min(1, 'Resource type is required'),
  objectIdHash: z.string().min(1, 'Object ID hash is required'),
  subjectHash: z.string().min(1, 'Subject hash is required'),
  tenantId: z.string().min(1, 'Tenant ID is required'),
  objectTenantId: z.string().min(1, 'Object Tenant ID is required'),
  decision: DecisionSchema,
  reason: ReasonSchema,
  authzLatencyUs: z.number().nonnegative('authzLatencyUs must be non-negative')
});

export const EventQuerySchema = z.object({
  decision: DecisionSchema.optional(),
  tenant: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional().default(50)
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type EventQueryInput = z.infer<typeof EventQuerySchema>;
