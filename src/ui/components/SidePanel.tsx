import React from 'react';
import {
  HospitalNode,
  ResidentialZoneNode,
  TransformerNode,
  UrbanEdge,
  UrbanNode,
} from '../../types/graph';
import { ScenarioIntervention, SimulationResult } from '../../types/sim';
import { Activity, AlertTriangle, Battery, CheckCircle, Power, RotateCcw, ShieldAlert, X, Zap } from 'lucide-react';

interface SidePanelProps {
  selectedItem: { type: 'node' | 'edge'; data: UrbanNode | UrbanEdge } | null;
  simulationResult: SimulationResult;
  onClose: () => void;
  onApplyIntervention?: (type: string, targetId: string, params?: any) => void;
  onRevertTarget?: (targetId: string) => void;
  activeInterventions?: ScenarioIntervention[];
}

export const SidePanel: React.FC<SidePanelProps> = ({
  selectedItem,
  simulationResult,
  onClose,
  onApplyIntervention,
  onRevertTarget,
  activeInterventions = [],
}) => {
  if (!selectedItem) return null;

  const { type, data } = selectedItem;
  const isEdge = type === 'edge';
  const edge = isEdge ? (data as UrbanEdge) : null;
  const node = !isEdge ? (data as UrbanNode) : null;

  const status = data.status;
  const load = data.currentLoad;
  const capacity = data.capacity;
  const ratio = capacity > 0 ? load / capacity : 0;
  const loadPct = Math.min(150, Math.round(ratio * 100));

  const getStatusColor = (st: string) => {
    switch (st) {
      case 'healthy':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-600/60';
      case 'overloaded':
        return 'text-amber-400 bg-amber-950/60 border-amber-600/60';
      case 'damaged':
        return 'text-rose-400 bg-rose-950/60 border-rose-600/60';
      case 'failed':
        return 'text-red-400 bg-red-950 border-red-700';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="w-80 h-full glass-panel border-l border-slate-800 flex flex-col shadow-2xl z-30 select-text overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-start justify-between bg-slate-900/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {data.type}
            </span>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getStatusColor(
                status
              )}`}
            >
              {status}
            </span>
          </div>
          <h2 className="text-sm font-bold text-slate-100">
            {isEdge ? `Road ${edge?.id} (${edge?.roadType?.toUpperCase()})` : (node as any).name || node?.id}
          </h2>
          <div className="text-[11px] font-mono text-slate-500">{data.id}</div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Load vs Capacity Gauge */}
        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
          <div className="flex justify-between items-center mb-1.5 text-slate-300">
            <span className="font-semibold text-[11px]">System Load Factor</span>
            <span className="font-mono text-xs font-bold text-slate-100">
              {loadPct}% (ratio: {ratio.toFixed(2)})
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
            <div
              className={`h-full transition-all duration-300 ${
                loadPct >= 100
                  ? 'bg-rose-500'
                  : loadPct >= 75
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, loadPct)}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <div>
              <span className="block text-[9px] text-slate-500 uppercase">Current Load</span>
              <span className="font-mono font-medium text-slate-200">
                {load.toLocaleString()}{' '}
                {isEdge
                  ? 'veh/h'
                  : node?.type === 'Hospital'
                  ? 'patients'
                  : node?.type === 'Transformer'
                  ? 'kW'
                  : 'units'}
              </span>
            </div>
            <div>
              <span className="block text-[9px] text-slate-500 uppercase">Rated Capacity</span>
              <span className="font-mono font-medium text-slate-200">
                {capacity.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Failure Threshold:</span>
            <span className="font-mono text-amber-300 font-semibold">
              {(data.failureThreshold * 100).toFixed(0)}% capacity
            </span>
          </div>
        </div>

        {/* Node or Edge Specific Attributes */}
        {isEdge && edge && (
          <div className="space-y-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
            <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
              Road Parameters
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[9px]">Length</span>
                <span className="font-mono text-slate-200">{edge.length} m</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">Lanes</span>
                <span className="font-mono text-slate-200">{edge.lanes}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">Free Speed</span>
                <span className="font-mono text-slate-200">{edge.freeFlowSpeed} km/h</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">BPR Delay</span>
                <span className="font-mono text-slate-200">
                  {simulationResult.roadTravelTimes[edge.id] || 1} min
                </span>
              </div>
              {edge.floodDepthMm !== undefined && edge.floodDepthMm > 0 && (
                <div className="col-span-2 text-rose-300 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Submerged under {edge.floodDepthMm}mm water</span>
                </div>
              )}
            </div>
          </div>
        )}

        {!isEdge && node && (
          <div className="space-y-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
            <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
              Component Attributes
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[9px]">Coordinates</span>
                <span className="font-mono text-slate-200">
                  {Math.round(node.position.x)}, {Math.round(node.position.y)}
                </span>
              </div>

              {'elevation' in node && (
                <div>
                  <span className="text-slate-500 block text-[9px]">Elevation</span>
                  <span className="font-mono text-slate-200">{(node as any).elevation} m</span>
                </div>
              )}

              {node.type === 'ResidentialZone' && (
                <>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Population</span>
                    <span className="font-mono text-slate-200">
                      {(node as ResidentialZoneNode).population.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Density</span>
                    <span className="font-mono text-slate-200 uppercase">
                      {(node as ResidentialZoneNode).density}
                    </span>
                  </div>
                </>
              )}

              {node.type === 'Hospital' && (
                <>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Tier</span>
                    <span className="font-mono text-slate-200">{(node as HospitalNode).tier}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Total Beds</span>
                    <span className="font-mono text-slate-200">{(node as HospitalNode).beds}</span>
                  </div>
                </>
              )}

              {node.type === 'Transformer' && (
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[9px]">Serviced Consumers</span>
                  <span className="font-mono text-slate-200">
                    {(node as TransformerNode).servicedConsumerIds.length} infrastructure nodes
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Backup Power Info */}
        {node && (node as any).backup && (
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Battery className="w-3.5 h-3.5 text-amber-400" />
                Auxiliary Backup
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                  (node as any).backup.active
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {(node as any).backup.active ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-1 mt-1.5">
              <div className="flex justify-between">
                <span>Type:</span>
                <span className="font-mono text-slate-200 capitalize">{(node as any).backup.type}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration Reserve:</span>
                <span className="font-mono text-slate-200">
                  {(node as any).backup.durationHours} hours
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Dependencies */}
        {node && node.dependencies && node.dependencies.length > 0 && (
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
            <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Power Supply Feeder
            </div>
            <div className="space-y-1">
              {node.dependencies.map((depId) => (
                <div
                  key={depId}
                  className="px-2 py-1 bg-slate-800/80 rounded font-mono text-[10px] text-cyan-300 border border-slate-700/60 flex items-center justify-between"
                >
                  <span>{depId}</span>
                  <span className="text-[9px] text-slate-400">Primary Feed</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What-If Context Actions */}
        {onApplyIntervention && (
          <div className="pt-2">
            <div className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider mb-2">
              Contextual What-If Actions
            </div>
            {/* If this target is affected by an intervention, provide explicit 1-click revert */}
            {activeInterventions.some((i) => i.targetId === data.id) && onRevertTarget && (
              <button
                onClick={() => onRevertTarget(data.id)}
                className="w-full py-2 px-3 rounded-lg font-bold text-xs bg-rose-950/80 hover:bg-rose-900 border border-rose-500/80 text-rose-200 flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>Revert Changes on this Asset</span>
              </button>
            )}

            {isEdge && edge && (
              <button
                onClick={() => {
                  if (edge.isClosed && onRevertTarget) {
                    onRevertTarget(edge.id);
                  } else if (onApplyIntervention) {
                    onApplyIntervention(edge.isClosed ? 'OPEN_ROAD' : 'CLOSE_ROAD', edge.id);
                  }
                }}
                className={`w-full py-2 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  edge.isClosed
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-rose-600/90 hover:bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                }`}
              >
                {edge.isClosed ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Re-open Road Link (Revert)</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>Simulate Road Closure</span>
                  </>
                )}
              </button>
            )}

            {!isEdge && node?.type === 'Hospital' && (
              <button
                onClick={() => {
                  if (activeInterventions.some((i) => i.targetId === node.id) && onRevertTarget) {
                    onRevertTarget(node.id);
                  } else if (onApplyIntervention) {
                    onApplyIntervention('SURGE_HOSPITAL_DEMAND', node.id, { demandMultiplier: 2.5 });
                  }
                }}
                className={`w-full py-2 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeInterventions.some((i) => i.targetId === node.id)
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-rose-600/90 hover:bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                }`}
              >
                {activeInterventions.some((i) => i.targetId === node.id) ? (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Revert Patient Surge (Normalize)</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    <span>Trigger 2.5x Patient Surge</span>
                  </>
                )}
              </button>
            )}

            {!isEdge && node?.type === 'Transformer' && (
              <button
                onClick={() => {
                  if (node.status === 'failed' && onRevertTarget) {
                    onRevertTarget(node.id);
                  } else if (onApplyIntervention) {
                    onApplyIntervention(
                      node.status === 'failed' ? 'ENABLE_TRANSFORMER' : 'DISABLE_TRANSFORMER',
                      node.id
                    );
                  }
                }}
                className={`w-full py-2 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  node.status === 'failed'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                    : 'bg-red-700 hover:bg-red-600 text-white shadow-lg'
                }`}
              >
                <Power className="w-4 h-4" />
                <span>
                  {node.status === 'failed'
                    ? 'Restore Transformer (Revert Outage)'
                    : 'Trip Transformer Breaker (Outage)'}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
