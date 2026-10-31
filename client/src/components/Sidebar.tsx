import React from 'react';
import {
  LayoutDashboard,
  PackageCheck,
  MessageSquare,
  TrendingUp,
  Sliders,
  ShieldCheck,
  Database,
  Cpu
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  ordersCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, ordersCount }) => {
  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders & Risk Engine', icon: PackageCheck, badge: ordersCount },
    { id: 'whatsapp', label: 'WhatsApp Simulator', icon: MessageSquare },
    { id: 'financials', label: 'Financial Impact Engine', icon: TrendingUp },
    { id: 'settings', label: 'Rules & Thresholds', icon: Sliders }
  ];

  return (
    <aside className="w-64 bg-navy-900 text-slate-200 flex flex-col h-screen border-r border-slate-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-navy-800 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-semibold text-white text-base tracking-tight leading-tight">
            COD Risk Intelligence
          </h1>
          <p className="text-[11px] text-slate-400 mt-1 leading-normal font-normal">
            Reduce RTO. Protect Revenue.
          </p>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 py-2">
          Operations & Intelligence
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold'
                  : 'text-slate-300 hover:bg-navy-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isActive ? 'bg-blue-700 text-white' : 'bg-navy-800 text-slate-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom System Status */}
      <div className="p-3.5 border-t border-navy-800 bg-navy-900/60 text-[11px] space-y-2">
        <div className="flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>SQLite WAL</span>
          </span>
          <span className="text-emerald-400 font-mono text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
            Connected
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Risk Engine</span>
          </span>
          <span className="text-blue-300 font-mono text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded">
            Hybrid v1.0
          </span>
        </div>
        <div className="pt-1 text-[10px] text-slate-400 text-center border-t border-navy-800/80">
          Production Take-Home Build
        </div>
      </div>
    </aside>
  );
};
