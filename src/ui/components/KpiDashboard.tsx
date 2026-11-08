import React, { useState } from 'react';
import { SimulationKPI } from '../../types/sim';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock,
  Droplets,
  Navigation,
  ShieldAlert,
  Users,
  Zap,
} from 'lucide-react';

interface KpiDashboardProps {
  currentKpi: SimulationKPI;
  baselineKpi?: SimulationKPI;
  isScenario: boolean;
}

export const KpiDashboard: React.FC<KpiDashboardProps> = ({
  currentKpi,
  baselineKpi,
  isScenario,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const renderDelta = (
    current: number,
    baseline: number,
    lowerIsBetter: boolean = true,
    unit: string = '',
    decimals: number = 1
  ) => {
    if (!isScenario || baseline === undefined) return null;
    const diff = current - baseline;
    if (Math.abs(diff) < 0.01) {
      return null;
    }

    const isWorse = lowerIsBetter ? diff > 0 : diff < 0;
    const sign = diff > 0 ? '+' : '';
    const color = isWorse
      ? 'text-rose-400 bg-rose-950/60 border-rose-800/60'
      : 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';

    return (
      <span className={`text-[9px] px-1 py-0.2 rounded border font-mono ${color}`}>
        {sign}{diff.toFixed(decimals)}{unit}
      </span>
    );
  };

  const allKpis = [
    {
      label: 'Avg Travel Time',
      value: `${currentKpi.avgTravelTimeMinutes}m`,
      icon: Clock,
      color: 'text-cyan-400',
      delta: baselineKpi
        ? renderDelta(currentKpi.avgTravelTimeMinutes, baselineKpi.avgTravelTimeMinutes, true, 'm')
        : null,
      desc: 'BPR delay',
      priority: true,
    },
    {
      label: 'Congestion',
      value: `${currentKpi.pctRoadsCongested}%`,
      icon: Navigation,
      color: currentKpi.pctRoadsCongested > 30 ? 'text-rose-400' : 'text-amber-400',
      delta: baselineKpi
        ? renderDelta(currentKpi.pctRoadsCongested, baselineKpi.pctRoadsCongested, true, '%')
        : null,
      desc: 'v/c > 0.85',
      priority: true,
    },
    {
      label: 'Emergency Response',
      value: `${currentKpi.avgEmergencyResponseMinutes}m`,
      subValue: `Max: ${currentKpi.maxEmergencyResponseMinutes}m`,
      icon: Activity,
      color:
        currentKpi.avgEmergencyResponseMinutes > 10 ? 'text-rose-400' : 'text-emerald-400',
      delta: baselineKpi
        ? renderDelta(
            currentKpi.avgEmergencyResponseMinutes,
            baselineKpi.avgEmergencyResponseMinutes,
            true,
            'm'
          )
        : null,
      desc: 'Hospital reach',
      priority: true,
    },
    {
      label: '10-Min Hospital Catchment',
      value: `${currentKpi.pctPopulationWithin10MinHospital}%`,
      icon: Users,
      color:
        currentKpi.pctPopulationWithin10MinHospital < 75 ? 'text-amber-400' : 'text-emerald-400',
      delta: baselineKpi
        ? renderDelta(
            currentKpi.pctPopulationWithin10MinHospital,
            baselineKpi.pctPopulationWithin10MinHospital,
            false,
            '%'
          )
        : null,
      desc: 'Golden hour',
      priority: false,
    },
    {
      label: 'Hospital Overload',
      value: `${currentKpi.overloadedHospitalsCount}`,
      icon: ShieldAlert,
      color:
        currentKpi.overloadedHospitalsCount > 0 ? 'text-rose-400' : 'text-emerald-400',
      delta: baselineKpi
        ? renderDelta(
            currentKpi.overloadedHospitalsCount,
            baselineKpi.overloadedHospitalsCount,
            true,
            '',
            0
          )
        : null,
      desc: 'Over capacity',
      priority: false,
    },
    {
      label: 'Transit Coverage',
      value: `${currentKpi.publicTransitCoveragePct}%`,
      icon: Navigation,
      color: 'text-indigo-400',
      delta: baselineKpi
        ? renderDelta(
            currentKpi.publicTransitCoveragePct,
            baselineKpi.publicTransitCoveragePct,
            false,
            '%'
          )
        : null,
      desc: '<450m walk',
      priority: false,
    },
    {
      label: 'Power Grid Load',
      value: `${currentKpi.powerGridLoadFactorPct}%`,
      icon: Zap,
      color:
        currentKpi.powerGridLoadFactorPct > 85 ? 'text-amber-400' : 'text-emerald-400',
      delta: baselineKpi
        ? renderDelta(
            currentKpi.powerGridLoadFactorPct,
            baselineKpi.powerGridLoadFactorPct,
            true,
            '%'
          )
        : null,
      desc: 'Grid balance',
      priority: true,
    },
    {
      label: 'Flood Population',
      value: currentKpi.floodExposedPopulation.toLocaleString(),
      icon: Droplets,
      color:
        currentKpi.floodExposedPopulation > 0 ? 'text-rose-400' : 'text-cyan-400',
      delta: baselineKpi
        ? renderDelta(
            currentKpi.floodExposedPopulation,
            baselineKpi.floodExposedPopulation,
            true,
            '',
            0
          )
        : null,
      desc: 'Inundated',
      priority: true,
    },
  ];

  return (
    <div className="w-full glass-panel border-b border-slate-800/80 px-4 py-2 shadow-sm text-xs select-none">
      <div className="flex items-center justify-between gap-3">
        {/* KPI Strip */}
        <div className="flex-1 flex items-center gap-2.5 overflow-x-auto no-scrollbar">
          {(isExpanded ? allKpis : allKpis.filter((k) => k.priority)).map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                className="bg-slate-900/80 border border-slate-800/90 rounded-lg px-2.5 py-1 flex items-center gap-2 shrink-0 hover:border-slate-700 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${kpi.color} shrink-0`} />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    {kpi.label}:
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono font-bold text-slate-100 text-[11px]">
                  <span>{kpi.value}</span>
                  {kpi.delta}
                </div>
              </div>
            );
          })}
        </div>

        {/* Expand / Collapse Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-slate-700/60 shrink-0 transition-colors"
          title={isExpanded ? 'Collapse to Key Metrics' : 'Expand All 8 Indicators'}
        >
          <span>{isExpanded ? 'Compact' : '+3 Metrics'}</span>
          {isExpanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      </div>
    </div>
  );
};
