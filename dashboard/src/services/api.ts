import { SecurityEvent, SecurityStats, ScanResult } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function fetchEvents(filters: { decision?: string; tenant?: string; limit?: number } = {}): Promise<SecurityEvent[]> {
  const params = new URLSearchParams();
  if (filters.decision) params.append('decision', filters.decision);
  if (filters.tenant) params.append('tenant', filters.tenant);
  if (filters.limit) params.append('limit', String(filters.limit));

  const url = `${API_BASE}/v1/events${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch events: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchEventById(decisionId: string): Promise<SecurityEvent> {
  const res = await fetch(`${API_BASE}/v1/events/${decisionId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch event ${decisionId}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchStats(): Promise<SecurityStats> {
  const res = await fetch(`${API_BASE}/v1/stats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch statistics: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchScans(): Promise<ScanResult[]> {
  const res = await fetch(`${API_BASE}/v1/scans`);
  if (!res.ok) {
    throw new Error(`Failed to fetch scans: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchScanById(scanId: string): Promise<ScanResult> {
  const res = await fetch(`${API_BASE}/v1/scans/${scanId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch scan ${scanId}: ${res.statusText}`);
  }
  return res.json();
}
