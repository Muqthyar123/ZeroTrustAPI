import {
  LayoutDashboard,
  Shield,
  SearchCode,
  Lock
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  sseStatus: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  sseStatus
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'events', label: 'Security Events', icon: Shield },
    { id: 'scans', label: 'Scan Results', icon: SearchCode },
  ];

  return (
    <aside className="w-64 bg-dark-900 border-r border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0">
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
              Security Hub (M4)
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

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span>Events API</span>
          <span className="text-cyan-400">:5000</span>
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span>Gateway</span>
          <span className="text-slate-400">:8080 (M1)</span>
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span>Scanner</span>
          <span className="text-slate-400">Target (M3)</span>
        </div>
      </div>
    </aside>
  );
};
