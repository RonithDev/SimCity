import React from 'react';
import {
  GraphData,
  UrbanEdge,
  UrbanNode,
} from '../../types/graph';
import {
  CascadeStep,
  ScenarioIntervention,
  SimulationResult,
} from '../../types/sim';
import { SidePanel } from './SidePanel';
import { WhatIfStudio } from './WhatIfStudio';
import { CascadeViewer } from './CascadeViewer';
import { Activity, ChevronRight, Layers, Play, Sparkles } from 'lucide-react';

export type SidebarTab = 'whatif' | 'cascade' | 'inspect';

interface RightSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  // What-If props
  graph: GraphData;
  onApplyIntervention: (intervention: ScenarioIntervention) => void;
  onResetBaseline: () => void;
  onRemoveIntervention?: (id: string) => void;
  onRevertTarget?: (targetId: string) => void;
  activeInterventions: ScenarioIntervention[];
  isScenarioActive: boolean;
  // Cascade props
  cascadeSteps: CascadeStep[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  // Inspector props
  selectedItem: { type: 'node' | 'edge'; data: UrbanNode | UrbanEdge } | null;
  simulationResult: SimulationResult;
  onCloseInspect: () => void;
  onApplyContextAction: (type: string, targetId: string, params?: any) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onToggle,
  activeTab,
  onSelectTab,
  graph,
  onApplyIntervention,
  onResetBaseline,
  onRemoveIntervention,
  onRevertTarget,
  activeInterventions,
  isScenarioActive,
  cascadeSteps,
  currentStepIndex,
  onStepChange,
  selectedItem,
  simulationResult,
  onCloseInspect,
  onApplyContextAction,
}) => {
  return (
    <div
      className={`fixed top-[102px] right-0 bottom-0 z-30 transition-all duration-300 ease-in-out flex select-none ${
        isOpen ? 'translate-x-0' : 'translate-x-[calc(100%-42px)]'
      }`}
    >
      {/* Sidebar Edge Strip / Collapse Button */}
      <div className="w-[42px] bg-slate-900/95 border-l border-y border-slate-800 flex flex-col items-center py-3 gap-3 shadow-2xl backdrop-blur-md">
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={isOpen ? 'Collapse Panel' : 'Expand Panel'}
        >
          <ChevronRight
            className={`w-4 h-4 transition-transform duration-300 ${
              isOpen ? 'rotate-0' : 'rotate-180'
            }`}
          />
        </button>

        <div className="w-5 h-px bg-slate-800" />

        {/* Tab Icons */}
        <button
          onClick={() => {
            onSelectTab('whatif');
            if (!isOpen) onToggle();
          }}
          className={`p-2 rounded-lg transition-colors relative ${
            activeTab === 'whatif' && isOpen
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="What-If Studio"
        >
          <Sparkles className="w-4 h-4" />
          {activeInterventions.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400" />
          )}
        </button>

        {isScenarioActive && (
          <button
            onClick={() => {
              onSelectTab('cascade');
              if (!isOpen) onToggle();
            }}
            className={`p-2 rounded-lg transition-colors relative ${
              activeTab === 'cascade' && isOpen
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Cascade Timeline"
          >
            <Play className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          </button>
        )}

        <button
          onClick={() => {
            onSelectTab('inspect');
            if (!isOpen) onToggle();
          }}
          className={`p-2 rounded-lg transition-colors relative ${
            activeTab === 'inspect' && isOpen
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Element Inspector"
        >
          <Activity className="w-4 h-4" />
          {selectedItem && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-400" />
          )}
        </button>
      </div>

      {/* Main Sidebar Panel Content */}
      <div className="w-[440px] sm:w-[470px] h-full bg-slate-900/95 border-l border-slate-800 flex flex-col shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Tab Headers */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/70 p-1.5 text-xs gap-1">
          <button
            onClick={() => onSelectTab('whatif')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              activeTab === 'whatif'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/80 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>What-If</span>
          </button>

          {isScenarioActive && (
            <button
              onClick={() => onSelectTab('cascade')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                activeTab === 'cascade'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700/80 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Play className="w-3.5 h-3.5 text-rose-400" />
              <span>Cascade</span>
            </button>
          )}

          <button
            onClick={() => onSelectTab('inspect')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              activeTab === 'inspect'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/80 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Inspector</span>
            {selectedItem && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
            )}
          </button>
        </div>

        {/* Tab View Body */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'whatif' && (
            <div className="p-4 sm:p-5">
              <WhatIfStudio
                graph={graph}
                onApplyIntervention={onApplyIntervention}
                onResetBaseline={onResetBaseline}
                onRemoveIntervention={onRemoveIntervention}
                activeInterventions={activeInterventions}
                isScenarioActive={isScenarioActive}
              />
            </div>
          )}

          {activeTab === 'cascade' && isScenarioActive && (
            <div className="p-4 sm:p-5">
              <CascadeViewer
                steps={cascadeSteps}
                currentStepIndex={currentStepIndex}
                onStepChange={onStepChange}
                onResetBaseline={onResetBaseline}
                activeInterventions={activeInterventions}
                onRemoveIntervention={onRemoveIntervention}
              />
            </div>
          )}

          {activeTab === 'inspect' && (
            <div className="h-full">
              {selectedItem ? (
                <SidePanel
                  selectedItem={selectedItem}
                  simulationResult={simulationResult}
                  onClose={onCloseInspect}
                  onApplyIntervention={onApplyContextAction}
                  onRevertTarget={onRevertTarget}
                  activeInterventions={activeInterventions}
                />
              ) : (
                <div className="p-8 text-center text-slate-500 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center border border-slate-700">
                    <Layers className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="text-xs font-semibold text-slate-300">
                    No Element Selected
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                    Click on any road, hospital, residential sector, transformer, or intersection on the map to inspect its real-time telemetry and simulate disruptions.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
