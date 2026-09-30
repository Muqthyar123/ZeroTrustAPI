import React from 'react';
import { SecurityStats, SecurityEvent } from '../types';
import { StatCard } from '../components/StatCard';
import { EventTable } from '../components/EventTable';
import { LiveEventFeed } from '../components/LiveEventFeed';
import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  Percent,
  Timer,
  BarChart3,
  PieChart as PieIcon
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

interface OverviewProps {
  stats: SecurityStats | null;
  events: SecurityEvent[];
  liveEvents: SecurityEvent[];
  loading: boolean;
  onSelectEvent: (event: SecurityEvent) => void;
}

const PIE_COLORS = ['#10b981', '#f43f5e'];

export const Overview: React.FC<OverviewProps> = ({
  stats,
  events,
  liveEvents,
  loading,
  onSelectEvent
}) => {
  const pieData = stats
    ? [
        { name: 'Allowed', value: stats.allowed },
        { name: 'Blocked', value: stats.blocked }
      ]
    : [];

  const reasonData = stats?.eventsByReason
    ? Object.entries(stats.eventsByReason).map(([reason, count]) => ({
        reason: reason.replace('OK_', '').replace('TENANT_', 'T_'),
        fullName: reason,
        count
      }))
    : [];

  const tenantData = stats?.eventsByTenant
    ? Object.entries(stats.eventsByTenant).map(([tenant, count]) => ({
        tenant,
        count
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* 5 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Events"
          value={stats?.totalEvents ?? 0}
          subtext="Processed decisions"
          icon={Activity}
          variant="cyan"
        />
        <StatCard
          title="Allowed"
          value={stats?.allowed ?? 0}
          subtext="Zero-trust verified"
          icon={ShieldCheck}
          variant="success"
        />
        <StatCard
          title="Blocked"
          value={stats?.blocked ?? 0}
          subtext="Threats neutralized"
          icon={ShieldAlert}
          variant="danger"
        />
        <StatCard
          title="Block Rate"
          value={`${stats?.blockRate ?? 0}%`}
          subtext="Policy enforcement ratio"
          icon={Percent}
          variant={stats && stats.blockRate > 40 ? 'warning' : 'default'}
        />
        <StatCard
          title="Avg Authz Latency"
          value={`${stats?.avgAuthzLatencyUs ?? 0} µs`}
          subtext="Enforcement overhead"
          icon={Timer}
          variant="default"
        />
      </div>

      {/* SOC Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Activity Over Time */}
        <div className="lg:col-span-2 bg-dark-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Telemetry Velocity Over Time</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Live Time Series</span>
          </div>

          <div className="h-64 w-full">
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.recentActivity}>
                  <defs>
                    <linearGradient id="allowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="blockGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} fontStyle="monospace" />
                  <YAxis stroke="#64748b" fontSize={10} fontStyle="monospace" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0b101b', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="allowed" stroke="#10b981" fillOpacity={1} fill="url(#allowGrad)" name="Allowed" />
                  <Area type="monotone" dataKey="blocked" stroke="#f43f5e" fillOpacity={1} fill="url(#blockGrad)" name="Blocked" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                Awaiting time series telemetry data...
              </div>
            )}
          </div>
        </div>

        {/* Allowed vs Blocked Ratio Donut */}
        <div className="bg-dark-900/90 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-cyan-400" />
              <span>Enforcement Ratio</span>
            </h3>
          </div>

          <div className="h-52 w-full">
            {pieData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0b101b', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                No ratio data yet
              </div>
            )}
          </div>

          <div className="flex items-center justify-around pt-3 border-t border-slate-800/80 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-300">Allow ({stats?.allowed ?? 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-300">Block ({stats?.blocked ?? 0})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Charts: Reasons & Tenant Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reasons breakdown */}
        <div className="bg-dark-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>Decision Reason Breakdown</span>
          </h3>
          <div className="h-52 w-full">
            {reasonData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reasonData}>
                  <XAxis dataKey="reason" stroke="#64748b" fontSize={10} fontStyle="monospace" />
                  <YAxis stroke="#64748b" fontSize={10} fontStyle="monospace" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0b101b', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                No reasons recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Tenant breakdown */}
        <div className="bg-dark-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <span>Traffic by Tenant</span>
          </h3>
          <div className="h-52 w-full">
            {tenantData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tenantData}>
                  <XAxis dataKey="tenant" stroke="#64748b" fontSize={10} fontStyle="monospace" />
                  <YAxis stroke="#64748b" fontSize={10} fontStyle="monospace" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0b101b', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                No tenant distribution recorded yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Split Section: Recent Events & Live SSE Ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EventTable
            events={events.slice(0, 10)}
            loading={loading}
            onSelectEvent={onSelectEvent}
            title="Recent Telemetry Decisions"
          />
        </div>
        <div className="lg:col-span-1">
          <LiveEventFeed events={liveEvents} onSelectEvent={onSelectEvent} />
        </div>
      </div>
    </div>
  );
};
