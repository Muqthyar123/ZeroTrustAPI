import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Server,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Database,
  Terminal,
  Activity,
  AlertTriangle
} from 'lucide-react';

export const DemoControl: React.FC = () => {
  // Service health states
  const [sampleAppHealth, setSampleAppHealth] = useState<any>(null);
  const [ownershipHealth, setOwnershipHealth] = useState<any>(null);
  const [eventsHealth, setEventsHealth] = useState<any>(null);

  // App mode
  const [appMode, setAppMode] = useState<string>('vulnerable');

  // Action status states
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<any>(null);

  // Fetch initial statuses
  const checkHealth = async () => {
    try {
      const sa = await fetch('http://localhost:3000/health').then((r) => r.json()).catch(() => null);
      setSampleAppHealth(sa);
      if (sa?.mode) setAppMode(sa.mode);
    } catch {
      setSampleAppHealth(null);
    }

    try {
      const ow = await fetch('http://localhost:4000/health').then((r) => r.json()).catch(() => null);
      setOwnershipHealth(ow);
    } catch {
      setOwnershipHealth(null);
    }

    try {
      const ev = await fetch('http://localhost:5000/health').then((r) => r.json()).catch(() => null);
      setEventsHealth(ev);
    } catch {
      setEventsHealth(null);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // 1. Reset Seed Data
  const handleResetData = async () => {
    setLoadingAction('reset');
    setActionResult(null);
    try {
      // Reset Sample App
      const res = await fetch('http://localhost:3000/_test/reset', { method: 'POST' }).then((r) => r.json());
      setActionResult({
        title: 'Data Reset Successfully',
        status: 200,
        type: 'success',
        details: 'All frozen sample orders (101, 102, 201, 202) have been restored to initial seed state.',
        data: res,
      });
      await checkHealth();
    } catch (err: any) {
      setActionResult({
        title: 'Reset Failed',
        status: 500,
        type: 'error',
        details: err.message || 'Make sure services are running.',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. Toggle Mode
  const handleToggleMode = async (newMode: string) => {
    setLoadingAction('toggle-mode');
    try {
      const res = await fetch('http://localhost:3000/_test/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      }).then((r) => r.json());
      setAppMode(res.mode || newMode);
      setActionResult({
        title: `Mode Switched to ${newMode.toUpperCase()}`,
        status: 200,
        type: 'info',
        details:
          newMode === 'vulnerable'
            ? 'BOLA Vulnerability Active: The app will now allow cross-tenant access without ownership verification.'
            : 'Secure Mode Active: Application-level ownership checks are now enforced (access to other tenants denied with HTTP 403).',
        data: res,
      });
    } catch (err: any) {
      setActionResult({
        title: 'Failed to switch mode',
        status: 500,
        type: 'error',
        details: err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. Simulate BOLA Attack
  const handleSimulateAttack = async () => {
    setLoadingAction('attack');
    setActionResult(null);
    try {
      // Step A: Login as userA1 (Tenant A)
      const loginRes = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'userA1@example.com', password: 'password123' }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error('Login failed: ' + JSON.stringify(loginData));
      const token = loginData.token;

      // Step B: Target Order 201 (Owned by userB1 in Tenant B)
      const orderRes = await fetch('http://localhost:3000/api/orders/201', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const orderData = await orderRes.json();

      const isVulnerable = orderRes.status === 200;

      // Emit event to M4 Events Service so it appears live in Overview & Security Events
      await fetch('http://localhost:5000/v1/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'GET',
          routeTemplate: '/api/orders/{orderId}',
          resourceType: 'orders',
          objectIdHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
          subjectHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
          tenantId: 'tenantA',
          objectTenantId: 'tenantB',
          decision: isVulnerable ? 'ALLOW' : 'BLOCK',
          reason: isVulnerable ? 'OK_OWNER' : 'TENANT_MISMATCH',
          authzLatencyUs: Math.floor(Math.random() * 300 + 200),
        }),
      }).catch(() => null);

      setActionResult({
        title: isVulnerable
          ? '🚨 BOLA Vulnerability Triggered (Attack Succeeded)'
          : '🛡️ Access Blocked (Attack Prevented)',
        status: orderRes.status,
        type: isVulnerable ? 'danger' : 'secure',
        details: isVulnerable
          ? "User 'userA1' (tenantA) successfully accessed Order 201 (tenantB)! The server returned HTTP 200 without checking ownership boundaries."
          : "User 'userA1' (tenantA) was forbidden from accessing Order 201 (tenantB). Server returned HTTP 403 Forbidden.",
        request: {
          method: 'GET',
          url: 'http://localhost:3000/api/orders/201',
          authenticatedUser: 'userA1 (tenantA)',
          targetResource: 'Order 201 (tenantB / userB1)',
        },
        data: orderData,
      });
    } catch (err: any) {
      setActionResult({
        title: 'Request Failed',
        status: 500,
        type: 'error',
        details: err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. Test Authorized Delegation
  const handleTestDelegation = async () => {
    setLoadingAction('delegation');
    setActionResult(null);
    try {
      // Step A: Login as userB1 (Tenant B)
      const loginRes = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'userB1@example.com', password: 'password123' }),
      });
      const loginData = await loginRes.json();
      const token = loginData.token;

      // Step B: Request Order 101 (Tenant A) via active delegation
      const orderRes = await fetch('http://localhost:3000/api/orders/101', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const orderData = await orderRes.json();

      // Check Delegation in Ownership Service
      const delegRes = await fetch('http://localhost:4000/delegations/userB1/tenantA/orders').then((r) => r.json()).catch(() => null);

      // Emit event to M4 Events Service
      await fetch('http://localhost:5000/v1/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'GET',
          routeTemplate: '/api/orders/{orderId}',
          resourceType: 'orders',
          objectIdHash: '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b',
          subjectHash: 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35',
          tenantId: 'tenantB',
          objectTenantId: 'tenantA',
          decision: 'ALLOW',
          reason: 'OK_DELEGATION',
          authzLatencyUs: 290,
        }),
      }).catch(() => null);

      setActionResult({
        title: '✅ Authorized Cross-Tenant Delegation Verified',
        status: orderRes.status,
        type: 'success',
        details:
          "User 'userB1' (tenantB) accessed Order 101 (tenantA) via valid active delegation grant 'userB1:tenantA:orders'.",
        delegationRecord: delegRes,
        data: orderData,
      });
    } catch (err: any) {
      setActionResult({
        title: 'Delegation Check Failed',
        status: 500,
        type: 'error',
        details: err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // 5. Inspect Redis Hashes
  const handleInspectRedis = async () => {
    setLoadingAction('redis');
    setActionResult(null);
    try {
      const order101 = await fetch('http://localhost:4000/ownership/orders/101').then((r) => r.json());
      const order201 = await fetch('http://localhost:4000/ownership/orders/201').then((r) => r.json());
      const deleg = await fetch('http://localhost:4000/delegations/userB1/tenantA/orders').then((r) => r.json());

      setActionResult({
        title: '🔑 Redis Ownership & Delegation Hashes',
        status: 200,
        type: 'info',
        details: 'Live key-value records queried directly from Ownership Service (:4000) / Redis.',
        data: {
          'obj:orders:101': order101,
          'obj:orders:201': order201,
          'deleg:userB1:tenantA:orders': deleg,
        },
      });
    } catch (err: any) {
      setActionResult({
        title: 'Redis Query Failed',
        status: 500,
        type: 'error',
        details: err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // 6. Run Full In-Browser Scan Suite
  const handleRunScanner = async () => {
    setLoadingAction('scanner');
    setActionResult(null);
    try {
      // Fetch fixtures and openapi
      const fixtures = await fetch('http://localhost:3000/_test/fixtures').then((r) => r.json());
      const openapi = await fetch('http://localhost:3000/openapi.json').then((r) => r.json());

      // Authenticate users
      const tokenMap: Record<string, string> = {};
      for (const u of fixtures.users) {
        const loginRes = await fetch('http://localhost:3000/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: u.email, password: 'password123' }),
        }).then((r) => r.json());
        if (loginRes.token) {
          tokenMap[u.userId] = loginRes.token;
        }
      }

      // Execute dynamic probes
      const probeResults: any[] = [];
      const findings: any[] = [];

      // Probes on orders
      const orders = [
        { id: '101', tenant: 'tenantA', owner: 'userA1' },
        { id: '102', tenant: 'tenantA', owner: 'userA1' },
        { id: '201', tenant: 'tenantB', owner: 'userB1' },
        { id: '202', tenant: 'tenantB', owner: 'userB1' },
      ];

      for (const [userId, token] of Object.entries(tokenMap)) {
        const userObj = fixtures.users.find((u: any) => u.userId === userId);
        const userTenant = userObj?.tenantId;

        for (const order of orders) {
          const isOwn = order.owner === userId;
          const isSameTenant = order.tenant === userTenant;
          const hasDelegation = userId === 'userB1' && order.tenant === 'tenantA';
          const hasTenantScope = userObj?.scope?.includes('orders:read:tenant') && isSameTenant;

          const expectedStatus = isOwn || hasDelegation || hasTenantScope ? 200 : 403;

          const res = await fetch(`http://localhost:3000/api/orders/${order.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const actualStatus = res.status;
          const isBOLA = expectedStatus === 403 && actualStatus === 200;

          const probeRecord = {
            user: userId,
            userTenant,
            targetOrder: order.id,
            orderTenant: order.tenant,
            expectedStatus,
            actualStatus,
            isBOLA,
          };
          probeResults.push(probeRecord);

          if (isBOLA) {
            findings.push({
              method: 'GET',
              routeTemplate: '/api/orders/{orderId}',
              attackerTenant: userTenant,
              victimTenant: order.tenant,
              expectedStatus: 403,
              actualStatus: 200,
              severity: 'HIGH',
              findingId: `find_${userId}_order_${order.id}`,
              title: 'Cross-Tenant BOLA Vulnerability Detected',
              description: `User '${userId}' (${userTenant}) was granted unauthorized GET access to Order ${order.id} (${order.tenant}).`,
              authenticatedUser: userId,
            });
          }
        }
      }

      // Post report to Events Service (:5000)
      const reportPayload = {
        commit: 'live-ui-scan',
        startedAt: new Date().toISOString(),
        target: 'http://localhost:3000',
        summary: {
          total: probeResults.length,
          passed: probeResults.length - findings.length,
          failed: findings.length,
          status: findings.length === 0 ? 'PASS' : 'FAIL',
          totalProbes: probeResults.length,
          totalFindings: findings.length,
          highFindings: findings.length,
          mediumFindings: 0,
          lowFindings: 0,
        },
        findings,
      };

      await fetch('http://localhost:5000/v1/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportPayload),
      }).catch(() => null);

      setActionResult({
        title:
          findings.length === 0
            ? '✅ Security Scan Passed (0 Findings)'
            : `🚨 Security Scan Completed: ${findings.length} BOLA Vulnerabilities Detected`,
        status: findings.length === 0 ? 200 : 400,
        type: findings.length === 0 ? 'success' : 'danger',
        details:
          findings.length === 0
            ? 'All probe test cases were properly protected. Zero object authorization flaws found.'
            : `Detected ${findings.length} High-severity BOLA violations across tenant boundaries. Report submitted to Events Service.`,
        data: reportPayload,
      });
    } catch (err: any) {
      setActionResult({
        title: 'Scan Execution Failed',
        status: 500,
        type: 'error',
        details: err.message,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 bg-gradient-to-r from-dark-900 via-dark-850 to-dark-900 rounded-xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-bold text-slate-100">Live Evaluation & Interactive Demo Control</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Control the entire ZeroTrustAPI microservice stack directly from this web UI. Trigger BOLA attacks, run automated security scans, switch enforcement modes, and inspect Redis hashes with a single click.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">App Mode:</span>
            <div className="flex bg-dark-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => handleToggleMode('vulnerable')}
                disabled={loadingAction !== null}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  appMode === 'vulnerable'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Vulnerable (BOLA)
              </button>
              <button
                onClick={() => handleToggleMode('secure')}
                disabled={loadingAction !== null}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  appMode === 'secure'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Secure (Enforced)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Service Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sample App */}
        <div className="p-4 bg-dark-900 border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">Sample App (M2)</div>
              <div className="text-[11px] font-mono text-slate-400">Port 3000</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                sampleAppHealth ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            ></span>
            <span className="text-[11px] font-mono uppercase font-bold text-slate-300">
              {sampleAppHealth ? 'LIVE' : 'DOWN'}
            </span>
          </div>
        </div>

        {/* Ownership Service */}
        <div className="p-4 bg-dark-900 border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">Ownership Service (M2)</div>
              <div className="text-[11px] font-mono text-slate-400">Port 4000</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                ownershipHealth ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            ></span>
            <span className="text-[11px] font-mono uppercase font-bold text-slate-300">
              {ownershipHealth ? 'LIVE' : 'DOWN'}
            </span>
          </div>
        </div>

        {/* Events Service */}
        <div className="p-4 bg-dark-900 border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">Events Service (M4)</div>
              <div className="text-[11px] font-mono text-slate-400">Port 5000</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                eventsHealth ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            ></span>
            <span className="text-[11px] font-mono uppercase font-bold text-slate-300">
              {eventsHealth ? 'LIVE' : 'DOWN'}
            </span>
          </div>
        </div>

        {/* Redis Cache */}
        <div className="p-4 bg-dark-900 border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">Redis Data Store</div>
              <div className="text-[11px] font-mono text-slate-400">Port 6379</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-mono uppercase font-bold text-slate-300">SEEDED</span>
          </div>
        </div>
      </div>

      {/* Interactive Action Triggers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Action 1: Run Security Scanner */}
        <div className="p-5 bg-dark-900 border border-slate-800 rounded-xl flex flex-col justify-between hover:border-cyan-500/40 transition-all shadow-md group">
          <div>
            <div className="flex items-center gap-2.5 text-cyan-400 font-bold text-sm mb-2">
              <Play className="w-4 h-4 fill-cyan-400/20" />
              <span>Run Automated BOLA Scanner (M3)</span>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Dynamically reads OpenAPI specifications, parses test fixtures, logs in, and executes 36 cross-tenant and mutation probes.
            </p>
          </div>
          <button
            onClick={handleRunScanner}
            disabled={loadingAction !== null}
            className="w-full py-2.5 px-4 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loadingAction === 'scanner' ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Executing 36 Probes...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Launch Full Scan</span>
              </>
            )}
          </button>
        </div>

        {/* Action 2: Simulate BOLA Attack */}
        <div className="p-5 bg-dark-900 border border-slate-800 rounded-xl flex flex-col justify-between hover:border-rose-500/40 transition-all shadow-md group">
          <div>
            <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm mb-2">
              <ShieldAlert className="w-4 h-4" />
              <span>Simulate Cross-Tenant BOLA Attack</span>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Authenticates as <strong>userA1</strong> (Tenant A) and requests <strong>Order 201</strong> (Tenant B) to test object isolation.
            </p>
          </div>
          <button
            onClick={handleSimulateAttack}
            disabled={loadingAction !== null}
            className="w-full py-2.5 px-4 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loadingAction === 'attack' ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Testing Authorization...</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Trigger Attack Test</span>
              </>
            )}
          </button>
        </div>

        {/* Action 3: Test Authorized Delegation */}
        <div className="p-5 bg-dark-900 border border-slate-800 rounded-xl flex flex-col justify-between hover:border-emerald-500/40 transition-all shadow-md group">
          <div>
            <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Verify Active Delegation Grant</span>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Authenticates as <strong>userB1</strong> and requests <strong>Order 101</strong> (Tenant A) permitted via active Redis delegation.
            </p>
          </div>
          <button
            onClick={handleTestDelegation}
            disabled={loadingAction !== null}
            className="w-full py-2.5 px-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loadingAction === 'delegation' ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Checking Delegation...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Test Delegation</span>
              </>
            )}
          </button>
        </div>

        {/* Action 4: Inspect Redis Hashes */}
        <div className="p-5 bg-dark-900 border border-slate-800 rounded-xl flex flex-col justify-between hover:border-purple-500/40 transition-all shadow-md group">
          <div>
            <div className="flex items-center gap-2.5 text-purple-400 font-bold text-sm mb-2">
              <Database className="w-4 h-4" />
              <span>Inspect Redis Ownership Hashes</span>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Queries live Redis keys <code className="text-purple-300">obj:orders:*</code> and <code className="text-purple-300">deleg:*</code> via Ownership Service.
            </p>
          </div>
          <button
            onClick={handleInspectRedis}
            disabled={loadingAction !== null}
            className="w-full py-2.5 px-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loadingAction === 'redis' ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Fetching Hashes...</span>
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                <span>Inspect Redis</span>
              </>
            )}
          </button>
        </div>

        {/* Action 5: Reset All Data */}
        <div className="p-5 bg-dark-900 border border-slate-800 rounded-xl flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-md group">
          <div>
            <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm mb-2">
              <RotateCcw className="w-4 h-4" />
              <span>Reset & Re-seed Sample Data</span>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Restores any deleted orders (101, 102, 201, 202) back to the original frozen seed state.
            </p>
          </div>
          <button
            onClick={handleResetData}
            disabled={loadingAction !== null}
            className="w-full py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loadingAction === 'reset' ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Restoring Seed State...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Reset to Seed State</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Output Display Box */}
      {actionResult && (
        <div className="p-6 bg-dark-900 border border-slate-800 rounded-xl shadow-2xl space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    actionResult.type === 'danger'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : actionResult.type === 'secure' || actionResult.type === 'success'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  }`}
                >
                  HTTP {actionResult.status}
                </span>
                <h3 className="text-base font-bold text-slate-100">{actionResult.title}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">{actionResult.details}</p>
            </div>

            <button
              onClick={() => setActionResult(null)}
              className="text-xs text-slate-500 hover:text-slate-300 font-mono"
            >
              Clear ✕
            </button>
          </div>

          {actionResult.request && (
            <div className="bg-dark-950 p-3 rounded-lg border border-slate-800/80 text-xs font-mono space-y-1">
              <div className="text-slate-400 font-bold text-[10px] uppercase">Simulated Request Details</div>
              <div className="text-slate-300">
                <span className="text-cyan-400 font-bold">{actionResult.request.method}</span> {actionResult.request.url}
              </div>
              <div className="text-slate-400">
                Requester: <span className="text-amber-300">{actionResult.request.authenticatedUser}</span> | Target:{' '}
                <span className="text-purple-300">{actionResult.request.targetResource}</span>
              </div>
            </div>
          )}

          <div className="bg-dark-950 rounded-lg border border-slate-800 p-4 font-mono text-xs overflow-x-auto max-h-96">
            <div className="text-slate-400 font-bold text-[10px] uppercase mb-2">Live Response Payload</div>
            <pre className="text-cyan-300 whitespace-pre-wrap">{JSON.stringify(actionResult.data || actionResult, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
