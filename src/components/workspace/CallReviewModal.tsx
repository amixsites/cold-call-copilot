import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  Check,
  Loader2,
  Clock,
  FileText,
  RefreshCw,
  Tag,
  Target,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { CallStageNumber, EndingReason, CallOutcome, CallAiReview, LiveTranscriptSegment } from '../../types';
import { formatDuration } from '../../lib/dateUtils';
import { api } from '../../lib/api';

interface CallReviewModalProps {
  isOpen: boolean;
  callId: string;
  activeStage: CallStageNumber;
  activeStageName: string;
  furthestStageReached: CallStageNumber;
  durationSeconds: number;
  companyName: string;
  contactName?: string;
  prospectWords?: string;
  quoteStatus?: string;
  transcriptSegments: LiveTranscriptSegment[];
  initialOutcome?: CallOutcome;
  onCancel: () => void;
  onConfirmEnd: (params: {
    endingStage: CallStageNumber;
    endingReason: EndingReason;
    outcome: CallOutcome;
    finalNotes?: string;
  }) => void;
}

export const CallReviewModal: React.FC<CallReviewModalProps> = ({
  isOpen,
  callId,
  activeStage,
  activeStageName,
  furthestStageReached,
  durationSeconds,
  companyName,
  contactName,
  prospectWords = '',
  quoteStatus = 'not_reached',
  transcriptSegments = [],
  initialOutcome = 'Connected - Follow-up Required',
  onCancel,
  onConfirmEnd,
}) => {
  const [review, setReview] = useState<CallAiReview | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedDraft, setCopiedDraft] = useState<boolean>(false);

  // Ending controls
  const [selectedReason, setSelectedReason] = useState<EndingReason>(
    activeStage === 8 ? 'normal_completion' : 'prospect_ended'
  );
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome>(initialOutcome);
  const [editableFollowUp, setEditableFollowUp] = useState<string>('');

  // Fetch existing review on modal open
  useEffect(() => {
    if (isOpen && callId) {
      setIsLoadingReview(true);
      setErrorMessage(null);
      api.calls
        .getReview(callId)
        .then((existing) => {
          if (existing) {
            setReview(existing);
            if (existing.suggestedFollowUpMessage) {
              setEditableFollowUp(existing.suggestedFollowUpMessage);
            }
          }
        })
        .catch((err) => {
          console.warn('[CallReviewModal] Could not fetch existing review:', err);
        })
        .finally(() => {
          setIsLoadingReview(false);
        });
    }
  }, [isOpen, callId]);

  if (!isOpen) return null;

  // Generate Gemini Review
  const handleGenerateReview = async () => {
    if (isGenerating || isSaving) return;
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const generated = await api.calls.generateReview(callId, {
        transcriptSegments: transcriptSegments.map((s) => ({
          speaker: s.speaker,
          text: s.text,
          timestamp: s.timestamp,
        })),
      });

      setReview(generated);
      if (generated.suggestedFollowUpMessage) {
        setEditableFollowUp(generated.suggestedFollowUpMessage);
      }
    } catch (err: any) {
      console.error('[CallReviewModal] Review generation failed:', err);
      setErrorMessage(
        err?.message || 'Failed to generate Gemini review. Please verify network connection or retry.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy Follow-up Draft
  const handleCopyFollowUp = () => {
    if (!editableFollowUp) return;
    navigator.clipboard.writeText(editableFollowUp);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  // Save Review & End Call
  const handleSaveAndEndCall = async () => {
    if (isSaving || isGenerating) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      // 1. If follow-up message was edited, save it to the review record first
      if (review && editableFollowUp !== review.suggestedFollowUpMessage) {
        await api.calls.updateReview(callId, {
          suggestedFollowUpMessage: editableFollowUp.trim() || undefined,
        });
      }

      // 2. Finalize call via existing lifecycle flow
      onConfirmEnd({
        endingStage: activeStage,
        endingReason: selectedReason,
        outcome: selectedOutcome,
        finalNotes: review?.callSummary ? `[AI Review Summary] ${review.callSummary}` : undefined,
      });
    } catch (err: any) {
      console.error('[CallReviewModal] Save review & end call failed:', err);
      setErrorMessage(
        `Failed to save review before ending call: ${err?.message || 'Database error'}. Your generated review is preserved. Please retry.`
      );
      setIsSaving(false);
    }
  };

  // Save Review Draft (without ending call)
  const handleSaveDraftReview = async () => {
    if (isSaving || isGenerating || !review) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await api.calls.updateReview(callId, {
        suggestedFollowUpMessage: editableFollowUp.trim() || undefined,
      });
      // Show saved indicator briefly
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(`Failed to save draft: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Extract structured fields safely
  const prospectNeeds =
    (review as any)?.prospectNeeds || review?.prospectNeedOrGoal || 'No explicit need logged.';
  const objections =
    (review as any)?.objections || review?.objectionAnalysis || 'No specific objection logged.';
  const interestLevel = (review as any)?.interestLevel;
  const interestBadge =
    typeof interestLevel === 'object' && interestLevel?.level
      ? interestLevel.level
      : typeof interestLevel === 'string'
      ? interestLevel
      : 'Neutral';
  const interestExplanation =
    typeof interestLevel === 'object' && interestLevel?.explanation ? interestLevel.explanation : '';
  const callOutcomeText = (review as any)?.callOutcome || review?.recommendedNextAction || 'Follow-up required';
  const areasForImprovement: string[] =
    (review as any)?.areasForImprovement ||
    (review?.coachingFeedback && review.coachingFeedback.length > 0
      ? review.coachingFeedback
      : review?.missedOpportunities || []);

  const getInterestColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'interested':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'not interested':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'unclear':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'neutral':
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-review-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Compact Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/90 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 id="call-review-title" className="text-sm font-bold tracking-tight">
                Finish Call & Review
              </h2>
              <p className="text-xs text-slate-300 truncate max-w-md">
                {companyName} {contactName ? `· ${contactName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving || isGenerating}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Return to Call"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin scrollbar-thumb-slate-300">
          {/* Call Metadata Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Duration</span>
              <span className="font-mono font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-indigo-600" />
                {formatDuration(durationSeconds)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Stage (Ended / Furthest)</span>
              <span className="font-semibold text-slate-800 block mt-0.5 truncate" title={`Ended at Stage ${activeStage}: ${activeStageName}. Furthest reached: Stage ${furthestStageReached}`}>
                Stage {activeStage} / {furthestStageReached}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Transcript</span>
              <span className="font-semibold text-slate-800 block mt-0.5">
                {transcriptSegments.length} segments
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Quote Status</span>
              <span className="font-semibold text-slate-800 block mt-0.5 capitalize truncate" title={prospectWords ? `"${prospectWords}"` : undefined}>
                {quoteStatus.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start justify-between gap-2 animate-in fade-in duration-150">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={handleGenerateReview}
                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded shrink-0 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Step B: Pre-generation State & Prompt */}
          {!review && !isLoadingReview && (
            <div className="p-5 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3 bg-slate-50/50">
              <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Generate Gemini Call Review
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Analyze the completed conversation transcript to generate structured call outcomes, prospect needs, and coaching recommendations.
                </p>
                <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                  <span className="font-medium">Model:</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono text-slate-700 font-semibold shadow-3xs">
                    gemini-3.5-flash-lite
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerateReview}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Review with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Gemini Review</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Loading Initial State */}
          {isLoadingReview && (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs font-medium">Checking saved review...</p>
            </div>
          )}

          {/* Step C: Dedicated Review UI Box */}
          {review && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              {/* Header Badge */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-900 tracking-tight">
                    Structured Conversation Analysis
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    {review.modelUsed || 'gemini-3.5-flash-lite'}
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateReview}
                    disabled={isGenerating || isSaving}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                    title="Regenerate Review"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* 1. Call Summary */}
              <div className="p-3 bg-white border border-slate-200/90 rounded-xl shadow-3xs space-y-1">
                <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block">
                  1. Call Summary
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                  {review.callSummary}
                </p>
              </div>

              {/* 2 & 3: Prospect Needs and Objections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 2. Prospect's Needs */}
                <div className="p-3 bg-white border border-slate-200/90 rounded-xl shadow-3xs space-y-1">
                  <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-indigo-600" />
                    <span>2. Prospect's Needs</span>
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {prospectNeeds}
                  </p>
                </div>

                {/* 3. Objections */}
                <div className="p-3 bg-white border border-slate-200/90 rounded-xl shadow-3xs space-y-1">
                  <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    <span>3. Objections</span>
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {objections}
                  </p>
                </div>
              </div>

              {/* 4 & 5: Interest Level and Call Outcome */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 4. Interest Level */}
                <div className="p-3 bg-white border border-slate-200/90 rounded-xl shadow-3xs space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block">
                    4. Interest Level
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getInterestColor(
                        interestBadge
                      )}`}
                    >
                      {interestBadge}
                    </span>
                  </div>
                  {interestExplanation && (
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {interestExplanation}
                    </p>
                  )}
                </div>

                {/* 5. Call Outcome */}
                <div className="p-3 bg-white border border-slate-200/90 rounded-xl shadow-3xs space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block">
                    5. Call Outcome
                  </span>
                  <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                    {callOutcomeText}
                  </p>
                </div>
              </div>

              {/* 6. Next Recommended Action */}
              <div className="p-3 bg-white border border-slate-200/90 rounded-xl shadow-3xs space-y-1">
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                  <span>6. Next Recommended Action</span>
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {review.recommendedNextAction}
                </p>
              </div>

              {/* 7. Areas for Improvement */}
              {areasForImprovement.length > 0 && (
                <div className="p-3 bg-white border border-slate-200/90 rounded-xl shadow-3xs space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                    <span>7. Areas for Improvement</span>
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
                    {areasForImprovement.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Follow-up Draft Message (Editable) */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="modal-follow-up-draft" className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider">
                    Suggested Follow-up Message (Editable)
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyFollowUp}
                    disabled={!editableFollowUp}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200 cursor-pointer shadow-3xs"
                  >
                    {copiedDraft ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  id="modal-follow-up-draft"
                  rows={3}
                  value={editableFollowUp}
                  onChange={(e) => setEditableFollowUp(e.target.value)}
                  placeholder="Draft follow-up email or message based on call..."
                  className="w-full text-xs p-2.5 bg-white border border-indigo-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Final Call Ending Parameters */}
              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="modal-ending-reason" className="block text-[11px] font-bold text-slate-700 mb-1">
                    Ending Reason
                  </label>
                  <select
                    id="modal-ending-reason"
                    value={selectedReason}
                    onChange={(e) => setSelectedReason(e.target.value as EndingReason)}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none"
                  >
                    <option value="normal_completion">Completed (Stage 8 Close)</option>
                    <option value="prospect_ended">Prospect Ended Call</option>
                    <option value="gatekeeper_block">Gatekeeper Block</option>
                    <option value="wrong_number">Wrong Number / Contact</option>
                    <option value="callback_scheduled">Callback Scheduled</option>
                    <option value="bad_timing">Bad Timing / Busy</option>
                    <option value="do_not_call">Do Not Call / Requested Removal</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="modal-final-outcome" className="block text-[11px] font-bold text-slate-700 mb-1">
                    Final Outcome
                  </label>
                  <select
                    id="modal-final-outcome"
                    value={selectedOutcome}
                    onChange={(e) => setSelectedOutcome(e.target.value as CallOutcome)}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none"
                  >
                    <option value="Connected - Follow-up Required">Connected - Follow-up Required</option>
                    <option value="Connected - Interested">Connected - Interested</option>
                    <option value="Connected - Not Interested">Connected - Not Interested</option>
                    <option value="Callback Requested">Callback Requested</option>
                    <option value="Gatekeeper Blocked">Gatekeeper Blocked</option>
                    <option value="No Answer / Voicemail">No Answer / Voicemail</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving || isGenerating}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors cursor-pointer shadow-3xs"
          >
            Return to Call
          </button>

          <div className="flex items-center gap-2">
            {review && (
              <button
                type="button"
                onClick={handleSaveDraftReview}
                disabled={isSaving || isGenerating}
                className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer shadow-3xs disabled:opacity-50"
              >
                Save Draft
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAndEndCall}
              disabled={isSaving || isGenerating}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving & Finalizing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Review & End Call</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
