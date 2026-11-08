import React, { useState } from 'react';
import {
  GraphData,
  HospitalNode,
  TransformerNode,
} from '../../types/graph';
import { ScenarioIntervention } from '../../types/sim';
import {
  Activity,
  Building2,
  CloudRain,
  Home,
  Hospital as HospitalIcon,
  PlusCircle,
  RotateCcw,
  School as SchoolIcon,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';

interface WhatIfStudioProps {
  graph: GraphData;
  onApplyIntervention: (intervention: ScenarioIntervention) => void;
  onResetBaseline: () => void;
  onRemoveIntervention?: (id: string) => void;
  activeInterventions: ScenarioIntervention[];
  isScenarioActive: boolean;
}

export const WhatIfStudio: React.FC<WhatIfStudioProps> = ({
  graph,
  onApplyIntervention,
  onResetBaseline,
  onRemoveIntervention,
  activeInterventions,
  isScenarioActive,
}) => {
  // Negative disruption state
  const [selectedRoadId, setSelectedRoadId] = useState<string>('');
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('');
  const [hospitalSurgeMultiplier, setHospitalSurgeMultiplier] = useState<number>(2.0);
  const [selectedTransformerId, setSelectedTransformerId] = useState<string>('');
  const [rainfallMmH, setRainfallMmH] = useState<number>(graph.config.rainfallIntensityMmPerHour || 0);

  // Positive construction state
  const [constructType, setConstructType] = useState<'Hospital' | 'School' | 'ResidentialZone' | 'DrainageNode'>('Hospital');
  const [constructCapacity, setConstructCapacity] = useState<number>(180);
  const [constructParcelId, setConstructParcelId] = useState<string>('');
  const [constructName, setConstructName] = useState<string>('');

  // Available candidate assets
  const roadList = Object.values(graph.edges).filter((e) => e.type === 'ROAD');
  const mainRoads = roadList.filter((e) => e.roadType === 'main');
  const hospitals = Object.values(graph.nodes).filter(
    (n): n is HospitalNode => n.type === 'Hospital'
  );
  const transformers = Object.values(graph.nodes).filter(
    (n): n is TransformerNode => n.type === 'Transformer'
  );
  const parcels = graph.parcels || [];

  // Apply road closure
  const handleCloseRoad = () => {
    const target = selectedRoadId || (mainRoads[0]?.id ?? roadList[0]?.id);
    if (!target) return;
    onApplyIntervention({
      id: `int_road_${Date.now()}`,
      type: 'CLOSE_ROAD',
      targetId: target,
      parameters: {},
      description: `Close Arterial Road ${target}`,
      timestamp: Date.now(),
    });
  };

  // Apply hospital surge
  const handleHospitalSurge = () => {
    const target = selectedHospitalId || hospitals[0]?.id;
    if (!target) return;
    onApplyIntervention({
      id: `int_hosp_${Date.now()}`,
      type: 'SURGE_HOSPITAL_DEMAND',
      targetId: target,
      parameters: { demandMultiplier: hospitalSurgeMultiplier },
      description: `Surge Patient Demand at ${graph.nodes[target]?.name} (${hospitalSurgeMultiplier}x)`,
      timestamp: Date.now(),
    });
  };

  // Apply transformer outage
  const handleTransformerTrip = () => {
    const target = selectedTransformerId || transformers[0]?.id;
    if (!target) return;
    onApplyIntervention({
      id: `int_tx_${Date.now()}`,
      type: 'DISABLE_TRANSFORMER',
      targetId: target,
      parameters: {},
      description: `Trip Transformer Breaker at ${graph.nodes[target]?.name}`,
      timestamp: Date.now(),
    });
  };

  // Apply rainfall change
  const handleApplyRainfall = (val: number) => {
    setRainfallMmH(val);
    onApplyIntervention({
      id: `int_rain_${Date.now()}`,
      type: 'SET_RAINFALL',
      parameters: { rainfallIntensityMmPerHour: val },
      description: `Set Atmospheric Rainfall to ${val} mm/h`,
      timestamp: Date.now(),
    });
  };

  // Apply new building construction
  const handleConstructBuilding = () => {
    const defaultName =
      constructType === 'Hospital'
        ? `Metro Urgent Care Clinic #${hospitals.length + 1}`
        : constructType === 'School'
        ? `Civic Academy Campus #${Date.now().toString().slice(-3)}`
        : constructType === 'ResidentialZone'
        ? `Oakwood Residential Sector ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`
        : `Stormwater Pump Station #${Date.now().toString().slice(-2)}`;

    onApplyIntervention({
      id: `int_construct_${Date.now()}`,
      type: 'CONSTRUCT_BUILDING',
      parameters: {
        buildingType: constructType,
        name: constructName.trim() || defaultName,
        capacity: constructCapacity,
        parcelId: constructParcelId || undefined,
      },
      description: `Construct ${constructType}: ${constructName.trim() || defaultName} (+${constructCapacity} capacity)`,
      timestamp: Date.now(),
    });

    setConstructName('');
  };

  return (
    <div className="space-y-6 text-xs select-none">
      {/* Header & Reset */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>What-If Scenario Studio</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Construct new facilities or apply stress tests to see real-time urban twin impacts.
          </p>
        </div>
        {isScenarioActive && (
          <button
            onClick={onResetBaseline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs border border-rose-500 shadow-sm transition-all shrink-0 cursor-pointer"
            title="Revert all changes and restore pristine baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Revert All</span>
          </button>
        )}
      </div>

      {/* Active Interventions List with Revert buttons */}
      {isScenarioActive && activeInterventions.length > 0 && (
        <div className="bg-gradient-to-r from-rose-950/30 to-slate-900/90 p-3.5 rounded-xl border border-rose-500/50 space-y-2.5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              Active Scenario Disruption Triggers ({activeInterventions.length})
            </span>
            <button
              onClick={onResetBaseline}
              className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold underline cursor-pointer"
            >
              Revert All
            </button>
          </div>
          <div className="space-y-1.5">
            {activeInterventions.map((int) => (
              <div
                key={int.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs"
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
        </div>
      )}

      {/* SECTION 1: CONSTRUCT NEW BUILDINGS */}
      <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-cyan-950/30 p-4 rounded-xl border border-emerald-500/40 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>🏗️ Construct New Facility (What-If Growth)</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/60 font-semibold">
            Active Planning
          </span>
        </div>

        {/* Building Type Selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setConstructType('Hospital');
              setConstructCapacity(180);
            }}
            className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
              constructType === 'Hospital'
                ? 'bg-rose-950/60 border-rose-500 text-rose-200 shadow-sm'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
            }`}
          >
            <HospitalIcon className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <div className="font-bold text-[11px]">Hospital</div>
              <div className="text-[9px] text-slate-400">Emergency & beds</div>
            </div>
          </button>

          <button
            onClick={() => {
              setConstructType('School');
              setConstructCapacity(800);
            }}
            className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
              constructType === 'School'
                ? 'bg-blue-950/60 border-blue-500 text-blue-200 shadow-sm'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
            }`}
          >
            <SchoolIcon className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <div className="font-bold text-[11px]">School</div>
              <div className="text-[9px] text-slate-400">Education campus</div>
            </div>
          </button>

          <button
            onClick={() => {
              setConstructType('ResidentialZone');
              setConstructCapacity(2200);
            }}
            className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
              constructType === 'ResidentialZone'
                ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-sm'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
            }`}
          >
            <Home className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <div className="font-bold text-[11px]">Housing Sector</div>
              <div className="text-[9px] text-slate-400">New residents</div>
            </div>
          </button>

          <button
            onClick={() => {
              setConstructType('DrainageNode');
              setConstructCapacity(2500);
            }}
            className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
              constructType === 'DrainageNode'
                ? 'bg-sky-950/60 border-sky-500 text-sky-200 shadow-sm'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
            }`}
          >
            <CloudRain className="w-4 h-4 text-sky-400 shrink-0" />
            <div>
              <div className="font-bold text-[11px]">Drainage Pump</div>
              <div className="text-[9px] text-slate-400">Stormwater relief</div>
            </div>
          </button>
        </div>

        {/* Target Parcel Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-300 font-semibold flex items-center justify-between">
            <span>City Block Parcel Location:</span>
            <span className="text-[9px] text-cyan-400 font-normal">Strict road setback enforced</span>
          </label>
          <select
            value={constructParcelId}
            onChange={(e) => setConstructParcelId(e.target.value)}
            className="w-full bg-slate-800/90 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="">Auto-Select Optimal Open Parcel</option>
            {parcels.slice(0, 16).map((p) => (
              <option key={p.id} value={p.id}>
                Block {p.id.toUpperCase()} ({p.parcelType.toUpperCase()} zone)
              </option>
            ))}
          </select>
        </div>

        {/* Capacity / Population Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-slate-200 text-[11px]">
            <span className="font-semibold">
              {constructType === 'Hospital'
                ? 'Hospital Bed Capacity'
                : constructType === 'School'
                ? 'Student Enrollment Capacity'
                : constructType === 'ResidentialZone'
                ? 'Neighborhood Population'
                : 'Stormwater Intake Capacity'}
            </span>
            <span className="font-mono text-emerald-300 font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">
              {constructCapacity.toLocaleString()}{' '}
              {constructType === 'Hospital'
                ? 'beds'
                : constructType === 'School'
                ? 'students'
                : constructType === 'ResidentialZone'
                ? 'residents'
                : 'L/s'}
            </span>
          </div>
          <input
            type="range"
            min={
              constructType === 'Hospital'
                ? 60
                : constructType === 'School'
                ? 300
                : constructType === 'ResidentialZone'
                ? 800
                : 1000
            }
            max={
              constructType === 'Hospital'
                ? 350
                : constructType === 'School'
                ? 2000
                : constructType === 'ResidentialZone'
                ? 4500
                : 5000
            }
            step={constructType === 'Hospital' ? 20 : constructType === 'School' ? 100 : 200}
            value={constructCapacity}
            onChange={(e) => setConstructCapacity(parseInt(e.target.value))}
            className="w-full accent-emerald-400 h-2 bg-slate-700 rounded-lg cursor-pointer"
          />
        </div>

        {/* Optional Custom Facility Name */}
        <div className="space-y-1.5">
          <input
            type="text"
            placeholder={
              constructType === 'Hospital'
                ? 'Facility name (e.g., St. Jude Urgent Care Clinic)'
                : constructType === 'School'
                ? 'Campus name (e.g., Horizon STEM Academy)'
                : 'Neighborhood name (e.g., Pinecrest Meadows)'
            }
            value={constructName}
            onChange={(e) => setConstructName(e.target.value)}
            className="w-full bg-slate-800/90 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
          />
        </div>

        {/* Action Button */}
        <button
          onClick={handleConstructBuilding}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:shadow-emerald-500/20 hover:scale-[1.01]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Construct Facility & Run Impact Simulation</span>
        </button>
      </div>

      {/* SECTION 2: QUICK ONE-CLICK PRESETS */}
      <div className="space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span>⚡ One-Click Policy & Disaster Presets</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              onApplyIntervention({
                id: `preset_build_hosp_${Date.now()}`,
                type: 'CONSTRUCT_BUILDING',
                parameters: {
                  buildingType: 'Hospital',
                  name: 'St. Jude Emergency Center',
                  capacity: 220,
                },
                description: 'Build Regional Hospital (+220 beds)',
                timestamp: Date.now(),
              });
            }}
            className="p-3.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 text-left text-xs text-emerald-200 flex flex-col gap-1.5 transition-all shadow-sm hover:border-emerald-500 hover:scale-[1.01] cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold">
              <PlusCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>+ Regional Hospital</span>
            </div>
            <span className="text-[10px] text-emerald-300/70 leading-normal">
              Cuts response time & boosts 10m access
            </span>
          </button>

          <button
            onClick={() => handleApplyRainfall(75)}
            className="p-3.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/60 text-left text-xs text-blue-200 flex flex-col gap-1.5 transition-all shadow-sm hover:border-blue-500 hover:scale-[1.01] cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold">
              <CloudRain className="w-4 h-4 text-blue-400 shrink-0" />
              <span>75mm Storm</span>
            </div>
            <span className="text-[10px] text-blue-300/70 leading-normal">
              Submerges low-elevation basin arterials
            </span>
          </button>

          <button
            onClick={() => {
              const arterial = mainRoads[0] || roadList[0];
              if (arterial) {
                onApplyIntervention({
                  id: `preset_road_${Date.now()}`,
                  type: 'CLOSE_ROAD',
                  targetId: arterial.id,
                  parameters: {},
                  description: `Arterial Bottleneck (${arterial.id})`,
                  timestamp: Date.now(),
                });
              }
            }}
            className="p-3.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/60 text-left text-xs text-rose-200 flex flex-col gap-1.5 transition-all shadow-sm hover:border-rose-500 hover:scale-[1.01] cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Arterial Severed</span>
            </div>
            <span className="text-[10px] text-rose-300/70 leading-normal">
              Detours 1,200 veh/h onto local grid
            </span>
          </button>

          <button
            onClick={() => {
              if (transformers[0]) {
                onApplyIntervention({
                  id: `preset_tx_${Date.now()}`,
                  type: 'DISABLE_TRANSFORMER',
                  targetId: transformers[0].id,
                  parameters: {},
                  description: `Substation Feeder Blackout (${transformers[0].name})`,
                  timestamp: Date.now(),
                });
              }
            }}
            className="p-3.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 text-left text-xs text-amber-200 flex flex-col gap-1.5 transition-all shadow-sm hover:border-amber-500 hover:scale-[1.01] cursor-pointer"
          >
            <div className="flex items-center gap-2 font-semibold">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Feeder Blackout</span>
            </div>
            <span className="text-[10px] text-amber-300/70 leading-normal">
              Trips signals & unbacked clinics
            </span>
          </button>
        </div>
      </div>

      {/* SECTION 3: MANUAL DISRUPTION INTERVENTIONS */}
      <div className="space-y-4 pt-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Disruptive Stress Tests & Failure Injections
        </div>

        {/* 1. Road Closure */}
        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>1. Close Road Segment</span>
            </span>
            <span className="text-[10px] text-slate-400">Reroutes vehicular flow</span>
          </div>
          <div className="flex gap-2.5 items-center">
            <select
              value={selectedRoadId}
              onChange={(e) => setSelectedRoadId(e.target.value)}
              className="flex-1 bg-slate-800/90 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <optgroup label="Main Arterial Corridors">
                {mainRoads.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} - Arterial ({r.capacity} veh/h, {r.lanes} lanes)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Local Streets">
                {roadList
                  .filter((r) => r.roadType === 'local')
                  .slice(0, 15)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} - Local ({r.capacity} veh/h)
                    </option>
                  ))}
              </optgroup>
            </select>
            <button
              onClick={handleCloseRoad}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md transition-colors shrink-0 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* 2. Hospital Demand Surge */}
        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-400" />
              <span>2. Healthcare Demand Surge</span>
            </span>
            <span className="text-[10px] text-slate-400">Triggers patient diversion</span>
          </div>
          <div className="flex gap-2.5 items-center">
            <select
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(e.target.value)}
              className="flex-1 bg-slate-800/90 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.beds} beds)
                </option>
              ))}
            </select>
            <select
              value={hospitalSurgeMultiplier}
              onChange={(e) => setHospitalSurgeMultiplier(parseFloat(e.target.value))}
              className="w-24 bg-slate-800/90 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value={1.5}>+50% (1.5x)</option>
              <option value={2.0}>+100% (2x)</option>
              <option value={2.5}>+150% (2.5x)</option>
              <option value={3.5}>+250% (3.5x)</option>
            </select>
            <button
              onClick={handleHospitalSurge}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md transition-colors shrink-0 cursor-pointer"
            >
              Surge
            </button>
          </div>
        </div>

        {/* 3. Disable Transformer */}
        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>3. Transformer Outage</span>
            </span>
            <span className="text-[10px] text-slate-400">Blacks out signals & consumers</span>
          </div>
          <div className="flex gap-2.5 items-center">
            <select
              value={selectedTransformerId}
              onChange={(e) => setSelectedTransformerId(e.target.value)}
              className="flex-1 bg-slate-800/90 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {transformers.map((tx) => (
                <option key={tx.id} value={tx.id}>
                  {tx.name} ({tx.servicedConsumerIds.length} consumers)
                </option>
              ))}
            </select>
            <button
              onClick={handleTransformerTrip}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-md transition-colors shrink-0 cursor-pointer"
            >
              Trip Offline
            </button>
          </div>
        </div>

        {/* 4. Rainfall Slider */}
        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800/90 space-y-3">
          <div className="flex justify-between items-center text-slate-200">
            <span className="font-semibold flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-blue-400" />
              <span>4. Stormwater Rainfall Intensity</span>
            </span>
            <span className="font-mono text-cyan-300 font-bold px-2.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs">
              {rainfallMmH} mm/h
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="120"
            step="10"
            value={rainfallMmH}
            onChange={(e) => handleApplyRainfall(parseInt(e.target.value))}
            className="w-full accent-cyan-400 h-2 bg-slate-700 rounded-lg cursor-pointer my-1.5"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>0 mm/h (Dry Weather)</span>
            <span>40 mm/h (Heavy Rain)</span>
            <span>80+ mm/h (Severe Storm)</span>
          </div>
        </div>
      </div>

      {/* Applied Interventions List */}
      {activeInterventions.length > 0 && (
        <div className="pt-4 border-t border-slate-800 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Active Scenario Modifiers ({activeInterventions.length})
          </div>
          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {activeInterventions.map((int, i) => (
              <div
                key={int.id || i}
                className="px-3.5 py-2 bg-slate-800/90 rounded-lg border border-slate-700 text-xs text-slate-200 flex items-center justify-between shadow-sm"
              >
                <span className="truncate pr-2">{int.description}</span>
                <span className="text-[10px] text-cyan-400 font-mono font-bold shrink-0">
                  #{i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
