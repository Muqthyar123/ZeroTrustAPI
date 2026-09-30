import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'default' | 'danger' | 'success' | 'warning' | 'cyan';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  variant = 'default'
}) => {
  const variantStyles = {
    default: {
      border: 'border-slate-800 hover:border-slate-700',
      iconBg: 'bg-slate-800/80 text-slate-300',
      valueColor: 'text-slate-100',
      glow: 'shadow-slate-900/50'
    },
    danger: {
      border: 'border-rose-900/40 hover:border-rose-700/60',
      iconBg: 'bg-rose-950/80 text-rose-400',
      valueColor: 'text-rose-400',
      glow: 'shadow-rose-950/30'
    },
    success: {
      border: 'border-emerald-900/40 hover:border-emerald-700/60',
      iconBg: 'bg-emerald-950/80 text-emerald-400',
      valueColor: 'text-emerald-400',
      glow: 'shadow-emerald-950/30'
    },
    warning: {
      border: 'border-amber-900/40 hover:border-amber-700/60',
      iconBg: 'bg-amber-950/80 text-amber-400',
      valueColor: 'text-amber-400',
      glow: 'shadow-amber-950/30'
    },
    cyan: {
      border: 'border-cyan-900/40 hover:border-cyan-700/60',
      iconBg: 'bg-cyan-950/80 text-cyan-400',
      valueColor: 'text-cyan-400',
      glow: 'shadow-cyan-950/30'
    }
  }[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-dark-900/80 p-5 backdrop-blur-md border transition-all duration-200 shadow-lg ${variantStyles.border} ${variantStyles.glow}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className={`p-2.5 rounded-lg border border-slate-700/40 ${variantStyles.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4">
        <div className={`text-2xl lg:text-3xl font-bold font-mono tracking-tight ${variantStyles.valueColor}`}>
          {value}
        </div>
        {subtext && (
          <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1.5">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
};
