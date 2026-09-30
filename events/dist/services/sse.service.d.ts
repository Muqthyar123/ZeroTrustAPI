import { ServerResponse } from 'node:http';
import { SecurityEvent } from '../models/event.js';
export interface SSEClient {
    id: string;
    res: ServerResponse;
    connectedAt: Date;
}
export declare class SSEService {
    private clients;
    private heartbeatTimer;
    constructor();
    addClient(id: string, res: ServerResponse): void;
    removeClient(id: string): void;
    broadcast(event: SecurityEvent): void;
    getClientCount(): number;
    private startHeartbeat;
    closeAll(): void;
}
export declare const sseService: SSEService;
