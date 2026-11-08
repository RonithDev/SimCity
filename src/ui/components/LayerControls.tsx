import React from 'react';
import { Activity, Droplets, Eye, GraduationCap, Home, Navigation, Zap } from 'lucide-react';

export interface LayerVisibility {
  transport: boolean;
  healthcare: boolean;
  education: boolean;
  population: boolean;
  electricity: boolean;
  drainage: boolean;
}

interface LayerControlsProps {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
}

export const LayerControls: React.FC<LayerControlsProps> = ({ layers, onChange }) => {
  const toggle = (key: keyof LayerVisibility) => {
    onChange({ ...layers, [key]: !layers[key] });
  };

  const layerItems = [
    { key: 'transport' as const, label: 'Transport', icon: Navigation, color: 'text-cyan-400' },
    { key: 'healthcare' as const, label: 'Healthcare', icon: Activity, color: 'text-rose-400' },
    { key: 'education' as const, label: 'Schools', icon: GraduationCap, color: 'text-blue-400' },
    { key: 'population' as const, label: 'Population', icon: Home, color: 'text-purple-400' },
    { key: 'electricity' as const, label: 'Electricity', icon: Zap, color: 'text-amber-400' },
    { key: 'drainage' as const, label: 'Flood / Drain', icon: Droplets, color: 'text-blue-400' },
  ];

  return (
    <div className="glass-panel rounded-xl shadow-2xl px-3.5 py-2 border border-slate-700/70 flex items-center gap-2.5 text-xs select-none">
      <div className="flex items-center gap-1.5 text-slate-400 font-semibold pr-2 border-r border-slate-700/80">
        <Eye className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline text-[11px] uppercase tracking-wider font-bold">Layers</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {layerItems.map((item) => {
          const Icon = item.icon;
          const active = layers[item.key];
          return (
            <button
              key={item.key}
              onClick={() => toggle(item.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                active
                  ? 'bg-slate-700/90 text-white shadow-sm border border-slate-600'
                  : 'bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? item.color : 'text-slate-500'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
