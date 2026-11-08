import React, { useState, useEffect } from 'react';
import { CascadeStep, ScenarioIntervention } from '../../types/sim';
import { AlertCircle, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, ShieldAlert, Sparkles } from 'lucide-react';

interface CascadeViewerProps {
  steps: CascadeStep[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  onResetBaseline?: () => void;
  activeInterventions?: ScenarioIntervention[];
  onRemoveIntervention?: (id: string) => void;
}

export const CascadeViewer: React.FC<CascadeViewerProps> = ({
  steps,
  currentStepIndex,
  onStepChange,
  onResetBaseline,
  activeInterventions = [],
  onRemoveIntervention,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Play / auto-advance timer
  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        if (currentStepIndex >= steps.length - 1) {
          setIsPlaying(false);
        } else {
          onStepChange(currentStepIndex + 1);
        }
      }, 1800);
    }
    return () => clearInterval(timer);
  }, [isPlaying, steps.length, currentStepIndex, onStepChange]);

  const activeStep = steps[currentStepIndex] || steps[0];
  const totalEvents = steps.reduce((sum, s) => sum + s.events.length, 0);

  return (
    <div className="space-y-5 text-xs select-none">
      {/* Title & Stats Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Cascading Failure Timeline</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
            Step-by-step rule propagation across urban dependencies.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60 font-mono font-semibold">
            {totalEvents} failures
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {currentStepIndex + 1}/{steps.length}
          </span>
        </div>
      </div>

      {/* Prominent Revert Button & Active Interventions List */}
      <div className="bg-gradient-to-r from-rose-950/40 to-slate-900/90 p-3.5 rounded-xl border border-rose-500/50 space-y-3 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>Active Disruption Triggers ({activeInterventions.length})</span>
          </div>
          {onResetBaseline && (
            <button
              onClick={onResetBaseline}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              title="Revert all outages/closures and restore baseline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Revert All Changes</span>
            </button>
          )}
        </div>

        {activeInterventions.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {activeInterventions.map((int) => (
              <div
                key={int.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/85 border border-slate-800 text-xs"
              >
                <span className="text-slate-200 truncate font-mono text-[11px]">
                  {int.description || int.type}
                </span>
                {onRemoveIntervention && (
                  <button
                    onClick={() => onRemoveIntervention(int.id)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-600 text-[10px] font-semibold transition-colors cursor-pointer shrink-0"
                    title="Undo this specific change"
                  >
                    <RotateCcw className="w-3 h-3 text-rose-400" />
                    <span>Revert</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scrubber & Player Controls Card */}
      <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onStepChange(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
              title="Previous Step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`py-2 px-3.5 rounded-lg font-semibold flex items-center gap-2 transition-all text-xs shadow-md cursor-pointer ${
                isPlaying
                  ? 'bg-amber-600 text-white hover:bg-amber-500'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Play Cascade</span>
                </>
              )}
            </button>
            <button
              onClick={() => onStepChange(Math.min(steps.length - 1, currentStepIndex + 1))}
              disabled={currentStepIndex === steps.length - 1}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
              title="Next Step"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                onStepChange(0);
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Reset to Step 0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-cyan-300 truncate max-w-[140px]">
              {activeStep.title}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Round {activeStep.round}
            </div>
          </div>
        </div>

        {/* Step Scrubber Slider */}
        <div className="pt-1.5 space-y-1.5">
          <input
            type="range"
            min={0}
            max={steps.length - 1}
            value={currentStepIndex}
            onChange={(e) => {
              setIsPlaying(false);
              onStepChange(parseInt(e.target.value));
            }}
            className="w-full accent-rose-500 h-2 bg-slate-700 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Step 0 (Trigger)</span>
            <span>Rounds 1-{Math.max(1, steps.length - 2)}</span>
            <span>Equilibrium</span>
          </div>
        </div>
      </div>

      {/* Narrative Textual Insight Callout */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2 shadow-sm">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Systemic Impact Narrative</span>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed font-sans">
          {activeStep.narrativeInsight || activeStep.description}
        </p>
      </div>

      {/* Step Event Log List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span>Component Status Changes ({activeStep.events.length})</span>
          <span className="text-slate-500 normal-case font-normal text-[10px]">
            {activeStep.activeFailingIds.length} newly disrupted
          </span>
        </div>

        {activeStep.events.length === 0 ? (
          <div className="p-4 text-center text-slate-400 italic bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
            No further disruptions occurred in this round. The city graph reached a new steady-state equilibrium.
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {activeStep.events.map((evt) => (
              <div
                key={evt.id}
                className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 space-y-1.5 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-100 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">{evt.componentName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                    <span className="text-slate-400 line-through">{evt.previousStatus}</span>
                    <span className="text-slate-500">&rarr;</span>
                    <span className="text-rose-400 font-bold uppercase px-1.5 py-0.2 rounded bg-rose-950/60 border border-rose-800/60">
                      {evt.newStatus}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-300 leading-relaxed pl-5 font-mono">
                  {evt.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
