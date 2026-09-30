import { z } from 'zod';

export const FindingSchema = z.object({
  method: z.string().min(1),
  routeTemplate: z.string().min(1),
  attackerTenant: z.string().min(1),
  victimTenant: z.string().min(1),
  expectedStatus: z.number().int(),
  actualStatus: z.number().int(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
});

export const CreateScanSchema = z.object({
  scanId: z.string().min(1).optional(),
  commit: z.string().min(1),
  startedAt: z.string().optional(),
  target: z.string().min(1),
  summary: z.object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative()
  }),
  findings: z.array(FindingSchema)
});

export type CreateScanInput = z.infer<typeof CreateScanSchema>;
