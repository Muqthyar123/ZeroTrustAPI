import React from 'react';
import { SecurityEvent } from '../types';
import { ThreatBadge } from './ThreatBadge';
import { Radio, Zap, Clock } from 'lucide-react';

interface LiveEventFeedProps {
  events: SecurityEvent[];
  onSelectEvent?: (event: SecurityEvent) => void;
}

export const LiveEventFeed: React.FC<LiveEventFeedProps> = ({ events, onSelectEvent }) => {
  return (
    <div className="bg-dark-900/90 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full shadow-lg">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-dark-850">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Live Stream
          </span>
        </div>
        <span className="text-[11px] font-mono text-cyan-400 font-semibold flex items-center gap-1">
          <Zap className="w-3 h-3" />
          SSE Active
        </span>
      </div>

      <div className="p-3 overflow-y-auto space-y-2.5 flex-1 max-h-[480px]">
        {events.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <Radio className="w-6 h-6 mx-auto mb-2 opacity-40 animate-pulse text-cyan-400" />
            Waiting for live telemetry events...
          </div>
        ) : (
          events.slice(0, 20).map((event) => {
            const isAllow = event.decision === 'ALLOW';
            return (
              <div
                key={event.decisionId}
                onClick={() => onSelectEvent?.(event)}
                className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 hover:scale-[1.01] ${
                  isAllow
                    ? 'bg-emerald-950/10 border-emerald-900/30 hover:border-emerald-700/50'
                    : 'bg-rose-950/10 border-rose-900/30 hover:border-rose-700/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <ThreatBadge decision={event.decision} size="sm" />
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="font-mono text-xs font-semibold text-slate-200 truncate">
                  <span className="text-cyan-400 mr-1.5">{event.method}</span>
                  <span>{event.routeTemplate}</span>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <ThreatBadge reason={event.reason} size="sm" />
                  <span className="font-mono text-slate-400 text-[10px]">
                    {event.authzLatencyUs} µs
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
