import React, { useState, useMemo, useCallback } from 'react';
import {
  GraphData,
  UrbanEdge,
  UrbanNode,
  ValidationReport,
} from '../types/graph';
import {
  Scenario,
  ScenarioIntervention,
  SimulationResult,
} from '../types/sim';
import { generateCity } from '../sim/generator';
import { validateCity } from '../sim/validator';
import { runSimulation } from '../sim/engine';
import { simulateCascade } from '../sim/cascade';
import { generateMitigations } from '../sim/mitigation';

// Components
import { Header } from './components/Header';
import { KpiDashboard } from './components/KpiDashboard';
import { Map } from './components/Map';
import { LayerControls, LayerVisibility } from './components/LayerControls';
import { Legend } from './components/Legend';
import { RightSidebar, SidebarTab } from './components/RightSidebar';
import { ComparisonModal } from './components/ComparisonModal';
import { ValidationModal } from './components/ValidationModal';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export const App: React.FC = () => {
  // 1. City Generator State
  const [seed, setSeed] = useState<number>(42891);
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');

  // Baseline Immutable City & Simulation Result
  const [baselineData, setBaselineData] = useState<{
    graph: GraphData;
    result: SimulationResult;
    validation: ValidationReport;
  }>(() => {
    const g = generateCity(42891, { size: 'medium' });
    const v = validateCity(g);
    const r = runSimulation(g);
    return { graph: g, result: r, validation: v };
  });

  // Scenario State
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [scenarioResult, setScenarioResult] = useState<SimulationResult | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Layer Visibility: clean defaults (hide power grid lines and drainage until requested)
  const [layers, setLayers] = useState<LayerVisibility>({
    transport: true,
    healthcare: true,
    education: true,
    population: true,
    electricity: false,
    drainage: false,
  });

  const [selectedItem, setSelectedItem] = useState<{
    type: 'node' | 'edge';
    data: UrbanNode | UrbanEdge;
  } | null>(null);

  // Unified Right Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('whatif');

  // Modals
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);

  // Regenerate City Handler
  const handleGenerateCity = useCallback(
    (newSeed: number, newSize: 'small' | 'medium' | 'large') => {
      setSeed(newSeed);
      setSize(newSize);
      const newGraph = generateCity(newSeed, { size: newSize });
      const newValidation = validateCity(newGraph);
      const newResult = runSimulation(newGraph);

      setBaselineData({
        graph: newGraph,
        result: newResult,
        validation: newValidation,
      });

      // Clear scenario and selection
      setActiveScenario(null);
      setScenarioResult(null);
      setCurrentStepIndex(0);
      setSelectedItem(null);
      setActiveSidebarTab('whatif');
    },
    []
  );

  // Apply Intervention & Run Cascade
  const handleApplyIntervention = useCallback(
    (intervention: ScenarioIntervention) => {
      const existingInterventions = activeScenario ? activeScenario.interventions : [];
      const updatedInterventions = [...existingInterventions, intervention];

      // Auto-enable drainage layer if rainfall is modified
      if (intervention.type === 'SET_RAINFALL') {
        setLayers((prev) => ({ ...prev, drainage: true }));
      }

      // Run multi-round cascading failure propagation
      const cascade = simulateCascade(baselineData.graph, updatedInterventions);
      const mitigations = generateMitigations(
        cascade.graph,
        cascade.result,
        baselineData.result.kpi
      );

      const scenario: Scenario = {
        id: `scenario_${Date.now()}`,
        name: `What-If Scenario (${updatedInterventions.length} modifiers)`,
        description: intervention.description,
        timestamp: Date.now(),
        interventions: updatedInterventions,
        graph: cascade.graph,
        kpi: cascade.result.kpi,
        cascadeSteps: cascade.steps,
        mitigations,
      };

      setActiveScenario(scenario);
      setScenarioResult(cascade.result);
      // Focus on Step 0 or Step 1 initially so user can see it propagate!
      setCurrentStepIndex(0);
      setActiveSidebarTab('cascade');
      setIsSidebarOpen(true);

      // Update selected item if it was modified
      if (selectedItem) {
        if (selectedItem.type === 'edge') {
          const updatedEdge = cascade.graph.edges[selectedItem.data.id];
          if (updatedEdge) setSelectedItem({ type: 'edge', data: updatedEdge });
        } else {
          const updatedNode = cascade.graph.nodes[selectedItem.data.id];
          if (updatedNode) setSelectedItem({ type: 'node', data: updatedNode });
        }
      }
    },
    [activeScenario, baselineData, selectedItem]
  );

  // Reset to Baseline (Revert all changes)
  const handleResetBaseline = useCallback(() => {
    setActiveScenario(null);
    setScenarioResult(null);
    setCurrentStepIndex(0);
    setActiveSidebarTab('whatif');
    if (selectedItem) {
      if (selectedItem.type === 'edge') {
        const origEdge = baselineData.graph.edges[selectedItem.data.id];
        if (origEdge) setSelectedItem({ type: 'edge', data: origEdge });
      } else {
        const origNode = baselineData.graph.nodes[selectedItem.data.id];
        if (origNode) setSelectedItem({ type: 'node', data: origNode });
      }
    }
  }, [baselineData, selectedItem]);

  // Remove a specific intervention and re-simulate remaining
  const handleRemoveIntervention = useCallback(
    (interventionId: string) => {
      if (!activeScenario) return;
      const updatedInterventions = activeScenario.interventions.filter(
        (int) => int.id !== interventionId
      );

      if (updatedInterventions.length === 0) {
        handleResetBaseline();
        return;
      }

      const cascade = simulateCascade(baselineData.graph, updatedInterventions);
      const mitigations = generateMitigations(
        cascade.graph,
        cascade.result,
        baselineData.result.kpi
      );

      const scenario: Scenario = {
        id: `scenario_${Date.now()}`,
        name: `What-If Scenario (${updatedInterventions.length} modifiers)`,
        description: `Reverted intervention. ${updatedInterventions.length} modifier(s) active.`,
        timestamp: Date.now(),
        interventions: updatedInterventions,
        graph: cascade.graph,
        kpi: cascade.result.kpi,
        cascadeSteps: cascade.steps,
        mitigations,
      };

      setActiveScenario(scenario);
      setScenarioResult(cascade.result);
      setCurrentStepIndex(0);

      if (selectedItem) {
        if (selectedItem.type === 'edge') {
          const updatedEdge = cascade.graph.edges[selectedItem.data.id];
          setSelectedItem({
            type: 'edge',
            data: updatedEdge || baselineData.graph.edges[selectedItem.data.id],
          });
        } else {
          const updatedNode = cascade.graph.nodes[selectedItem.data.id];
          setSelectedItem({
            type: 'node',
            data: updatedNode || baselineData.graph.nodes[selectedItem.data.id],
          });
        }
      }
    },
    [activeScenario, baselineData, handleResetBaseline, selectedItem]
  );

  // Revert all interventions on a specific target (e.g. restore transformer or reopen road)
  const handleRevertTarget = useCallback(
    (targetId: string) => {
      if (!activeScenario) return;
      const updatedInterventions = activeScenario.interventions.filter(
        (int) => int.targetId !== targetId
      );

      if (updatedInterventions.length === 0) {
        handleResetBaseline();
        return;
      }

      const cascade = simulateCascade(baselineData.graph, updatedInterventions);
      const mitigations = generateMitigations(
        cascade.graph,
        cascade.result,
        baselineData.result.kpi
      );

      const scenario: Scenario = {
        id: `scenario_${Date.now()}`,
        name: `What-If Scenario (${updatedInterventions.length} modifiers)`,
        description: `Reverted interventions on ${targetId}`,
        timestamp: Date.now(),
        interventions: updatedInterventions,
        graph: cascade.graph,
        kpi: cascade.result.kpi,
        cascadeSteps: cascade.steps,
        mitigations,
      };

      setActiveScenario(scenario);
      setScenarioResult(cascade.result);
      setCurrentStepIndex(0);

      if (selectedItem) {
        if (selectedItem.type === 'edge') {
          const updatedEdge = cascade.graph.edges[selectedItem.data.id];
          setSelectedItem({
            type: 'edge',
            data: updatedEdge || baselineData.graph.edges[selectedItem.data.id],
          });
        } else {
          const updatedNode = cascade.graph.nodes[selectedItem.data.id];
          setSelectedItem({
            type: 'node',
            data: updatedNode || baselineData.graph.nodes[selectedItem.data.id],
          });
        }
      }
    },
    [activeScenario, baselineData, handleResetBaseline, selectedItem]
  );

  // Handle map selection: auto-switch to Inspect tab
  const handleSelectItem = useCallback(
    (item: { type: 'node' | 'edge'; data: UrbanNode | UrbanEdge } | null) => {
      setSelectedItem(item);
      if (item) {
        setActiveSidebarTab('inspect');
        setIsSidebarOpen(true);
      }
    },
    []
  );

  const isScenarioActive = activeScenario !== null;

  // Active step in cascade
  const activeStep = useMemo(() => {
    if (!activeScenario || !activeScenario.cascadeSteps[currentStepIndex]) return null;
    return activeScenario.cascadeSteps[currentStepIndex];
  }, [activeScenario, currentStepIndex]);

  // CRITICAL FIX: The graph and simulation result reflect the ACTIVE CASCADE STEP!
  // When scrubbing or playing the timeline, the user literally watches the map change state at every step!
  const currentGraph = useMemo(() => {
    if (activeStep && activeStep.graphSnapshot) {
      return activeStep.graphSnapshot;
    }
    return activeScenario ? activeScenario.graph : baselineData.graph;
  }, [activeStep, activeScenario, baselineData.graph]);

  const currentResult = useMemo(() => {
    if (activeStep && activeStep.resultSnapshot) {
      return activeStep.resultSnapshot;
    }
    return scenarioResult || baselineData.result;
  }, [activeStep, scenarioResult, baselineData.result]);

  const currentKpi = useMemo(() => {
    return currentResult.kpi;
  }, [currentResult]);

  // Active failing IDs for the current cascade step
  const activeFailingIds = useMemo(() => {
    if (!activeStep) return [];
    return activeStep.activeFailingIds || [];
  }, [activeStep]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      {/* 1. Slim Top Header */}
      <Header
        seed={seed}
        size={size}
        onGenerate={handleGenerateCity}
        validationReport={baselineData.validation}
        onOpenValidationModal={() => setIsValidationModalOpen(true)}
        onOpenComparisonModal={() => setIsComparisonModalOpen(true)}
        isScenario={isScenarioActive}
        interventionCount={activeScenario?.interventions.length || 0}
        onResetBaseline={handleResetBaseline}
      />

      {/* 2. Compact Top KPI Ribbon */}
      <KpiDashboard
        currentKpi={currentKpi}
        baselineKpi={isScenarioActive ? baselineData.result.kpi : undefined}
        isScenario={isScenarioActive}
      />

      {/* 3. Main Workspace Area (Clean, Expansive Vector Map) */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Full-bleed SVG Map */}
        <div className="flex-1 relative h-full w-full">
          <Map
            graph={currentGraph}
            simulationResult={currentResult}
            layers={layers}
            selectedId={selectedItem?.data.id || null}
            onSelect={handleSelectItem}
            failingIds={activeFailingIds}
            onConstructBuilding={(type, position, parcelId) => {
              handleApplyIntervention({
                id: `construct_${Date.now()}`,
                type: 'CONSTRUCT_BUILDING',
                targetId: parcelId || 'map_canvas',
                parameters: {
                  facilityType: type,
                  position,
                  parcelId,
                  name: `New ${type} (${Math.round(position.x)}, ${Math.round(position.y)})`,
                  capacity:
                    type === 'Hospital'
                      ? 120
                      : type === 'School'
                      ? 450
                      : type === 'ResidentialZone'
                      ? 1200
                      : 300,
                },
                description: `Constructed new ${type} at (${Math.round(position.x)}, ${Math.round(
                  position.y
                )})${parcelId ? ` in parcel ${parcelId}` : ''}`,
                timestamp: Date.now(),
              });
            }}
          />

          {/* Floating Top-Left Minimal Layer Controls */}
          <div className="absolute top-4 left-4 z-20">
            <LayerControls layers={layers} onChange={setLayers} />
          </div>

          {/* Floating Bottom-Left Collapsible Legend */}
          <div className="absolute bottom-4 left-4 z-20">
            <Legend />
          </div>

          {/* DYNAMIC CASCADE TEXTUAL INSIGHT BANNER */}
          {activeScenario && activeStep && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 max-w-xl w-[90%] md:w-auto min-w-[340px] pointer-events-none select-text">
              <div className="glass-panel rounded-2xl shadow-2xl border border-cyan-500/40 bg-slate-900/95 p-4 pointer-events-auto backdrop-blur-xl space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 animate-pulse shrink-0 text-cyan-400" />
                    <span>{activeStep.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleResetBaseline}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
                      title="Revert all changes and restore pristine baseline city"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Revert Changes</span>
                    </button>
                    <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-cyan-800/80 font-bold shrink-0">
                      Step {currentStepIndex + 1} of {activeScenario.cascadeSteps.length}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {activeStep.narrativeInsight}
                </p>
                {activeStep.events.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/90 flex items-center gap-2 overflow-x-auto text-[11px]">
                    <span className="text-slate-400 font-semibold uppercase text-[10px] shrink-0 tracking-wider">
                      Impacted Assets:
                    </span>
                    {activeStep.events.slice(0, 5).map((evt) => (
                      <span
                        key={evt.id}
                        className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px] shrink-0 font-medium"
                      >
                        {evt.componentName}: <span className="text-rose-400 font-bold uppercase">{evt.newStatus}</span>
                      </span>
                    ))}
                    {activeStep.events.length > 5 && (
                      <span className="text-slate-400 text-[10px] shrink-0 font-mono">
                        +{activeStep.events.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. Single Right Docked Collapsible Sidebar */}
        <RightSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          activeTab={activeSidebarTab}
          onSelectTab={setActiveSidebarTab}
          graph={currentGraph}
          onApplyIntervention={handleApplyIntervention}
          onResetBaseline={handleResetBaseline}
          onRemoveIntervention={handleRemoveIntervention}
          onRevertTarget={handleRevertTarget}
          activeInterventions={activeScenario?.interventions || []}
          isScenarioActive={isScenarioActive}
          cascadeSteps={activeScenario?.cascadeSteps || []}
          currentStepIndex={currentStepIndex}
          onStepChange={setCurrentStepIndex}
          selectedItem={selectedItem}
          simulationResult={currentResult}
          onCloseInspect={() => setSelectedItem(null)}
          onApplyContextAction={(type, targetId, params) => {
            handleApplyIntervention({
              id: `int_${Date.now()}`,
              type: type as any,
              targetId,
              parameters: params || {},
              description: `Applied ${type} on ${targetId}`,
              timestamp: Date.now(),
            });
          }}
        />
      </div>

      {/* 5. Modals */}
      {isComparisonModalOpen && (
        <ComparisonModal
          isOpen={isComparisonModalOpen}
          onClose={() => setIsComparisonModalOpen(false)}
          baselineKpi={baselineData.result.kpi}
          scenarioKpi={currentKpi}
          mitigations={
            activeScenario?.mitigations ||
            generateMitigations(
              baselineData.graph,
              baselineData.result,
              baselineData.result.kpi
            )
          }
          scenarioResult={currentResult}
        />
      )}

      {isValidationModalOpen && (
        <ValidationModal
          isOpen={isValidationModalOpen}
          onClose={() => setIsValidationModalOpen(false)}
          report={baselineData.validation}
        />
      )}
    </div>
  );
};
