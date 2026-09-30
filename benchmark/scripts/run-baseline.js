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
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
async function main() {
    const targetUrl = process.env.BASELINE_URL || 'http://localhost:3000/api/v1/documents/doc-123';
    const concurrency = parseInt(process.env.CONCURRENCY || '10', 10);
    const duration = parseInt(process.env.DURATION || '5', 10);
    const result = await (0, harness_js_1.runLoadTest)({
        name: 'Baseline Direct App',
        url: targetUrl,
        concurrency,
        durationSeconds: duration,
        headers: {
            'x-tenant-id': 'tenant-alpha'
        }
    });
    const resultsDir = path.resolve(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(resultsDir, 'baseline-result.json'), JSON.stringify(result, null, 2));
    console.log(`\nSaved baseline results to results/baseline-result.json`);
}
main().catch(console.error);
