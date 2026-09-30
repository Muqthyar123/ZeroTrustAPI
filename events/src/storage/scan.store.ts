import { ScanResult } from '../models/scan.js';

export interface IScanStore {
  save(scan: ScanResult): Promise<ScanResult>;
  findById(scanId: string): Promise<ScanResult | null>;
  getAll(): Promise<ScanResult[]>;
  getLatest(): Promise<ScanResult | null>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

export class InMemoryScanStore implements IScanStore {
  private scans: ScanResult[] = [];
  private maxCapacity: number;

  constructor(maxCapacity = 500) {
    this.maxCapacity = maxCapacity;
  }

  async save(scan: ScanResult): Promise<ScanResult> {
    this.scans.unshift(scan); // newest first
    if (this.scans.length > this.maxCapacity) {
      this.scans.pop();
    }
    return scan;
  }

  async findById(scanId: string): Promise<ScanResult | null> {
    const found = this.scans.find((s) => s.scanId === scanId);
    return found ? { ...found } : null;
  }

  async getAll(): Promise<ScanResult[]> {
    return [...this.scans];
  }

  async getLatest(): Promise<ScanResult | null> {
    return this.scans.length > 0 ? { ...this.scans[0] } : null;
  }

  async count(): Promise<number> {
    return this.scans.length;
  }

  async clear(): Promise<void> {
    this.scans = [];
  }
}

export const scanStore = new InMemoryScanStore();
