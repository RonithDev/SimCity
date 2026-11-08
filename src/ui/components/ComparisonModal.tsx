import React from 'react';
import { MitigationSuggestion, SimulationKPI, SimulationResult } from '../../types/sim';
import { CheckCircle2, Lightbulb, TrendingDown, TrendingUp, X } from 'lucide-react';

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  baselineKpi: SimulationKPI;
  scenarioKpi: SimulationKPI;
  mitigations: MitigationSuggestion[];
  scenarioResult: SimulationResult;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({
  isOpen,
  onClose,
  baselineKpi,
  scenarioKpi,
  mitigations,
  scenarioResult,
}) => {
  if (!isOpen) return null;

  const rows = [
    {
      metric: 'Average Travel Time',
      baseline: `${baselineKpi.avgTravelTimeMinutes} min`,
      scenario: `${scenarioKpi.avgTravelTimeMinutes} min`,
      diff: scenarioKpi.avgTravelTimeMinutes - baselineKpi.avgTravelTimeMinutes,
      unit: 'm',
      lowerIsBetter: true,
    },
    {
      metric: 'Road Congestion (% v/c > 0.85)',
      baseline: `${baselineKpi.pctRoadsCongested}%`,
      scenario: `${scenarioKpi.pctRoadsCongested}%`,
      diff: scenarioKpi.pctRoadsCongested - baselineKpi.pctRoadsCongested,
      unit: '%',
      lowerIsBetter: true,
    },
    {
      metric: 'Average Emergency Response',
      baseline: `${baselineKpi.avgEmergencyResponseMinutes} min`,
      scenario: `${scenarioKpi.avgEmergencyResponseMinutes} min`,
      diff: scenarioKpi.avgEmergencyResponseMinutes - baselineKpi.avgEmergencyResponseMinutes,
      unit: 'm',
      lowerIsBetter: true,
    },
    {
      metric: 'Max Emergency Response Time',
      baseline: `${baselineKpi.maxEmergencyResponseMinutes} min`,
      scenario: `${scenarioKpi.maxEmergencyResponseMinutes} min`,
      diff: scenarioKpi.maxEmergencyResponseMinutes - baselineKpi.maxEmergencyResponseMinutes,
      unit: 'm',
      lowerIsBetter: true,
    },
    {
      metric: '10-Min Hospital Catchment',
      baseline: `${baselineKpi.pctPopulationWithin10MinHospital}%`,
      scenario: `${scenarioKpi.pctPopulationWithin10MinHospital}%`,
      diff: scenarioKpi.pctPopulationWithin10MinHospital - baselineKpi.pctPopulationWithin10MinHospital,
      unit: '%',
      lowerIsBetter: false,
    },
    {
      metric: 'Overloaded Hospitals Count',
      baseline: `${baselineKpi.overloadedHospitalsCount}`,
      scenario: `${scenarioKpi.overloadedHospitalsCount}`,
      diff: scenarioKpi.overloadedHospitalsCount - baselineKpi.overloadedHospitalsCount,
      unit: '',
      lowerIsBetter: true,
    },
    {
      metric: 'Public Transit Walk Coverage',
      baseline: `${baselineKpi.publicTransitCoveragePct}%`,
      scenario: `${scenarioKpi.publicTransitCoveragePct}%`,
      diff: scenarioKpi.publicTransitCoveragePct - baselineKpi.publicTransitCoveragePct,
      unit: '%',
      lowerIsBetter: false,
    },
    {
      metric: 'Electrical Grid Utilization',
      baseline: `${baselineKpi.powerGridLoadFactorPct}%`,
      scenario: `${scenarioKpi.powerGridLoadFactorPct}%`,
      diff: scenarioKpi.powerGridLoadFactorPct - baselineKpi.powerGridLoadFactorPct,
      unit: '%',
      lowerIsBetter: true,
    },
    {
      metric: 'Flood-Exposed Population',
      baseline: `${baselineKpi.floodExposedPopulation.toLocaleString()}`,
      scenario: `${scenarioKpi.floodExposedPopulation.toLocaleString()}`,
      diff: scenarioKpi.floodExposedPopulation - baselineKpi.floodExposedPopulation,
      unit: '',
      lowerIsBetter: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl border border-slate-700/80 flex flex-col overflow-hidden bg-slate-900/95">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Baseline vs Scenario Impact Analysis</span>
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-normal">
                SDG 11 Assessment
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparative quantitative performance metrics, cascade propagation deltas, and actionable mitigation heuristics.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs select-text">
          {/* Quick Disaster Status Badges if any */}
          {(scenarioResult.floodedRoadIds.length > 0 || scenarioResult.inundatedZoneIds.length > 0) && (
            <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-800/60 text-blue-200 flex items-center justify-between">
              <span>
                <strong>Flood Inundation Impact:</strong> {scenarioResult.floodedRoadIds.length} road links submerged · {scenarioResult.inundatedZoneIds.length} neighborhood sectors in flood basins.
              </span>
            </div>
          )}

          {/* KPI Comparison Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Urban System KPI Deltas
            </h3>
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">SDG 11 Indicator</th>
                    <th className="py-2.5 px-3">Baseline</th>
                    <th className="py-2.5 px-3">Scenario</th>
                    <th className="py-2.5 px-3">Delta Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono">
                  {rows.map((row, idx) => {
                    const isWorse = row.lowerIsBetter ? row.diff > 0.05 : row.diff < -0.05;
                    const isBetter = row.lowerIsBetter ? row.diff < -0.05 : row.diff > 0.05;

                    return (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-3 font-sans font-medium text-slate-200">
                          {row.metric}
                        </td>
                        <td className="py-2 px-3 text-slate-400">{row.baseline}</td>
                        <td className="py-2 px-3 text-slate-100 font-bold">{row.scenario}</td>
                        <td className="py-2 px-3">
                          {Math.abs(row.diff) < 0.01 ? (
                            <span className="text-slate-500 font-sans text-[11px]">Unchanged</span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                isWorse
                                  ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                                  : isBetter
                                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                                  : 'text-slate-400'
                              }`}
                            >
                              {isWorse ? (
                                <TrendingDown className="w-3 h-3" />
                              ) : (
                                <TrendingUp className="w-3 h-3" />
                              )}
                              <span>
                                {row.diff > 0 ? '+' : ''}
                                {row.diff.toFixed(1)}
                                {row.unit}
                              </span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actionable Mitigation Suggestions */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span>Recommended Urban Resilience Interventions (Rule-Based)</span>
            </h3>
            <div className="space-y-2">
              {mitigations.map((mit) => (
                <div
                  key={mit.id}
                  className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex items-start gap-3"
                >
                  <div
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      mit.priority === 'High'
                        ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                        : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                    }`}
                  >
                    {mit.priority} Priority
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="font-bold text-slate-100 text-xs flex items-center gap-2">
                      <span>{mit.title}</span>
                      <span className="text-[10px] font-mono text-cyan-400 font-normal">
                        [{mit.category}]
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {mit.description}
                    </p>
                    <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>Impact: {mit.estimatedImpact}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors"
          >
            Close Overview
          </button>
        </div>
      </div>
    </div>
  );
};
