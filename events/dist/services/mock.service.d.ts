import { EventService } from './event.service.js';
import { ScanService } from './scan.service.js';
export declare class MockService {
    private events;
    private scans;
    private timer;
    private isRunning;
    constructor(events?: EventService, scans?: ScanService);
    seedInitialData(): Promise<void>;
    start(intervalMs?: number): void;
    stop(): void;
}
export declare const mockService: MockService;
