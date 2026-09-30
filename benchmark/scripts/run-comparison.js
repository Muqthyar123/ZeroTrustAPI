"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const harness_js_1 = require("../src/harness.js");
const markdown_js_1 = require("../src/reporters/markdown.js");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
async function main() {
    const baselineUrl = process.env.BASELINE_URL || 'http://localhost:5000/health';
    const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:5000/v1/events';
    const concurrency = parseInt(process.env.CONCURRENCY || '8', 10);
    const duration = parseInt(process.env.DURATION || '3', 10);
    console.log(`\n======================================================`);
    console.log(`🔥 ZeroTrustAPI Performance & Overhead Comparison Benchmark`);
    console.log(`======================================================`);
    // 1. Run Baseline Test
    const baseline = await (0, harness_js_1.runLoadTest)({
        name: 'Direct Baseline Service',
        url: baselineUrl,
        concurrency,
        durationSeconds: duration
    });
    // 2. Run Gateway / Protected Endpoint Test
    const samplePayload = JSON.stringify({
        method: 'GET',
        routeTemplate: '/api/v1/orders/{orderId}',
        resourceType: 'order',
        objectIdHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
        subjectHash: 'b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78',
        tenantId: 'tenant-alpha',
        objectTenantId: 'tenant-alpha',
        decision: 'ALLOW',
        reason: 'OK_OWNER',
        authzLatencyUs: 180
    });
    const gateway = await (0, harness_js_1.runLoadTest)({
        name: 'Zero-Trust Telemetry & Verification Gateway',
        url: gatewayUrl,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: samplePayload,
        concurrency,
        durationSeconds: duration
    });
    // 3. Save Results
    const resultsDir = path.resolve(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(resultsDir, 'baseline-result.json'), JSON.stringify(baseline, null, 2));
    fs.writeFileSync(path.join(resultsDir, 'gateway-result.json'), JSON.stringify(gateway, null, 2));
    const report = (0, markdown_js_1.generateComparisonMarkdown)(baseline, gateway, {
        nodeVersion: process.version,
        os: `${process.platform} (${process.arch})`
    });
    fs.writeFileSync(path.join(resultsDir, 'comparison-report.md'), report);
    console.log(`\n✅ Comparison Report successfully generated at results/comparison-report.md`);
}
main().catch(console.error);
