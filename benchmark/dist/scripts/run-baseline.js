import { runLoadTest } from '../src/harness.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
async function main() {
    const targetUrl = process.env.BASELINE_URL || 'http://localhost:3000/api/v1/documents/doc-123';
    const concurrency = parseInt(process.env.CONCURRENCY || '10', 10);
    const duration = parseInt(process.env.DURATION || '5', 10);
    const result = await runLoadTest({
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
