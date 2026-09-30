import { randomUUID, createHash } from 'node:crypto';

export function generateDecisionId(): string {
  return `dec_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function generateScanId(): string {
  return `scan_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
