import { ScanResult } from '../models/scan.js';
export interface IScanStore {
    save(scan: ScanResult): Promise<ScanResult>;
    findById(scanId: string): Promise<ScanResult | null>;
    getAll(): Promise<ScanResult[]>;
    getLatest(): Promise<ScanResult | null>;
    count(): Promise<number>;
    clear(): Promise<void>;
}
export declare class InMemoryScanStore implements IScanStore {
    private scans;
    private maxCapacity;
    constructor(maxCapacity?: number);
    save(scan: ScanResult): Promise<ScanResult>;
    findById(scanId: string): Promise<ScanResult | null>;
    getAll(): Promise<ScanResult[]>;
    getLatest(): Promise<ScanResult | null>;
    count(): Promise<number>;
    clear(): Promise<void>;
}
export declare const scanStore: InMemoryScanStore;
