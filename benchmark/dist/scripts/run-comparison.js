import { runLoadTest } from '../src/harness.js';
import { generateComparisonMarkdown } from '../src/reporters/markdown.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
async function main() {
    const baselineUrl = process.env.BASELINE_URL || 'http://localhost:5000/health';
    const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:5000/v1/events';
    const concurrency = parseInt(process.env.CONCURRENCY || '8', 10);
    const duration = parseInt(process.env.DURATION || '3', 10);
    console.log(`\n======================================================`);
    console.log(`🔥 ZeroTrustAPI Performance & Overhead Comparison Benchmark`);
    console.log(`======================================================`);
    // 1. Run Baseline Test
    const baseline = await runLoadTest({
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
    const gateway = await runLoadTest({
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
    const report = generateComparisonMarkdown(baseline, gateway, {
        nodeVersion: process.version,
        os: `${process.platform} (${process.arch})`
    });
    fs.writeFileSync(path.join(resultsDir, 'comparison-report.md'), report);
    console.log(`\n✅ Comparison Report successfully generated at results/comparison-report.md`);
}
main().catch(console.error);
