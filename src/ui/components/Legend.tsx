import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';

export const Legend: React.FC = () => {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="glass-panel rounded-lg shadow-xl text-xs overflow-hidden border border-slate-700/60 max-w-xs transition-all duration-200">
      <div
        className="flex items-center justify-between px-3 py-2 bg-slate-800/80 cursor-pointer hover:bg-slate-800"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Map Legend</span>
        </div>
        <button className="text-slate-400 hover:text-slate-200">
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-3 bg-slate-900/90 text-slate-300">
          {/* Status Indicators */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Component Status
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                <span>Healthy</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-500/20" />
                <span>Overloaded</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-dashed border-rose-300" />
                <span>Damaged</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-rose-600 text-[8px] flex items-center justify-center font-bold text-rose-400">
                  ✕
                </span>
                <span>Failed</span>
              </div>
            </div>
          </div>

          {/* Road Congestion */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Road Congestion (v/c)
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-1 bg-emerald-400 rounded" />
                  <span>Free Flow (&lt; 0.75)</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-1 bg-amber-400 rounded" />
                  <span>Moderate (0.75 - 0.99)</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-1.5 bg-rose-500 rounded" />
                  <span>Gridlock / Overloaded (&ge; 1.0)</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-1.5 bg-slate-600 border-t border-b border-rose-500/50" />
                  <span>Closed / Impassable</span>
                </div>
              </div>
            </div>
          </div>

          {/* Infrastructure Symbols */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Infrastructure Nodes
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-rose-950 border border-rose-500 flex items-center justify-center font-bold text-[9px] text-rose-300">
                  +
                </div>
                <span>Hospital</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-blue-950 border border-blue-500 flex items-center justify-center font-bold text-[9px] text-blue-300">
                  S
                </div>
                <span>School</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-amber-950 border border-amber-500 flex items-center justify-center font-bold text-[9px] text-amber-300">
                  ⚡
                </div>
                <span>Substation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-yellow-950 border border-yellow-500 flex items-center justify-center font-bold text-[9px] text-yellow-300">
                  T
                </div>
                <span>Transformer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-cyan-950 border border-cyan-500 flex items-center justify-center font-bold text-[9px] text-cyan-300">
                  💧
                </div>
                <span>Drainage</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-indigo-950 border border-indigo-400 flex items-center justify-center font-bold text-[9px] text-indigo-300">
                  🚌
                </div>
                <span>Bus Stop</span>
              </div>
            </div>
          </div>

          {/* Residential Density */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Residential Density
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500/80" />
                <span>High</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500/80" />
                <span>Med</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span>Low</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
