import { FastifyRequest, FastifyReply } from 'fastify';
import { ScanService } from '../services/scan.service.js';
export declare class ScansController {
    private scans;
    constructor(scans?: ScanService);
    postScan: (request: FastifyRequest, reply: FastifyReply) => Promise<never>;
    getScans: (_request: FastifyRequest, reply: FastifyReply) => Promise<never>;
    getScanById: (request: FastifyRequest<{
        Params: {
            scanId: string;
        };
    }>, reply: FastifyReply) => Promise<never>;
}
export declare const scansController: ScansController;
