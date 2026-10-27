import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  PhoneCall, 
  CheckSquare, 
  History, 
  Settings, 
  Factory, 
  X,
  LogOut
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { metrics, profile } = useData();
  const { user, signOut } = useAuth();

  const navItems = [
    {
      to: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      to: '/prospects',
      label: 'Prospects',
      icon: Users,
      badge: metrics.totalProspects > 0 ? `${metrics.totalProspects}` : undefined,
    },
    {
      to: '/workspace',
      label: 'Call Workspace',
      icon: PhoneCall,
      badge: undefined,
    },
    {
      to: '/follow-ups',
      label: 'Follow-ups',
      icon: CheckSquare,
      badge: metrics.followUpsDue > 0 ? `${metrics.followUpsDue}` : undefined,
      badgeAlert: metrics.followUpsOverdue > 0,
    },
    {
      to: '/history',
      label: 'Call History',
      icon: History,
      badge: metrics.completedCallsCount > 0 ? `${metrics.completedCallsCount}` : undefined,
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
      badge: undefined,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      {/* Brand Header */}
      <div className="h-12 px-3.5 flex items-center justify-between border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white shadow-sm shrink-0">
            <Factory className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-white text-xs tracking-tight truncate block">Cold Call Copilot</span>
            <p className="text-[10px] text-slate-400 font-medium truncate">Manufacturing B2B</p>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="lg:hidden p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2 py-2.5 space-y-0.5 overflow-y-auto">
        <div className="px-2.5 pt-1 pb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => onClose()}
              className={({ isActive }) =>
                `flex items-center justify-between px-2.5 py-2 rounded-md text-sm font-medium transition-colors group ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-600/30 text-brand-300'
                          : item.badgeAlert
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User profile footer */}
      <div className="p-2 mx-2 mb-2 bg-slate-800/40 rounded-lg border border-slate-800/70">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600/30 text-brand-300 font-bold text-xs border border-brand-500/30 shrink-0">
            {(user?.user_metadata?.full_name || profile.name || 'SR').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">
              {user?.user_metadata?.full_name || profile.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {user?.email || profile.email}
            </p>
          </div>
          <NavLink
            to="/settings"
            title="Account Settings"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
          </NavLink>
          <button
            type="button"
            onClick={() => signOut()}
            title="Sign Out"
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar - Compact 208px (lg:w-52) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-52 lg:shrink-0 lg:border-r lg:border-slate-800 lg:fixed lg:inset-y-0 lg:z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
