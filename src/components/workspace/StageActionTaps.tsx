import React from 'react';
import { Check, Tag, ShieldAlert } from 'lucide-react';
import { CallStageNumber, StageActionTap, StageEvent } from '../../types';

interface StageActionTapsProps {
  stageNumber: CallStageNumber;
  actionTaps: StageActionTap[];
  selectedEvents: StageEvent[];
  onToggleEvent: (tap: StageActionTap) => void;
  disabled?: boolean;
}

export const StageActionTaps: React.FC<StageActionTapsProps> = ({
  stageNumber,
  actionTaps,
  selectedEvents,
  onToggleEvent,
  disabled = false,
}) => {
  const isSelected = (tapId: string) => {
    return selectedEvents.some(
      e => e.stageNumber === stageNumber && e.eventType === tapId
    );
  };

  const isObjectionStage = stageNumber === 6;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <label className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
            {isObjectionStage ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Quick Actions · Objection Taxonomy</span>
              </>
            ) : (
              <>
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                <span>Quick Actions</span>
              </>
            )}
          </label>
          <p className="text-[11px] text-slate-500">
            Record observed responses with one click.
          </p>
        </div>
        {selectedEvents.filter(e => e.stageNumber === stageNumber).length > 0 && (
          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
            {selectedEvents.filter(e => e.stageNumber === stageNumber).length} recorded
          </span>
        )}
      </div>

      <div
        className={`grid gap-1.5 ${
          isObjectionStage
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-2 sm:grid-cols-3'
        }`}
      >
        {actionTaps.map(tap => {
          const active = isSelected(tap.id);

          return (
            <button
              key={tap.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggleEvent(tap)}
              aria-pressed={active}
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left text-xs transition-all cursor-pointer font-medium select-none focus:outline-hidden focus:ring-2 ${
                active
                  ? isObjectionStage
                    ? 'bg-amber-600 border-amber-700 text-white shadow-3xs focus:ring-amber-300 font-semibold'
                    : 'bg-indigo-600 border-indigo-700 text-white shadow-3xs focus:ring-indigo-300 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 focus:ring-indigo-200'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="leading-snug truncate">{tap.label}</span>
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0 ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                {active ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
