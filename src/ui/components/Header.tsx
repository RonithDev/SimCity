import React, { useState } from 'react';
import { ValidationReport } from '../../types/graph';
import { CheckCircle2, Columns3, Dices, Layers, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  seed: number;
  size: 'small' | 'medium' | 'large';
  onGenerate: (seed: number, size: 'small' | 'medium' | 'large') => void;
  validationReport: ValidationReport;
  onOpenValidationModal: () => void;
  onOpenComparisonModal: () => void;
  isScenario: boolean;
  interventionCount: number;
  onResetBaseline?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  seed,
  size,
  onGenerate,
  validationReport,
  onOpenValidationModal,
  onOpenComparisonModal,
  isScenario,
  interventionCount,
  onResetBaseline,
}) => {
  const [inputSeed, setInputSeed] = useState<string>(seed.toString());
  const [selectedSize, setSelectedSize] = useState<'small' | 'medium' | 'large'>(size);

  const handleRandomize = () => {
    const newSeed = Math.floor(Math.random() * 900000) + 100000;
    setInputSeed(newSeed.toString());
    onGenerate(newSeed, selectedSize);
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(inputSeed) || 42891;
    onGenerate(parsed, selectedSize);
  };

  return (
    <header className="w-full glass-panel border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-4 z-40 select-none">
      {/* Title & Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-950/50">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-100 tracking-tight">
              Sustainable Neighbourhoods
            </h1>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80 font-semibold uppercase tracking-wider">
              SDG 11
            </span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-2">
            <span>Synthetic Urban Digital Twin</span>
            <span className="text-slate-600">•</span>
            <span>Heterogeneous Multi-Layer Graph</span>
          </div>
        </div>
      </div>

      {/* Generator Controls */}
      <form onSubmit={handleGenerate} className="flex items-center gap-3 text-xs">
        {/* Seed Input */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-1.5 shadow-inner">
          <span className="text-slate-400 font-mono text-xs">Seed:</span>
          <input
            type="number"
            value={inputSeed}
            onChange={(e) => setInputSeed(e.target.value)}
            className="w-20 bg-transparent text-slate-100 font-mono text-xs focus:outline-none"
          />
          <button
            type="button"
            onClick={handleRandomize}
            className="p-1 text-slate-400 hover:text-cyan-400 transition-colors"
            title="Random Seed"
          >
            <Dices className="w-4 h-4" />
          </button>
        </div>

        {/* Size Selector */}
        <select
          value={selectedSize}
          onChange={(e) => {
            const newSize = e.target.value as 'small' | 'medium' | 'large';
            setSelectedSize(newSize);
            onGenerate(parseInt(inputSeed) || seed, newSize);
          }}
          className="bg-slate-900/90 border border-slate-700/80 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none shadow-sm cursor-pointer"
        >
          <option value="small">Small (~25 junctions)</option>
          <option value="medium">Medium (~49 junctions)</option>
          <option value="large">Large (~81 junctions)</option>
        </select>

        {/* Generate Button */}
        <button
          type="submit"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Generate City</span>
        </button>
      </form>

      {/* Status Badges & Scenario Actions */}
      <div className="flex items-center gap-2">
        {/* Validation Status Badge */}
        <button
          onClick={onOpenValidationModal}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
            validationReport.isValid
              ? 'bg-emerald-950/50 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/50'
              : 'bg-rose-950/50 border-rose-800/80 text-rose-300 hover:bg-rose-900/50'
          }`}
          title="Click to view full graph validation audit"
        >
          {validationReport.isValid ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          )}
          <span>{validationReport.isValid ? 'Graph Valid' : 'Graph Issues'}</span>
        </button>

        {/* Revert to Baseline Button */}
        {isScenario && onResetBaseline && (
          <button
            onClick={onResetBaseline}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold bg-rose-950/80 hover:bg-rose-900 border border-rose-600/80 text-rose-200 transition-all cursor-pointer shadow-sm"
            title="Revert all changes and restore pristine baseline city"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>Revert to Baseline</span>
          </button>
        )}

        {/* Comparison Modal Button */}
        <button
          onClick={onOpenComparisonModal}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium border transition-all ${
            isScenario
              ? 'bg-gradient-to-r from-purple-900/80 to-blue-900/80 border-purple-600 text-white shadow-md'
              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
        >
          <Columns3 className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            {isScenario ? `Compare Scenario (${interventionCount})` : 'Compare Baseline'}
          </span>
        </button>
      </div>
    </header>
  );
};
