import React from 'react';
import { Check } from 'lucide-react';
import { CallStageNumber } from '../../types';
import { STAGES_CONFIG } from '../../data/stageDefinitions';

interface StageStepperProps {
  activeStage: CallStageNumber;
  furthestStageReached: CallStageNumber;
  onSelectStage: (stage: CallStageNumber) => void;
  disabled?: boolean;
}

export const StageStepper: React.FC<StageStepperProps> = ({
  activeStage,
  furthestStageReached,
  onSelectStage,
  disabled = false,
}) => {
  const activeConfig = STAGES_CONFIG.find(s => s.stageNumber === activeStage) || STAGES_CONFIG[0];
  const progressPercent = Math.min(100, Math.max(12.5, (activeStage / 8) * 100));

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-lg px-3 py-1.5 sm:py-2 shadow-3xs">
      {/* Top Label & Furthest Indicator */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
            Stage {activeStage} of 8 · {activeConfig.name}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <span>Furthest:</span>
          <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded text-[11px]">
            Stage {furthestStageReached}
          </span>
        </div>
      </div>

      {/* Thin Progress Bar */}
      <div className="w-full h-1 bg-slate-100 rounded-full mb-1.5 overflow-hidden">
        <div
          className="h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Compact Horizontal Stage Tracker: Opening → Purpose → Permission → ... */}
      <nav aria-label="Eight-Stage Progress Tracker" className="w-full overflow-x-auto pb-0.5 scrollbar-none">
        <ol className="flex items-center gap-1 min-w-max">
          {STAGES_CONFIG.map((stage, idx) => {
            const stageNum = stage.stageNumber;
            const isActive = stageNum === activeStage;
            const isReached = stageNum <= furthestStageReached;
            const isClickable = !disabled && (isReached || stageNum === activeStage);

            return (
              <React.Fragment key={stageNum}>
                <li>
                  <button
                    type="button"
                    onClick={() => isClickable && onSelectStage(stageNum)}
                    disabled={!isClickable}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`Stage ${stageNum}: ${stage.name}${isActive ? ' (Current)' : isReached ? ' (Visited)' : ' (Upcoming)'}`}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-indigo-600 text-white font-semibold shadow-3xs'
                        : isReached
                        ? 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-medium cursor-pointer'
                        : 'text-slate-400 bg-transparent cursor-not-allowed opacity-75'
                    }`}
                  >
                    {isReached && !isActive && (
                      <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                    )}
                    <span>{stage.shortName}</span>
                  </button>
                </li>

                {idx < STAGES_CONFIG.length - 1 && (
                  <span className="text-slate-300 text-xs select-none px-0.5">
                    →
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </ol>
      </nav>
    </div>
  );
};
