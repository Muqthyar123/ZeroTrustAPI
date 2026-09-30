"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanService = exports.ScanService = void 0;
const scan_store_js_1 = require("../storage/scan.store.js");
const id_js_1 = require("../utils/id.js");
class ScanService {
    store;
    constructor(store = scan_store_js_1.scanStore) {
        this.store = store;
    }
    async recordScan(rawPayload) {
        const scan = {
            scanId: rawPayload.scanId || (0, id_js_1.generateScanId)(),
            commit: rawPayload.commit || 'unknown',
            startedAt: rawPayload.startedAt || new Date().toISOString(),
            target: rawPayload.target || 'sample-app',
            summary: {
                total: Number(rawPayload.summary?.total) || 0,
                passed: Number(rawPayload.summary?.passed) || 0,
                failed: Number(rawPayload.summary?.failed) || 0
            },
            findings: Array.isArray(rawPayload.findings)
                ? rawPayload.findings.map((f) => ({
                    method: String(f.method).toUpperCase(),
                    routeTemplate: String(f.routeTemplate),
                    attackerTenant: String(f.attackerTenant),
                    victimTenant: String(f.victimTenant),
                    expectedStatus: Number(f.expectedStatus),
                    actualStatus: Number(f.actualStatus),
                    severity: f.severity
                }))
                : []
        };
        return this.store.save(scan);
    }
    async getScanById(scanId) {
        return this.store.findById(scanId);
    }
    async getAllScans() {
        return this.store.getAll();
    }
    async getLatestScan() {
        return this.store.getLatest();
    }
}
exports.ScanService = ScanService;
exports.scanService = new ScanService();
