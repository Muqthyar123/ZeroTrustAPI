"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDecisionId = generateDecisionId;
exports.generateScanId = generateScanId;
exports.sha256 = sha256;
const node_crypto_1 = require("node:crypto");
function generateDecisionId() {
    return `dec_${(0, node_crypto_1.randomUUID)().replace(/-/g, '').slice(0, 16)}`;
}
function generateScanId() {
    return `scan_${(0, node_crypto_1.randomUUID)().replace(/-/g, '').slice(0, 16)}`;
}
function sha256(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value).digest('hex');
}
