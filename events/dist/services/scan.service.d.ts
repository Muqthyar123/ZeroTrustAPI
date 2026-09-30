import { ScanResult } from '../models/scan.js';
import { IScanStore } from '../storage/scan.store.js';
export declare class ScanService {
    private store;
    constructor(store?: IScanStore);
    recordScan(rawPayload: Record<string, any>): Promise<ScanResult>;
    getScanById(scanId: string): Promise<ScanResult | null>;
    getAllScans(): Promise<ScanResult[]>;
    getLatestScan(): Promise<ScanResult | null>;
}
export declare const scanService: ScanService;
