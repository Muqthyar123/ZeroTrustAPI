import React from 'react';
import { SecurityEvent } from '../types';
import { ThreatBadge } from './ThreatBadge';
import { ChevronRight, Clock } from 'lucide-react';

interface EventRowProps {
  event: SecurityEvent;
  onSelect: (event: SecurityEvent) => void;
}

export const EventRow: React.FC<EventRowProps> = ({ event, onSelect }) => {
  const formattedTime = new Date(event.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <tr
      onClick={() => onSelect(event)}
      className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors duration-150 text-xs font-mono"
    >
      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{formattedTime}</span>
        </div>
      </td>
      <td className="py-3 px-4 whitespace-nowrap">
        <span className="px-2 py-0.5 rounded bg-slate-800 font-bold text-cyan-400 border border-slate-700">
          {event.method}
        </span>
      </td>
      <td className="py-3 px-4 text-slate-200 font-medium max-w-[240px] truncate">
        {event.routeTemplate}
      </td>
      <td className="py-3 px-4 text-slate-300">
        <span className="px-2 py-0.5 rounded bg-dark-850 border border-slate-800 text-slate-300">
          {event.tenantId}
        </span>
      </td>
      <td className="py-3 px-4 whitespace-nowrap">
        <ThreatBadge decision={event.decision} size="sm" />
      </td>
      <td className="py-3 px-4 whitespace-nowrap">
        <ThreatBadge reason={event.reason} size="sm" />
      </td>
      <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-right font-mono">
        {event.authzLatencyUs} µs
      </td>
      <td className="py-3 px-2 text-slate-500 text-right">
        <ChevronRight className="w-4 h-4 inline-block opacity-60" />
      </td>
    </tr>
  );
};
