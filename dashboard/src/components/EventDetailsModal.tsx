import React, { useState } from 'react';
import { SecurityEvent, REASON_DESCRIPTIONS } from '../types';
import { ThreatBadge } from './ThreatBadge';
import {
  X,
  Copy,
  Check,
  Shield,
  Clock,
  Key,
  Database,
  Building,
  Info,
  Timer
} from 'lucide-react';

interface EventDetailsModalProps {
  event: SecurityEvent | null;
  onClose: () => void;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ event, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!event) return null;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isBlock = event.decision === 'BLOCK';
  const explanation =
    REASON_DESCRIPTIONS[event.reason] ||
    'Security decision executed by ZeroTrust Gateway policy engine.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-dark-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-dark-850">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${isBlock ? 'bg-rose-950/60 border-rose-800 text-rose-400' : 'bg-emerald-950/60 border-emerald-800 text-emerald-400'}`}>
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
                {event.decisionId}
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {new Date(event.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-dark-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col gap-2 ${
              isBlock
                ? 'bg-rose-950/30 border-rose-900/60 text-rose-200'
                : 'bg-emerald-950/30 border-emerald-900/60 text-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ThreatBadge decision={event.decision} size="md" />
                <ThreatBadge reason={event.reason} size="md" />
              </div>
              <div className="flex items-center gap-1 text-xs font-mono font-semibold text-slate-300">
                <Timer className="w-4 h-4 text-cyan-400" />
                <span>{event.authzLatencyUs} µs</span>
              </div>
            </div>
            <div className="mt-2 text-xs flex items-start gap-2 pt-2 border-t border-slate-800/60">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
              <span className="font-sans leading-relaxed text-slate-300">
                <strong className="text-white">Explanation:</strong> {explanation}
              </span>
            </div>
          </div>

          {/* Request Path & Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
              HTTP Endpoint Template
            </label>
            <div className="p-3 rounded-lg bg-dark-950 border border-slate-800 font-mono text-xs flex items-center justify-between">
              <div>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-bold mr-2 border border-slate-700">
                  {event.method}
                </span>
                <span className="text-slate-200 font-semibold">{event.routeTemplate}</span>
              </div>
              <span className="text-[11px] text-slate-400 px-2 py-0.5 rounded bg-dark-850 border border-slate-800">
                Type: {event.resourceType}
              </span>
            </div>
          </div>

          {/* Tenant Isolation Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-dark-950 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <Building className="w-3.5 h-3.5 text-cyan-400" />
                <span>Subject Tenant (Requester)</span>
              </div>
              <div className="text-sm font-mono font-bold text-slate-200">
                {event.tenantId}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Object Tenant (Resource Owner)</span>
              </div>
              <div className="text-sm font-mono font-bold text-slate-200 flex items-center justify-between">
                <span>{event.objectTenantId}</span>
                {event.tenantId !== event.objectTenantId && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                    Mismatch
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Anonymized Privacy Hashes */}
          <div className="space-y-3">
            <label className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>Anonymized Identifiers (Zero Raw PII)</span>
            </label>

            {/* Subject Hash */}
            <div className="p-3 rounded-lg bg-dark-950 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Subject Hash (SHA-256)</span>
                <button
                  onClick={() => handleCopy(event.subjectHash, 'subject')}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                >
                  {copiedField === 'subject' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === 'subject' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="font-mono text-xs text-slate-300 truncate">
                {event.subjectHash}
              </div>
            </div>

            {/* Object Hash */}
            <div className="p-3 rounded-lg bg-dark-950 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Object ID Hash (SHA-256)</span>
                <button
                  onClick={() => handleCopy(event.objectIdHash, 'object')}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                >
                  {copiedField === 'object' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === 'object' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="font-mono text-xs text-slate-300 truncate">
                {event.objectIdHash}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-dark-850 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            ZeroTrust Privacy Compliance: Verified Redacted
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
