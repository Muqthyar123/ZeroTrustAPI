import { runLoadTest } from '../src/harness.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
async function main() {
    const targetUrl = process.env.GATEWAY_URL || 'http://localhost:8080/api/v1/documents/doc-123';
    const concurrency = parseInt(process.env.CONCURRENCY || '10', 10);
    const duration = parseInt(process.env.DURATION || '5', 10);
    const result = await runLoadTest({
        name: 'Zero-Trust Enforced Gateway',
        url: targetUrl,
        concurrency,
        durationSeconds: duration,
        headers: {
            'x-tenant-id': 'tenant-alpha',
            'authorization': 'Bearer valid-delegation-token'
        }
    });
    const resultsDir = path.resolve(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(resultsDir, 'gateway-result.json'), JSON.stringify(result, null, 2));
    console.log(`\nSaved gateway results to results/gateway-result.json`);
}
main().catch(console.error);
