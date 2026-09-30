import { SecurityStats } from '../models/stats.js';
import { IEventStore } from '../storage/event.store.js';
export declare class StatsService {
    private store;
    constructor(store?: IEventStore);
    getStats(): Promise<SecurityStats>;
    private computeRecentActivity;
}
export declare const statsService: StatsService;
