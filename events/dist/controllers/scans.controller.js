"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scansController = exports.ScansController = void 0;
const scan_validator_js_1 = require("../validators/scan.validator.js");
const scan_service_js_1 = require("../services/scan.service.js");
class ScansController {
    scans;
    constructor(scans = scan_service_js_1.scanService) {
        this.scans = scans;
    }
    postScan = async (request, reply) => {
        const parseResult = scan_validator_js_1.CreateScanSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: 'Invalid scan payload structure',
                details: parseResult.error.format()
            });
        }
        try {
            const saved = await this.scans.recordScan(request.body);
            return reply.status(201).send(saved);
        }
        catch (err) {
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: err.message || 'Failed to record scan'
            });
        }
    };
    getScans = async (_request, reply) => {
        const allScans = await this.scans.getAllScans();
        return reply.status(200).send(allScans);
    };
    getScanById = async (request, reply) => {
        const { scanId } = request.params;
        const scan = await this.scans.getScanById(scanId);
        if (!scan) {
            return reply.status(404).send({
                error: 'Not Found',
                message: `Scan report with ID '${scanId}' not found`
            });
        }
        return reply.status(200).send(scan);
    };
}
exports.ScansController = ScansController;
exports.scansController = new ScansController();
