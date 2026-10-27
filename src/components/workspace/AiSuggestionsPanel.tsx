import React from 'react';
import { 
  ShieldAlert, 
  X,
} from 'lucide-react';
import { LiveCallAiSuggestionPayload } from '../../types';

interface AiSuggestionsPanelProps {
  suggestions?: LiveCallAiSuggestionPayload | null;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  activeStage: number;
  activeStageName: string;
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
  className?: string;
}

export const AiSuggestionsPanel: React.FC<AiSuggestionsPanelProps> = ({
  activeStage,
  activeStageName,
  isMobileDrawer = false,
  onCloseMobileDrawer,
  className = '',
}) => {
  return (
    <div className={`flex flex-col h-full bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden ${isMobileDrawer ? 'max-h-[85vh]' : ''} ${className}`}>
      {/* Header */}
      <div className="p-3 sm:p-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                AI Suggestions
              </h3>
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-800">
                Disabled
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              Stage {activeStage} · {activeStageName}
            </p>
          </div>
        </div>

        {isMobileDrawer && onCloseMobileDrawer && (
          <button
            type="button"
            onClick={onCloseMobileDrawer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close suggestions drawer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Content Area - Clean, compact notice */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 space-y-2">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                AI Suggestions Deactivated
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">
                AI suggestions are paused during active calls to prioritize real-time speech transcription and eliminate rate limits.
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs leading-relaxed space-y-1.5">
          <p className="font-semibold text-slate-800">Workflow Note:</p>
          <p className="text-slate-600">
            Use the Live Transcript panel to follow the conversation in real time and record notes directly in the stage workflow.
          </p>
        </div>
      </div>
    </div>
  );
};
