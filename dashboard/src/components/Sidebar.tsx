import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Shield,
  SearchCode,
  Lock,
  Zap,
  Server,
  Activity,
  Timer,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { SecurityStats, SecurityEvent } from '../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  sseStatus: string;
  stats?: SecurityStats | null;
  latestEvent?: SecurityEvent | null;
}

interface NodeHealth {
  name: string;
  port: number;
  url: string;
  online: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  sseStatus,
  stats,
  latestEvent
}) => {
  const [nodes, setNodes] = useState<NodeHealth[]>([
    { name: 'Gateway', port: 8080, url: 'http://localhost:8080/_zt/health', online: true },
    { name: 'Events', port: 5000, url: 'http://localhost:5000/health', online: true },
    { name: 'Sample App', port: 3000, url: 'http://localhost:3000/health', online: true },
    { name: 'Ownership', port: 4000, url: 'http://localhost:4000/health', online: true },
  ]);

  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      const updated = await Promise.all(
        nodes.map(async (node) => {
          try {
            const res = await fetch(node.url, { signal: AbortSignal.timeout(1500) });
            return { ...node, online: res.ok };
          } catch {
            return { ...node, online: false };
          }
        })
      );
      if (isMounted) {
        setNodes(updated);
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { id: 'demo', label: '⚡ Live Demo & Attack Hub', icon: Zap },
    { id: 'overview', label: 'Security Overview', icon: LayoutDashboard },
    { id: 'events', label: 'Security Events', icon: Shield },
    { id: 'scans', label: 'Scan Results', icon: SearchCode },
  ];

  const blockRate = stats?.blockRate ?? 0;
  const latency = stats?.avgAuthzLatencyUs ?? 0;
  const total = stats?.totalEvents ?? 0;

  return (
    <aside className="w-64 bg-dark-900 border-r border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0 overflow-y-auto">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-md shadow-cyan-500/20">
            <Lock className="w-5 h-5 text-dark-950 font-black" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-wide text-slate-100 flex items-center gap-1.5">
              <span>ZeroTrust</span>
              <span className="text-cyan-400">API</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
              Live SOC Console
            </div>
          </div>
        </div>

        {/* Live SSE Status Pill */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between px-3 py-2 bg-dark-850 rounded-lg border border-slate-800/80 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {sseStatus === 'connected' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    sseStatus === 'connected'
                      ? 'bg-emerald-500'
                      : sseStatus === 'connecting'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                ></span>
              </span>
              <span className="text-slate-300 font-medium">SSE Stream</span>
            </div>
            <span
              className={`text-[10px] uppercase font-bold ${
                sseStatus === 'connected'
                  ? 'text-emerald-400'
                  : sseStatus === 'connecting'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {sseStatus}
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Real-World Backend Connected Live Telemetry Panel at Bottom */}
      <div className="p-3 border-t border-slate-800 bg-dark-950/70 space-y-3">
        {/* Real-time Backend Engine Metrics */}
        <div className="p-2.5 bg-dark-900 rounded-lg border border-slate-800/90 shadow-inner space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Engine Telemetry</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">
              {total} Evts
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
            <div className="bg-dark-950 px-2 py-1.5 rounded border border-slate-800/60">
              <span className="text-slate-500 block text-[9px]">BLOCK RATE</span>
              <span className={`font-bold ${blockRate > 30 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {blockRate}%
              </span>
            </div>
            <div className="bg-dark-950 px-2 py-1.5 rounded border border-slate-800/60">
              <span className="text-slate-500 block text-[9px] flex items-center gap-1">
                <Timer className="w-2.5 h-2.5" /> LATENCY
              </span>
              <span className="font-bold text-slate-200">{latency} µs</span>
            </div>
          </div>

          {/* Real-Time Last Intercepted Action */}
          {latestEvent && (
            <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-500 truncate max-w-[120px]" title={latestEvent.routeTemplate}>
                {latestEvent.routeTemplate.replace('/api/', '')}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  latestEvent.decision === 'BLOCK'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                    : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                }`}
              >
                {latestEvent.decision}
              </span>
            </div>
          )}
        </div>

        {/* Live Cluster Services Health Grid */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider px-1">
            <span className="flex items-center gap-1">
              <Server className="w-3 h-3 text-purple-400" />
              <span>Live Cluster Nodes</span>
            </span>
            <span className="text-emerald-400 font-bold">
              {nodes.filter((n) => n.online).length}/{nodes.length} Up
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
            {nodes.map((node) => (
              <div
                key={node.port}
                className="flex items-center justify-between px-2 py-1 bg-dark-900 rounded border border-slate-800/80 hover:border-slate-700 transition-colors"
                title={`${node.name} on port ${node.port}: ${node.online ? 'Online' : 'Offline'}`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  {node.online ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                  )}
                  <span className="text-slate-300 truncate">{node.name}</span>
                </div>
                <span className="text-slate-500 text-[9px] shrink-0">:{node.port}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
