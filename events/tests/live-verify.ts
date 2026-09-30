import { buildApp } from '../src/app.js';
import { eventStore } from '../src/storage/event.store.js';
import { scanStore } from '../src/storage/scan.store.js';

async function runLiveVerification() {
  console.log('--- STARTING TASK 2-6 COMPREHENSIVE VERIFICATION ---\n');
  const app = buildApp();
  const address = await app.listen({ port: 5055, host: '127.0.0.1' });
  console.log(`Server listening on ${address}`);

  const baseUrl = 'http://127.0.0.1:5055';
  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition: boolean, msg: string) {
    totalChecks++;
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passedChecks++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: POST /v1/events with valid ALLOW event
    // ----------------------------------------------------
    console.log('\n[1] Testing POST /v1/events (Valid ALLOW Event)...');
    const validAllowPayload = {
      method: 'GET',
      routeTemplate: '/api/v1/documents/{documentId}',
      resourceType: 'document',
      objectIdHash: '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b',
      subjectHash: 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35',
      tenantId: 'tenant-alpha',
      objectTenantId: 'tenant-alpha',
      decision: 'ALLOW',
      reason: 'OK_OWNER',
      authzLatencyUs: 220
    };

    const postRes1 = await fetch(`${baseUrl}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validAllowPayload)
    });

    assert(postRes1.status === 201, `Status code is 201 Created (got ${postRes1.status})`);
    const savedEvent1: any = await postRes1.json();
    assert(savedEvent1.decisionId && savedEvent1.decisionId.startsWith('dec_'), `Decision ID generated: ${savedEvent1.decisionId}`);
    assert(savedEvent1.decision === 'ALLOW', `Decision is ALLOW`);
    assert(savedEvent1.reason === 'OK_OWNER', `Reason is OK_OWNER`);

    // ----------------------------------------------------
    // TEST 2: GET /v1/events/:decisionId
    // ----------------------------------------------------
    console.log('\n[2] Testing GET /v1/events/{decisionId}...');
    const getByIdRes = await fetch(`${baseUrl}/v1/events/${savedEvent1.decisionId}`);
    assert(getByIdRes.status === 200, `Found event by ID status 200`);
    const fetchedEvent: any = await getByIdRes.json();
    assert(fetchedEvent.decisionId === savedEvent1.decisionId, `Event ID matches`);

    const getNotFoundRes = await fetch(`${baseUrl}/v1/events/dec_non_existent`);
    assert(getNotFoundRes.status === 404, `Non-existent event ID returns 404 Not Found (got ${getNotFoundRes.status})`);

    // ----------------------------------------------------
    // TEST 3: Privacy Violations Rejection
    // ----------------------------------------------------
    console.log('\n[3] Testing Privacy Invariant Rejections (POST /v1/events)...');
    const sensitivePayloads = [
      { field: 'authorization', data: { ...validAllowPayload, authorization: 'Bearer jwt.token.here' } },
      { field: 'cookie', data: { ...validAllowPayload, cookie: 'session=xyz' } },
      { field: 'token', data: { ...validAllowPayload, token: 'secret' } },
      { field: 'requestBody', data: { ...validAllowPayload, requestBody: '{"amount": 100}' } },
      { field: 'body', data: { ...validAllowPayload, body: 'raw body' } },
      { field: 'rawObjectId', data: { ...validAllowPayload, rawObjectId: 'doc-123' } },
      { field: 'rawUserId', data: { ...validAllowPayload, rawUserId: 'user-456' } }
    ];

    for (const testCase of sensitivePayloads) {
      const res = await fetch(`${baseUrl}/v1/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.data)
      });
      assert(res.status === 422, `Rejected sensitive field '${testCase.field}' with status 422 (got ${res.status})`);
    }

    // ----------------------------------------------------
    // TEST 4: Invalid Decision / Reason Enums
    // ----------------------------------------------------
    console.log('\n[4] Testing Validation of Decisions & Reasons...');
    const invalidDecisionRes = await fetch(`${baseUrl}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validAllowPayload, decision: 'INVALID_DECISION' })
    });
    assert(invalidDecisionRes.status === 400, `Rejected invalid decision with 400 (got ${invalidDecisionRes.status})`);

    const invalidReasonRes = await fetch(`${baseUrl}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validAllowPayload, reason: 'INVALID_REASON' })
    });
    assert(invalidReasonRes.status === 400, `Rejected invalid reason with 400 (got ${invalidReasonRes.status})`);

    // ----------------------------------------------------
    // TEST 5: Exact Statistics Verification (5 ALLOW, 3 BLOCK)
    // ----------------------------------------------------
    console.log('\n[5] Testing Exact Math on /v1/stats with 5 ALLOW + 3 BLOCK...');
    await eventStore.clear();

    const statsTestData = [
      // 5 ALLOW
      { decision: 'ALLOW', reason: 'OK_OWNER', tenant: 'tenant-a', latency: 100 },
      { decision: 'ALLOW', reason: 'OK_OWNER', tenant: 'tenant-a', latency: 150 },
      { decision: 'ALLOW', reason: 'OK_TENANT_SCOPE', tenant: 'tenant-a', latency: 200 },
      { decision: 'ALLOW', reason: 'OK_TENANT_SCOPE', tenant: 'tenant-b', latency: 250 },
      { decision: 'ALLOW', reason: 'OK_DELEGATION', tenant: 'tenant-b', latency: 300 },
      // 3 BLOCK
      { decision: 'BLOCK', reason: 'TENANT_MISMATCH', tenant: 'tenant-c', latency: 120 },
      { decision: 'BLOCK', reason: 'NOT_OWNER', tenant: 'tenant-c', latency: 180 },
      { decision: 'BLOCK', reason: 'NO_SCOPE', tenant: 'tenant-d', latency: 140 }
    ];

    for (const item of statsTestData) {
      await fetch(`${baseUrl}/v1/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'GET',
          routeTemplate: '/api/v1/test',
          resourceType: 'test',
          objectIdHash: 'hash1',
          subjectHash: 'sub1',
          tenantId: item.tenant,
          objectTenantId: item.tenant,
          decision: item.decision,
          reason: item.reason,
          authzLatencyUs: item.latency
        })
      });
    }

    const statsRes = await fetch(`${baseUrl}/v1/stats`);
    assert(statsRes.status === 200, `GET /v1/stats returned 200 OK`);
    const stats: any = await statsRes.json();

    assert(stats.totalEvents === 8, `totalEvents === 8 (got ${stats.totalEvents})`);
    assert(stats.allowed === 5, `allowed === 5 (got ${stats.allowed})`);
    assert(stats.blocked === 3, `blocked === 3 (got ${stats.blocked})`);
    assert(stats.blockRate === 37.5, `blockRate === 37.5% (got ${stats.blockRate})`);
    assert(stats.eventsByReason.OK_OWNER === 2, `eventsByReason.OK_OWNER === 2`);
    assert(stats.eventsByReason.OK_TENANT_SCOPE === 2, `eventsByReason.OK_TENANT_SCOPE === 2`);
    assert(stats.eventsByReason.OK_DELEGATION === 1, `eventsByReason.OK_DELEGATION === 1`);
    assert(stats.eventsByReason.TENANT_MISMATCH === 1, `eventsByReason.TENANT_MISMATCH === 1`);
    assert(stats.eventsByReason.NOT_OWNER === 1, `eventsByReason.NOT_OWNER === 1`);
    assert(stats.eventsByReason.NO_SCOPE === 1, `eventsByReason.NO_SCOPE === 1`);
    assert(stats.eventsByTenant['tenant-a'] === 3, `eventsByTenant['tenant-a'] === 3`);
    assert(stats.eventsByTenant['tenant-b'] === 2, `eventsByTenant['tenant-b'] === 2`);
    assert(stats.eventsByTenant['tenant-c'] === 2, `eventsByTenant['tenant-c'] === 2`);
    assert(stats.eventsByTenant['tenant-d'] === 1, `eventsByTenant['tenant-d'] === 1`);

    // Sum of latencies: 100+150+200+250+300+120+180+140 = 1440. Avg = 1440/8 = 180.0
    assert(stats.avgAuthzLatencyUs === 180, `avgAuthzLatencyUs === 180.0 (got ${stats.avgAuthzLatencyUs})`);

    // ----------------------------------------------------
    // TEST 6: Filtering & Limits on GET /v1/events
    // ----------------------------------------------------
    console.log('\n[6] Testing Filtering on GET /v1/events...');
    const filterBlockRes = await fetch(`${baseUrl}/v1/events?decision=BLOCK`);
    const blockedList: any = await filterBlockRes.json();
    assert(blockedList.length === 3, `Filter decision=BLOCK returned exactly 3 events (got ${blockedList.length})`);

    const filterTenantRes = await fetch(`${baseUrl}/v1/events?tenant=tenant-a`);
    const tenantAList: any = await filterTenantRes.json();
    assert(tenantAList.length === 3, `Filter tenant=tenant-a returned exactly 3 events (got ${tenantAList.length})`);

    const limitRes = await fetch(`${baseUrl}/v1/events?limit=2`);
    const limitList: any = await limitRes.json();
    assert(limitList.length === 2, `Limit=2 returned exactly 2 events (got ${limitList.length})`);

    // ----------------------------------------------------
    // TEST 7: Scans Endpoints (POST /v1/scans, GET /v1/scans, GET /v1/scans/:scanId)
    // ----------------------------------------------------
    console.log('\n[7] Testing Scan Endpoints...');
    await scanStore.clear();
    const scanPayload = {
      commit: 'git-commit-abc',
      target: 'http://sample-app:3000',
      summary: { total: 12, passed: 10, failed: 2 },
      findings: [
        {
          method: 'GET',
          routeTemplate: '/api/v1/documents/{documentId}',
          attackerTenant: 'tenant-beta',
          victimTenant: 'tenant-alpha',
          expectedStatus: 403,
          actualStatus: 200,
          severity: 'HIGH'
        },
        {
          method: 'DELETE',
          routeTemplate: '/api/v1/orders/{orderId}',
          attackerTenant: 'tenant-gamma',
          victimTenant: 'tenant-beta',
          expectedStatus: 403,
          actualStatus: 200,
          severity: 'MEDIUM'
        }
      ]
    };

    const postScanRes = await fetch(`${baseUrl}/v1/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scanPayload)
    });
    assert(postScanRes.status === 201, `POST /v1/scans returned 201 Created`);
    const savedScan: any = await postScanRes.json();
    assert(savedScan.scanId && savedScan.scanId.startsWith('scan_'), `Scan ID generated: ${savedScan.scanId}`);

    const getScansRes = await fetch(`${baseUrl}/v1/scans`);
    assert(getScansRes.status === 200, `GET /v1/scans returned 200`);
    const scansList: any = await getScansRes.json();
    assert(scansList.length === 1, `Scan list has 1 scan`);

    const getScanByIdRes = await fetch(`${baseUrl}/v1/scans/${savedScan.scanId}`);
    assert(getScanByIdRes.status === 200, `GET /v1/scans/{scanId} returned 200`);
    const singleScan: any = await getScanByIdRes.json();
    assert(singleScan.findings.length === 2, `Scan findings count === 2`);

    // ----------------------------------------------------
    // TEST 8: SSE Streaming Live Delivery
    // ----------------------------------------------------
    console.log('\n[8] Testing SSE Stream (GET /v1/events/stream)...');
    const controller = new AbortController();
    const sseRes = await fetch(`${baseUrl}/v1/events/stream`, {
      signal: controller.signal,
      headers: { 'Accept': 'text/event-stream' }
    });

    assert(sseRes.status === 200, `SSE connection established status 200`);
    assert(sseRes.headers.get('content-type')?.includes('text/event-stream') || false, `Content-Type is text/event-stream`);

    // Read the stream chunk
    const reader = sseRes.body?.getReader();
    let streamOutput = '';

    const readPromise = (async () => {
      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamOutput += new TextDecoder().decode(value);
        if (streamOutput.includes('dec_live_sse_test')) break;
      }
    })();

    // Post a live event while stream is open
    await fetch(`${baseUrl}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decisionId: 'dec_live_sse_test',
        method: 'POST',
        routeTemplate: '/api/v1/stream-check',
        resourceType: 'stream',
        objectIdHash: 'hash-sse',
        subjectHash: 'sub-sse',
        tenantId: 'tenant-sse',
        objectTenantId: 'tenant-sse',
        decision: 'ALLOW',
        reason: 'OK_OWNER',
        authzLatencyUs: 150
      })
    });

    await Promise.race([
      readPromise,
      new Promise((resolve) => setTimeout(resolve, 2000))
    ]);

    assert(streamOutput.includes('dec_live_sse_test'), `SSE client received event in real-time without polling`);
    controller.abort();

    console.log(`\n======================================================`);
    console.log(`VERIFICATION SUMMARY: ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log(`======================================================\n`);

  } finally {
    await app.close();
  }
}

runLiveVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
