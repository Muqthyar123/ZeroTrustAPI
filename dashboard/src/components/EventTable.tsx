import React from 'react';
import { SecurityEvent } from '../types';
import { EventRow } from './EventRow';
import { Search, ShieldCheck, ShieldAlert, Layers } from 'lucide-react';

interface EventTableProps {
  events: SecurityEvent[];
  loading?: boolean;
  onSelectEvent: (event: SecurityEvent) => void;
  filterDecision?: string;
  onFilterDecisionChange?: (val: string) => void;
  filterTenant?: string;
  onFilterTenantChange?: (val: string) => void;
  limit?: number;
  onLimitChange?: (val: number) => void;
  title?: string;
}

export const EventTable: React.FC<EventTableProps> = ({
  events,
  loading,
  onSelectEvent,
  filterDecision = '',
  onFilterDecisionChange,
  filterTenant = '',
  onFilterTenantChange,
  limit = 50,
  onLimitChange,
  title = 'Security Decisions Telemetry'
}) => {
  return (
    <div className="bg-dark-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-dark-850">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            {title}
          </h2>
          <p className="text-xs text-slate-400">
            Real-time audit log of all gateway zero-trust policy decisions
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Decision Filter */}
          {onFilterDecisionChange && (
            <div className="flex rounded-lg border border-slate-800 bg-dark-950 p-0.5 text-xs">
              <button
                onClick={() => onFilterDecisionChange('')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  filterDecision === ''
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => onFilterDecisionChange('ALLOW')}
                className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1 ${
                  filterDecision === 'ALLOW'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 shadow-sm'
                    : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                Allow
              </button>
              <button
                onClick={() => onFilterDecisionChange('BLOCK')}
                className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1 ${
                  filterDecision === 'BLOCK'
                    ? 'bg-rose-950 text-rose-400 border border-rose-800 shadow-sm'
                    : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                <ShieldAlert className="w-3 h-3" />
                Block
              </button>
            </div>
          )}

          {/* Tenant Search Filter */}
          {onFilterTenantChange && (
            <div className="relative flex-1 md:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter tenant..."
                value={filterTenant}
                onChange={(e) => onFilterTenantChange(e.target.value)}
                className="w-full bg-dark-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          )}

          {/* Limit Selector */}
          {onLimitChange && (
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="bg-dark-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-dark-950/60 text-[11px] font-mono uppercase tracking-wider text-slate-400">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4">Route Template</th>
              <th className="py-3 px-4">Tenant</th>
              <th className="py-3 px-4">Decision</th>
              <th className="py-3 px-4">Reason</th>
              <th className="py-3 px-4 text-right">Latency</th>
              <th className="py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-800/40 animate-pulse">
                  <td className="py-3.5 px-4"><div className="h-4 bg-slate-800 rounded w-16" /></td>
                  <td className="py-3.5 px-4"><div className="h-4 bg-slate-800 rounded w-12" /></td>
                  <td className="py-3.5 px-4"><div className="h-4 bg-slate-800 rounded w-48" /></td>
                  <td className="py-3.5 px-4"><div className="h-4 bg-slate-800 rounded w-20" /></td>
                  <td className="py-3.5 px-4"><div className="h-4 bg-slate-800 rounded w-16" /></td>
                  <td className="py-3.5 px-4"><div className="h-4 bg-slate-800 rounded w-28" /></td>
                  <td className="py-3.5 px-4 text-right"><div className="h-4 bg-slate-800 rounded w-12 ml-auto" /></td>
                  <td className="py-3.5 px-2"></td>
                </tr>
              ))
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500 text-xs font-mono">
                  No security decision events match the current filter criteria.
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <EventRow key={event.decisionId} event={event} onSelect={onSelectEvent} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
