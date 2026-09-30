import React, { useState, useEffect } from 'react';
import { ScanResult } from '../types';
import { ScanTable } from '../components/ScanTable';
import { fetchScans, runScannerApi } from '../services/api';
import {
  SearchCode,
  Play,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  Activity,
  ArrowRight,
  Zap,
  Globe,
  FileCode,
  Database,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export const Scans: React.FC = () => {
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Scanner execution form states
  const [targetUrl, setTargetUrl] = useState<string>('http://localhost:8080');
  const [openapiUrl, setOpenapiUrl] = useState<string>('http://localhost:8080/openapi.json');
  const [fixturesUrl, setFixturesUrl] = useState<string>('http://localhost:8080/_test/fixtures');
  
  // Execution status
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [scanOutput, setScanOutput] = useState<string | null>(null);
  const [showConsole, setShowConsole] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadScans = async () => {
    try {
      const data = await fetchScans();
      setScans(data);
      if (data.length > 0 && !selectedScanId) {
        setSelectedScanId(data[0].scanId);
      }
    } catch (err) {
      console.error('Failed to load scans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScans();
  }, []);

  const handleSelectPreset = (target: string) => {
    setTargetUrl(target);
    setOpenapiUrl(`${target}/openapi.json`);
    setFixturesUrl(`${target}/_test/fixtures`);
  };

  const handleRunScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScanning(true);
    setCurrentStep(1);
    setScanOutput(null);
    setErrorMsg(null);
    setShowConsole(true);

    try {
      // Step simulation for visual feedback
      const stepTimer1 = setTimeout(() => setCurrentStep(2), 500);
      const stepTimer2 = setTimeout(() => setCurrentStep(3), 1100);
      const stepTimer3 = setTimeout(() => setCurrentStep(4), 1800);

      const result = await runScannerApi({
        targetUrl,
        openapiUrl,
        fixturesUrl,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      setCurrentStep(5);
      setScanOutput(result.stdout || 'Scan completed successfully.');

      // Refresh scans from backend
      const updated = await fetchScans();
      setScans(updated);
      if (updated.length > 0) {
        setSelectedScanId(updated[0].scanId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Scan execution failed');
      setCurrentStep(0);
    } finally {
      setIsScanning(false);
    }
  };

  const activeScan = scans.find((s) => s.scanId === selectedScanId) || scans[0] || null;

  return (
    <div className="space-y-6">
      {/* Interactive Scan API Trigger Form */}
      <div className="bg-dark-900/90 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
              <SearchCode className="w-5 h-5 text-cyan-400" />
              <span>Automated BOLA Security Scanner (M3 Engine)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter an API target or select a preset below to trigger dynamic OpenAPI discovery and on-demand BOLA probe evaluation.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectPreset('http://localhost:8080')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                targetUrl.includes('8080')
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700 shadow-sm shadow-emerald-950/50'
                  : 'bg-dark-850 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Protected Gateway (:8080)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPreset('http://localhost:3000')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
                targetUrl.includes('3000')
                  ? 'bg-rose-950/60 text-rose-400 border-rose-700 shadow-sm shadow-rose-950/50'
                  : 'bg-dark-850 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Vulnerable Direct App (:3000)</span>
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleRunScan} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>Target API URL</span>
              </label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => {
                  setTargetUrl(e.target.value);
                  setOpenapiUrl(`${e.target.value}/openapi.json`);
                  setFixturesUrl(`${e.target.value}/_test/fixtures`);
                }}
                required
                placeholder="http://localhost:8080"
                className="w-full px-3 py-2 bg-dark-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-purple-400" />
                <span>OpenAPI JSON URL</span>
              </label>
              <input
                type="url"
                value={openapiUrl}
                onChange={(e) => setOpenapiUrl(e.target.value)}
                required
                placeholder="http://localhost:8080/openapi.json"
                className="w-full px-3 py-2 bg-dark-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Fixtures URL</span>
              </label>
              <input
                type="url"
                value={fixturesUrl}
                onChange={(e) => setFixturesUrl(e.target.value)}
                required
                placeholder="http://localhost:8080/_test/fixtures"
                className="w-full px-3 py-2 bg-dark-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>Executes 36 BOLA Probes Only During Scan</span>
            </div>

            <button
              type="submit"
              disabled={isScanning}
              className={`px-6 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg ${
                isScanning
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-700 cursor-not-allowed animate-pulse'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-950/40 hover:scale-[1.02]'
              }`}
            >
              {isScanning ? (
                <>
                  <Activity className="w-4 h-4 animate-spin text-cyan-300" />
                  <span>Scanning in Progress...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Scan API</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Workflow Visualizer Step Tracker */}
        {isScanning && (
          <div className="pt-4 border-t border-slate-800 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300">
              <span className="font-bold text-cyan-400 uppercase tracking-wider">
                Scan Pipeline Execution
              </span>
              <span className="text-slate-500">Step {currentStep} of 5</span>
            </div>

            <div className="grid grid-cols-5 gap-2 text-[10px] font-mono">
              <div
                className={`p-2 rounded border text-center ${
                  currentStep >= 1
                    ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300'
                    : 'bg-dark-950 border-slate-800 text-slate-600'
                }`}
              >
                1. Load OpenAPI
              </div>
              <div
                className={`p-2 rounded border text-center ${
                  currentStep >= 2
                    ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300'
                    : 'bg-dark-950 border-slate-800 text-slate-600'
                }`}
              >
                2. Auth Fixtures
              </div>
              <div
                className={`p-2 rounded border text-center ${
                  currentStep >= 3
                    ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300'
                    : 'bg-dark-950 border-slate-800 text-slate-600'
                }`}
              >
                3. Generate Probes
              </div>
              <div
                className={`p-2 rounded border text-center ${
                  currentStep >= 4
                    ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300'
                    : 'bg-dark-950 border-slate-800 text-slate-600'
                }`}
              >
                4. Execute 36 Probes
              </div>
              <div
                className={`p-2 rounded border text-center ${
                  currentStep >= 5
                    ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                    : 'bg-dark-950 border-slate-800 text-slate-600'
                }`}
              >
                5. Complete Report
              </div>
            </div>
          </div>
        )}

        {/* Error Alert if any */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-xs font-mono text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Collapsible Console Output */}
        {scanOutput && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowConsole(!showConsole)}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 mb-2"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{showConsole ? 'Hide Scanner Terminal Output' : 'View Scanner Terminal Output'}</span>
            </button>

            {showConsole && (
              <pre className="p-4 bg-dark-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60 leading-relaxed">
                {scanOutput}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Scan History Switcher if multiple scans exist */}
      {scans.length > 1 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Recorded Scans History ({scans.length})
          </span>

          <select
            value={selectedScanId}
            onChange={(e) => setSelectedScanId(e.target.value)}
            className="px-3 py-1.5 bg-dark-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {scans.map((s) => (
              <option key={s.scanId} value={s.scanId}>
                {s.scanId} — {s.target} ({s.summary.failed > 0 ? `${s.summary.failed} Failed` : 'PASS'})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main Scan Findings & Summary Table */}
      <ScanTable scans={activeScan ? [activeScan] : scans} loading={loading} />
    </div>
  );
};
