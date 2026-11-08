import { GraphData, HospitalNode, TransformerNode, UrbanEdge } from '../types/graph';
import { MitigationSuggestion, SimulationKPI, SimulationResult } from '../types/sim';

/**
 * Generates rule-based mitigation recommendations from scenario simulation results
 */
export function generateMitigations(
  graph: GraphData,
  result: SimulationResult,
  baselineKpi?: SimulationKPI
): MitigationSuggestion[] {
  const suggestions: MitigationSuggestion[] = [];
  let idCounter = 1;

  // 1. Mobility / Congestion bottlenecks
  if (result.kpi.pctRoadsCongested > 25 || (baselineKpi && result.kpi.pctRoadsCongested > baselineKpi.pctRoadsCongested + 10)) {
    // Find top overloaded road
    let maxOverloadedRoad: UrbanEdge | null = null;
    let maxRatio = 0;

    for (const edge of Object.values(graph.edges)) {
      if (edge.type === 'ROAD') {
        const ratio = result.roadCongestionRatios[edge.id] || 0;
        if (ratio > maxRatio) {
          maxRatio = ratio;
          maxOverloadedRoad = edge;
        }
      }
    }

    if (maxOverloadedRoad) {
      suggestions.push({
        id: `mit_${idCounter++}`,
        category: 'Transport',
        title: `Widen Corridor or Re-time Signals on Road ${maxOverloadedRoad.id}`,
        description: `Corridor is operating at ${(maxRatio * 100).toFixed(0)}% capacity. Implement dynamic signal timing offsets or expand to 4 lanes to absorb diverted vehicular flow.`,
        priority: 'High',
        targetComponentId: maxOverloadedRoad.id,
        estimatedImpact: `Reduces network congestion by approx ~8-15% and cuts delay.`,
      });
    }
  }

  // 2. Healthcare access & overloaded hospitals
  const overloadedHospitals = Object.values(graph.nodes).filter(
    (n): n is HospitalNode => n.type === 'Hospital' && (result.hospitalAllocations[n.id]?.loadRatio || 0) > 1.0
  );

  for (const hosp of overloadedHospitals) {
    const alloc = result.hospitalAllocations[hosp.id];
    suggestions.push({
      id: `mit_${idCounter++}`,
      category: 'Healthcare',
      title: `Deploy Surge Medical Unit near ${hosp.name}`,
      description: `Hospital is overwhelmed by ${alloc.overflow} surplus patients (${(alloc.loadRatio * 100).toFixed(0)}% capacity). Deploy temporary triage field tents or activate mutual aid patient transfer protocols.`,
      priority: 'High',
      targetComponentId: hosp.id,
      estimatedImpact: `Relieves ${alloc.overflow} patient backlog and restores emergency intake.`,
    });
  }

  if (result.kpi.pctPopulationWithin10MinHospital < 60) {
    suggestions.push({
      id: `mit_${idCounter++}`,
      category: 'Healthcare',
      title: 'Establish Peripheral Urgent Care Station',
      description: `Only ${result.kpi.pctPopulationWithin10MinHospital}% of citizens can reach acute care within the critical 10-minute golden hour window. Station standby ambulances at fringe intersections.`,
      priority: 'Medium',
      estimatedImpact: `Increases 10-minute coverage by an estimated +18%.`,
    });
  }

  // 3. Electrical grid vulnerability
  const failedTransformers = Object.values(graph.nodes).filter(
    (n): n is TransformerNode => n.type === 'Transformer' && n.status === 'failed'
  );

  for (const tx of failedTransformers) {
    suggestions.push({
      id: `mit_${idCounter++}`,
      category: 'Power',
      title: `Install Dual-Feeder Automatic Transfer Switch for ${tx.name}`,
      description: `Failure of ${tx.name} cascaded into ${tx.servicedConsumerIds.length} downstream assets. Implementing N-1 electrical redundancy or battery microgrid prevents complete blackout.`,
      priority: 'High',
      targetComponentId: tx.id,
      estimatedImpact: `Restores power to essential traffic signals and emergency clinics.`,
    });
  }

  // 4. Stormwater and Flood Mitigation
  if (result.floodedRoadIds.length > 0) {
    suggestions.push({
      id: `mit_${idCounter++}`,
      category: 'Flood',
      title: `Expand Stormwater Retention & Pumping along Low Basin`,
      description: `${result.floodedRoadIds.length} road links are submerged under floodwaters, severing access for ${result.kpi.floodExposedPopulation.toLocaleString()} residents. Upsize stormwater retention culverts by +1,500 L/s.`,
      priority: 'High',
      targetComponentId: result.floodedRoadIds[0],
      estimatedImpact: `Eliminates standing water on critical access arterials during intense downpours.`,
    });
  }

  // Fallback suggestion if everything is healthy
  if (suggestions.length === 0) {
    suggestions.push({
      id: `mit_${idCounter++}`,
      category: 'Transport',
      title: 'Maintain Active Infrastructure Monitoring',
      description: 'Current urban network is operating within nominal safety margins across transport, energy, healthcare, and drainage.',
      priority: 'Low',
      estimatedImpact: 'Maintains optimal SDG 11 neighborhood resilience index.',
    });
  }

  return suggestions;
}
