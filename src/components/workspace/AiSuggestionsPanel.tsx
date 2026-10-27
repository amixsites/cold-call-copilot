import React, { useState } from 'react';
import { 
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  FileText,
  Loader2,
  X,
  AlertTriangle,
  Radio,
  Zap,
} from 'lucide-react';
import { RealTimeCoachingSuggestion, LiveCallAiSuggestionPayload } from '../../types';

export interface AiSuggestionsPanelProps {
  coachingSuggestion?: RealTimeCoachingSuggestion | null;
  suggestions?: LiveCallAiSuggestionPayload | null; // preserved for backwards compatibility
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onCopySuggestedResponse?: (text: string) => void;
  onInsertIntoNotes?: (text: string) => void;
  activeStage: number;
  activeStageName: string;
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
  className?: string;
  lastUpdated?: string | null;
  refreshCooldown?: boolean;
  statusMessage?: string;
}

export const AiSuggestionsPanel: React.FC<AiSuggestionsPanelProps> = ({
  coachingSuggestion,
  isLoading = false,
  error = null,
  onRefresh,
  onCopySuggestedResponse,
  onInsertIntoNotes,
  activeStage,
  activeStageName,
  isMobileDrawer = false,
  onCloseMobileDrawer,
  className = '',
  lastUpdated,
  refreshCooldown = false,
  statusMessage,
}) => {
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedFollowUp, setCopiedFollowUp] = useState(false);
  const [insertedNotes, setInsertedNotes] = useState(false);

  const handleCopyResponse = () => {
    if (!coachingSuggestion?.suggested_response) return;
    navigator.clipboard.writeText(coachingSuggestion.suggested_response).catch(() => {});
    if (onCopySuggestedResponse) {
      onCopySuggestedResponse(coachingSuggestion.suggested_response);
    }
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleCopyFollowUp = () => {
    if (!coachingSuggestion?.follow_up_question) return;
    navigator.clipboard.writeText(coachingSuggestion.follow_up_question).catch(() => {});
    setCopiedFollowUp(true);
    setTimeout(() => setCopiedFollowUp(false), 2000);
  };

  const handleInsertNotes = () => {
    if (!coachingSuggestion?.suggested_response || !onInsertIntoNotes) return;
    onInsertIntoNotes(coachingSuggestion.suggested_response);
    setInsertedNotes(true);
    setTimeout(() => setInsertedNotes(false), 2000);
  };

  const confidencePct = coachingSuggestion?.confidence 
    ? Math.round(coachingSuggestion.confidence * 100) 
    : 85;

  return (
    <div className={`flex flex-col h-full bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden ${isMobileDrawer ? 'max-h-[85vh]' : ''} ${className}`}>
      {/* Header */}
      <div className="p-3 sm:p-3.5 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                Real-Time AI Coach
              </h3>
              {isLoading ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-800">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  {statusMessage || 'Analyzing'}
                </span>
              ) : coachingSuggestion ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-800">
                  <Zap className="w-2.5 h-2.5 text-emerald-600" />
                  Live Suggestion
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-100 border-slate-200 text-slate-600">
                  <Radio className="w-2.5 h-2.5 text-slate-400" />
                  Listening
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              Stage {activeStage} · {activeStageName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading || refreshCooldown}
              title={refreshCooldown ? 'Please wait a moment before refreshing' : 'Refresh coaching suggestion'}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-3xs"
              aria-label="Refresh coaching suggestion"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          )}

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
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-300">
        {/* Error State */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">Coaching service alert</p>
                <p className="text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
              >
                Retry generation
              </button>
            )}
          </div>
        )}

        {/* Loading Skeleton (when no previous suggestion) */}
        {isLoading && !coachingSuggestion && (
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-3 animate-pulse">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-indigo-900">
                Analyzing finalized transcript turn...
              </p>
            </div>
            <div className="h-4 bg-indigo-200/50 rounded w-3/4"></div>
            <div className="h-4 bg-indigo-200/40 rounded w-5/6"></div>
            <div className="h-3 bg-slate-200 rounded w-1/2 mt-2"></div>
          </div>
        )}

        {/* Empty / Listening State (when idle and no suggestion yet) */}
        {!coachingSuggestion && !isLoading && !error && (
          <div className="p-5 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 space-y-2.5">
            <div className="w-10 h-10 mx-auto rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800">
                Listening for finalized conversation turns
              </h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                As the prospect speaks and statements finalize, AI coaching suggestions grounded in manufacturing operations will appear here.
              </p>
            </div>
            <div className="pt-1">
              <span className="inline-block text-[10px] font-medium text-slate-400 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
                Active Objective: {activeStageName}
              </span>
            </div>
          </div>
        )}

        {/* Active Coaching Suggestion Content */}
        {coachingSuggestion && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* Non-blocking Re-analyzing Notice */}
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs animate-in fade-in">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />
                <span className="font-semibold">{statusMessage || 'Re-analyzing conversation...'}</span>
              </div>
            )}

            {/* Primary Suggested Response Card */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/30 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Suggested Response
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {confidencePct}% confidence
                </span>
              </div>

              <div className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed pl-2 border-l-2 border-indigo-500">
                "{coachingSuggestion.suggested_response}"
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-indigo-100/70">
                <button
                  type="button"
                  onClick={handleCopyResponse}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 transition-colors shadow-3xs cursor-pointer"
                >
                  {copiedResponse ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Response</span>
                    </>
                  )}
                </button>

                {onInsertIntoNotes && (
                  <button
                    type="button"
                    onClick={handleInsertNotes}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-3xs cursor-pointer"
                    title="Insert suggestion into Call Notes"
                  >
                    {insertedNotes ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Added to Notes</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>Add to Notes</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Context Insights: Objection, Intent & Buying Signals */}
            <div className="space-y-2">
              {/* Objection Alert if Detected */}
              {coachingSuggestion.objection && (
                <div className="p-2.5 rounded-lg bg-rose-50/90 border border-rose-200 text-rose-900 flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-bold text-rose-800 uppercase tracking-wider text-[10px] block">
                      Detected Objection
                    </span>
                    <p className="font-semibold text-rose-950 mt-0.5">
                      {coachingSuggestion.objection}
                    </p>
                  </div>
                </div>
              )}

              {/* Buying Signals if Detected */}
              {Array.isArray(coachingSuggestion.buying_signals) && coachingSuggestion.buying_signals.length > 0 && (
                <div className="p-2.5 rounded-lg bg-emerald-50/90 border border-emerald-200 text-emerald-900 flex items-start gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-bold text-emerald-800 uppercase tracking-wider text-[10px] block">
                      Buying Signals Detected
                    </span>
                    <ul className="mt-0.5 space-y-0.5 list-disc list-inside text-emerald-950 font-medium">
                      {coachingSuggestion.buying_signals.map((signal, idx) => (
                        <li key={idx} className="truncate">{signal}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Detected Intent Pill */}
              {coachingSuggestion.detected_intent && (
                <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] text-slate-500 font-medium">Prospect Intent:</span>
                  <span className="text-xs font-semibold text-slate-900 truncate">
                    {coachingSuggestion.detected_intent}
                  </span>
                </div>
              )}
            </div>

            {/* Suggested Follow-Up Question Card */}
            {coachingSuggestion.follow_up_question && (
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 text-indigo-500" />
                    Suggested Next Question
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyFollowUp}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                    title="Copy follow-up question"
                  >
                    {copiedFollowUp ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-xs font-medium text-slate-800 leading-snug">
                  "{coachingSuggestion.follow_up_question}"
                </p>
              </div>
            )}

            {/* Recommended Next Action */}
            {coachingSuggestion.recommended_action && (
              <div className="p-2.5 rounded-lg bg-slate-100/70 border border-slate-200 text-slate-700 flex items-center gap-2 text-xs">
                <ArrowRight className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900">Recommended action: </span>
                  <span className="text-slate-700">{coachingSuggestion.recommended_action}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Advisory Footer */}
      <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between gap-2 shrink-0">
        <span className="truncate">
          Powered by Gemini Flash · Manufacturing Context
        </span>
        {lastUpdated && (
          <span className="shrink-0 text-slate-400">
            Updated {lastUpdated}
          </span>
        )}
      </div>
    </div>
  );
};

