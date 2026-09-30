import React from 'react';
import { ScanResult } from '../types';
import { ThreatBadge } from './ThreatBadge';
import {
  SearchCode,
  GitCommit,
  Clock,
  Target,
  ShieldAlert,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

interface ScanTableProps {
  scans: ScanResult[];
  loading?: boolean;
}

export const ScanTable: React.FC<ScanTableProps> = ({ scans, loading }) => {
  if (loading) {
    return (
      <div className="bg-dark-900 border border-slate-800 rounded-xl p-8 text-center animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-48 mx-auto mb-4" />
        <div className="h-4 bg-slate-800 rounded w-96 mx-auto" />
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="bg-dark-900 border border-slate-800 rounded-xl p-12 text-center">
        <SearchCode className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <h3 className="text-base font-semibold text-slate-300">No Security Scans Recorded</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Security scans executed by Member 3's scanner will automatically populate findings and BOLA vulnerability detection here.
        </p>
      </div>
    );
  }

  const latestScan = scans[0];
  const hasFailures = latestScan.summary.failed > 0;

  return (
    <div className="space-y-6">
      {/* Latest Scan Summary Card */}
      <div className="bg-dark-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-dark-850">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
                <SearchCode className="w-5 h-5 text-cyan-400" />
                {latestScan.scanId}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  hasFailures
                    ? 'bg-rose-950/60 text-rose-400 border-rose-800'
                    : 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                }`}
              >
                {hasFailures ? 'Vulnerabilities Detected' : 'All Checks Passed'}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
                {latestScan.commit}
              </span>
              <span className="flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-purple-400" />
                {latestScan.target}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {new Date(latestScan.startedAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Test Stats Pills */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-2 bg-dark-950 rounded-lg border border-slate-800 text-center min-w-[70px]">
              <div className="text-xs text-slate-400 font-mono uppercase">Total</div>
              <div className="text-lg font-bold font-mono text-slate-200">{latestScan.summary.total}</div>
            </div>
            <div className="px-3 py-2 bg-emerald-950/30 rounded-lg border border-emerald-900/50 text-center min-w-[70px]">
              <div className="text-xs text-emerald-400 font-mono uppercase">Passed</div>
              <div className="text-lg font-bold font-mono text-emerald-400">{latestScan.summary.passed}</div>
            </div>
            <div className="px-3 py-2 bg-rose-950/30 rounded-lg border border-rose-900/50 text-center min-w-[70px]">
              <div className="text-xs text-rose-400 font-mono uppercase">Failed</div>
              <div className="text-lg font-bold font-mono text-rose-400">{latestScan.summary.failed}</div>
            </div>
          </div>
        </div>

        {/* Findings Table */}
        <div className="p-5">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Vulnerability Findings ({latestScan.findings.length})</span>
          </h3>

          {latestScan.findings.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-emerald-400 bg-emerald-950/10 border border-emerald-900/30 rounded-lg">
              <ShieldCheck className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
              Clean Scan: Zero security policy violations or BOLA breaches detected.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-dark-950/60 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Route Template</th>
                    <th className="py-2.5 px-3">Breach Vector (Attacker → Target)</th>
                    <th className="py-2.5 px-3 text-center">Expected</th>
                    <th className="py-2.5 px-3 text-center">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {latestScan.findings.map((f, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <ThreatBadge severity={f.severity} size="sm" />
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-bold border border-slate-700">
                          {f.method}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-200">
                        {f.routeTemplate}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span className="text-rose-400 font-bold">{f.attackerTenant}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-slate-400">{f.victimTenant}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          {f.expectedStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-bold">
                          {f.actualStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
