"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanStore = exports.InMemoryScanStore = void 0;
class InMemoryScanStore {
    scans = [];
    maxCapacity;
    constructor(maxCapacity = 500) {
        this.maxCapacity = maxCapacity;
    }
    async save(scan) {
        this.scans.unshift(scan); // newest first
        if (this.scans.length > this.maxCapacity) {
            this.scans.pop();
        }
        return scan;
    }
    async findById(scanId) {
        const found = this.scans.find((s) => s.scanId === scanId);
        return found ? { ...found } : null;
    }
    async getAll() {
        return [...this.scans];
    }
    async getLatest() {
        return this.scans.length > 0 ? { ...this.scans[0] } : null;
    }
    async count() {
        return this.scans.length;
    }
    async clear() {
        this.scans = [];
    }
}
exports.InMemoryScanStore = InMemoryScanStore;
exports.scanStore = new InMemoryScanStore();
