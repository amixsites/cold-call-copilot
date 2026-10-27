import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Plus, 
  PhoneCall, 
  LogOut, 
  AlertTriangle, 
  RefreshCw, 
  X
} from 'lucide-react';
import { Button } from '../common/Button';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';

interface TopBarProps {
  onOpenMobileMenu: () => void;
  onOpenNewProspectModal: () => void;
  onOpenNewFollowUpModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  onOpenMobileMenu, 
  onOpenNewProspectModal,
  onOpenNewFollowUpModal 
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { apiError, clearApiError, refetchData, isLoadingData } = useData();
  const { user, signOut } = useAuth();

  // Page titles and context descriptions
  const pageMeta: Record<string, { title: string; subtitle: string }> = {
    '/': { title: 'Sales Dashboard', subtitle: 'Manufacturing pipeline overview & discovery queues' },
    '/prospects': { title: 'Prospect Directory', subtitle: 'Manage manufacturing accounts and operational leads' },
    '/workspace': { title: 'Call Workspace', subtitle: 'Live call preparation, discovery notes & qualification' },
    '/follow-ups': { title: 'Follow-up Actions', subtitle: 'Track post-call tasks, engineering quotes & scheduled calls' },
    '/history': { title: 'Call History', subtitle: 'Review past discovery conversations & recorded business problems' },
    '/settings': { title: 'Settings', subtitle: 'Manage application preferences and system configuration' },
  };

  const currentMeta = pageMeta[location.pathname] || { 
    title: 'Cold Call Copilot', 
    subtitle: 'Manufacturing B2B Discovery' 
  };

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 transition-colors">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & breadcrumb/title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Open mobile menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate tracking-tight">
              {currentMeta.title}
            </h1>
            <p className="hidden sm:block text-xs text-slate-500 truncate">
              {currentMeta.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">

          {/* Contextual primary action buttons based on current page */}
          {location.pathname === '/prospects' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={onOpenNewProspectModal}
            >
              Add Prospect
            </Button>
          )}

          {location.pathname === '/follow-ups' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={onOpenNewFollowUpModal}
            >
              New Follow-up
            </Button>
          )}

          {location.pathname === '/' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={onOpenNewProspectModal}
                className="hidden sm:inline-flex"
              >
                Add Prospect
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<PhoneCall className="h-3.5 w-3.5" />}
                onClick={() => navigate('/workspace')}
              >
                Start Call
              </Button>
            </div>
          )}

          {location.pathname === '/history' && (
            <Button
              variant="outline"
              size="sm"
              icon={<PhoneCall className="h-4 w-4" />}
              onClick={() => navigate('/workspace')}
            >
              Go to Workspace
            </Button>
          )}

          {/* User Profile & Sign Out Button */}
          {user && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-800 truncate max-w-[140px]">
                  {user.user_metadata?.full_name || user.email?.split('@')[0]}
                </span>
                <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global API Error Banner with Retry */}
      {apiError && 
       !apiError.toLowerCase().includes('authentication') && 
       !apiError.toLowerCase().includes('session') && 
       !apiError.toLowerCase().includes('sign in') && 
       !apiError.toLowerCase().includes('unauthorized') && (
        <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800 animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="truncate">{apiError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              onClick={() => refetchData()}
              disabled={isLoadingData}
              className="inline-flex items-center gap-1 font-semibold text-rose-700 hover:text-rose-900 underline"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingData ? 'animate-spin' : ''}`} />
              Retry
            </button>
            <button
              onClick={clearApiError}
              className="text-rose-500 hover:text-rose-700 p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
