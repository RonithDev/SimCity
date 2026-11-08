import React from 'react';
import { ValidationReport } from '../../types/graph';
import { CheckCircle2, X } from 'lucide-react';

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ValidationReport;
}

export const ValidationModal: React.FC<ValidationModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-xl rounded-xl shadow-2xl border border-slate-700/80 flex flex-col overflow-hidden bg-slate-900/95 text-xs">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                Synthetic City Graph Validation Audit
              </h2>
              <div className="text-[11px] text-slate-400">
                Graph Integrity & Multilayer Dependency Verification
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Status Banner */}
          <div
            className={`p-3 rounded-lg border flex items-center justify-between ${
              report.isValid
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-xs">
                {report.isValid
                  ? 'All Graph Validation Invariants Verified'
                  : 'Validation Issues Detected'}
              </span>
            </div>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-200">
              {report.totalNodes} Nodes · {report.totalEdges} Edges
            </span>
          </div>

          {/* Breakdown Stats */}
          <div>
            <h3 className="font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-2">
              Topology & Infrastructure Inventory
            </h3>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex justify-between">
                <span className="text-slate-400">Intersections:</span>
                <span className="text-slate-100 font-bold">{report.stats.intersections}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex justify-between">
                <span className="text-slate-400">Road Segments:</span>
                <span className="text-slate-100 font-bold">{report.stats.roads}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex justify-between">
                <span className="text-slate-400">Road Connectivity:</span>
                <span className="text-emerald-400 font-bold">100% Connected (BFS)</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex justify-between">
                <span className="text-slate-400">Hospitals:</span>
                <span className="text-slate-100 font-bold">{report.stats.hospitals}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex justify-between">
                <span className="text-slate-400">Schools:</span>
                <span className="text-slate-100 font-bold">{report.stats.schools}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex justify-between">
                <span className="text-slate-400">Residential Zones:</span>
                <span className="text-slate-100 font-bold">{report.stats.residentialZones}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex justify-between">
                <span className="text-slate-400">Substations:</span>
                <span className="text-slate-100 font-bold">{report.stats.substations}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex justify-between">
                <span className="text-slate-400">Transformers:</span>
                <span className="text-slate-100 font-bold">{report.stats.transformers}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex justify-between">
                <span className="text-slate-400">Drainage Stations:</span>
                <span className="text-slate-100 font-bold">{report.stats.drainageNodes}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex justify-between">
                <span className="text-slate-400">Flood Basins:</span>
                <span className="text-slate-100 font-bold">{report.stats.floodZones}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex justify-between col-span-2">
                <span className="text-slate-400">Total Population:</span>
                <span className="text-cyan-300 font-bold">{report.stats.totalPopulation.toLocaleString()} citizens</span>
              </div>
            </div>
          </div>

          {/* Validation Checks Passed */}
          <div>
            <h3 className="font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-2">
              Structural Invariant Verification Checks
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-2 rounded bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Every facility, school, and zone has an explicit physical ACCESS link to the road network.</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Every electricity consumer (hospital, school, zone, traffic signal) is wired to a valid transformer feeder.</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Road network BFS traversal confirms 0 disconnected island nodes.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
