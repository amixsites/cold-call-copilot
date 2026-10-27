import React, { useState } from 'react';
import { PhoneOff, AlertTriangle, X } from 'lucide-react';
import { CallStageNumber, EndingReason, CallOutcome } from '../../types';
import { ENDING_REASONS_CONFIG } from '../../data/stageDefinitions';
import { formatDuration } from '../../lib/dateUtils';

interface EndCallModalProps {
  isOpen: boolean;
  activeStage: CallStageNumber;
  activeStageName: string;
  furthestStageReached: CallStageNumber;
  durationSeconds: number;
  companyName: string;
  contactName?: string;
  prospectWords?: string;
  eventsCount?: number;
  initialOutcome?: CallOutcome;
  isSaving?: boolean;
  onCancel: () => void;
  onConfirmEnd: (params: {
    endingStage: CallStageNumber;
    endingReason: EndingReason;
    outcome: CallOutcome;
    finalNotes?: string;
  }) => void;
}

export const EndCallModal: React.FC<EndCallModalProps> = ({
  isOpen,
  activeStage,
  activeStageName,
  furthestStageReached,
  durationSeconds,
  companyName,
  contactName,
  prospectWords = '',
  eventsCount = 0,
  initialOutcome = 'Connected - Follow-up Required',
  isSaving = false,
  onCancel,
  onConfirmEnd,
}) => {
  const [selectedReason, setSelectedReason] = useState<EndingReason>(
    activeStage === 8 ? 'normal_completion' : 'prospect_ended'
  );

  // Derive smart default outcome based on active stage
  const getDefaultOutcome = (): CallOutcome => {
    if (activeStage === 1) return 'Gatekeeper Blocked';
    if (activeStage === 3) return 'Callback Requested';
    if (activeStage === 6) return 'Connected - Not Interested';
    if (activeStage >= 7) return 'Connected - Follow-up Required';
    return initialOutcome;
  };

  const [outcome, setOutcome] = useState<CallOutcome>(getDefaultOutcome());
  const [finalNotes, setFinalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const disabled = isSubmitting || isSaving;

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    setIsSubmitting(true);
    onConfirmEnd({
      endingStage: activeStage, // CRITICAL: ending stage matches where caller ended
      endingReason: selectedReason,
      outcome,
      finalNotes: finalNotes.trim() || undefined,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-call-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-linear-to-r from-rose-600 to-rose-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <PhoneOff className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="end-call-title" className="text-base font-bold">
                End Live Call Session
              </h2>
              <p className="text-xs text-rose-100">
                {companyName} {contactName ? `(${contactName})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Call Session Summary Badges */}
          <div className="grid grid-cols-4 gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
            <div>
              <span className="block text-[10px] text-slate-500 font-medium">Ending At</span>
              <span className="text-xs font-bold text-rose-700">
                Stage {activeStage}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-medium">Furthest</span>
              <span className="text-xs font-bold text-indigo-700">
                Stage {furthestStageReached}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-medium">Duration</span>
              <span className="text-xs font-bold text-slate-800 font-mono">
                {formatDuration(durationSeconds)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 font-medium">Events</span>
              <span className="text-xs font-bold text-emerald-700">
                {eventsCount} logged
              </span>
            </div>
          </div>

          {/* Captured Quote Preview if present */}
          {prospectWords && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Captured Prospect's Words:
              </span>
              <p className="italic text-slate-700 font-medium">"{prospectWords}"</p>
            </div>
          )}

          {/* Critical Notice */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Ending early preserves <strong>Stage {activeStage}: {activeStageName}</strong> as the true ending stage.
              The system will <strong>never</strong> force this call into Stage 8.
            </p>
          </div>

          {/* Ending Reason Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Why did the call end at this stage? <span className="text-rose-600">*</span>
            </label>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {ENDING_REASONS_CONFIG.map(reason => (
                <label
                  key={reason.id}
                  className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                    selectedReason === reason.id
                      ? 'bg-rose-50 border-rose-400 text-rose-950 font-medium'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="endingReason"
                    value={reason.id}
                    checked={selectedReason === reason.id}
                    onChange={() => setSelectedReason(reason.id)}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="font-semibold block">{reason.label}</span>
                    <span className="text-[11px] text-slate-500 block">
                      {reason.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Call Outcome Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Final Call Outcome <span className="text-rose-600">*</span>
            </label>
            <select
              value={outcome}
              onChange={e => setOutcome(e.target.value as CallOutcome)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-rose-400 focus:outline-hidden"
            >
              <option value="Connected - Follow-up Required">Connected - Follow-up Required</option>
              <option value="Connected - Interested">Connected - Interested / Qualified</option>
              <option value="Callback Requested">Callback Requested</option>
              <option value="Connected - Not Interested">Connected - Not Interested</option>
              <option value="Gatekeeper Blocked">Gatekeeper Blocked / Reception</option>
              <option value="Wrong Contact / Number">Wrong Contact / Number</option>
              <option value="No Answer / Voicemail">No Answer / Voicemail</option>
              <option value="Left Voicemail">Left Voicemail</option>
            </select>
          </div>

          {/* Quick Wrap-up Note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Final Wrap-up Summary (Optional)
            </label>
            <textarea
              value={finalNotes}
              onChange={e => setFinalNotes(e.target.value)}
              placeholder="e.g. Prospect asked to share product catalog on WhatsApp and reconnect Monday 4 PM."
              rows={2}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-rose-400 focus:outline-hidden resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onCancel}
              disabled={disabled}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel (Resume Call)
            </button>
            <button
              type="submit"
              disabled={disabled}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              {disabled ? (
                <span>Saving Call...</span>
              ) : (
                <>
                  <PhoneOff className="w-4 h-4" />
                  <span>Confirm End Call</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
