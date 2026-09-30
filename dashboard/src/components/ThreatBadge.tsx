import React from 'react';
import { DecisionType, DecisionReason, SeverityType } from '../types';
import { ShieldCheck, ShieldAlert, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface ThreatBadgeProps {
  decision?: DecisionType;
  reason?: DecisionReason;
  severity?: SeverityType;
  size?: 'sm' | 'md' | 'lg';
}

export const ThreatBadge: React.FC<ThreatBadgeProps> = ({
  decision,
  reason,
  severity,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  }[size];

  if (decision) {
    const isAllow = decision === 'ALLOW';
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold rounded-full border transition-all duration-200 ${sizeClasses} ${
          isAllow
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-950'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-sm shadow-rose-950'
        }`}
      >
        {isAllow ? (
          <ShieldCheck className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        ) : (
          <ShieldAlert className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        )}
        <span>{decision}</span>
      </span>
    );
  }

  if (reason) {
    const isBlocked = [
      'TENANT_MISMATCH',
      'NOT_OWNER',
      'NO_SCOPE',
      'UNKNOWN_OBJECT',
      'INVALID_TOKEN'
    ].includes(reason);

    return (
      <span
        className={`inline-flex items-center gap-1 font-mono rounded border ${sizeClasses} ${
          isBlocked
            ? 'bg-rose-950/40 text-rose-300 border-rose-800/40'
            : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? 'bg-rose-400' : 'bg-emerald-400'}`} />
        {reason}
      </span>
    );
  }

  if (severity) {
    const styles: Record<SeverityType, { bg: string; text: string; border: string; icon: any }> = {
      CRITICAL: {
        bg: 'bg-purple-950/50',
        text: 'text-purple-300',
        border: 'border-purple-600/50',
        icon: AlertCircle
      },
      HIGH: {
        bg: 'bg-rose-950/50',
        text: 'text-rose-300',
        border: 'border-rose-600/50',
        icon: ShieldAlert
      },
      MEDIUM: {
        bg: 'bg-amber-950/50',
        text: 'text-amber-300',
        border: 'border-amber-600/50',
        icon: AlertTriangle
      },
      LOW: {
        bg: 'bg-cyan-950/50',
        text: 'text-cyan-300',
        border: 'border-cyan-600/50',
        icon: Info
      }
    };

    const s = styles[severity] || styles.LOW;
    const Icon = s.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-md border ${sizeClasses} ${s.bg} ${s.text} ${s.border}`}
      >
        <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span>{severity}</span>
      </span>
    );
  }

  return null;
};
