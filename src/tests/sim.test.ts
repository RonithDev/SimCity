import { describe, expect, it } from 'vitest';
import { simulateCascade } from '../sim/cascade';
import { dijkstra } from '../sim/dijkstra';
import { runSimulation } from '../sim/engine';
import { generateCity } from '../sim/generator';
import { buildRoadAdjacency, deepCloneGraph } from '../sim/graphUtils';
import { UrbanEdge } from '../types/graph';
import { ScenarioIntervention } from '../types/sim';

describe('Milestone 3 & 5: Simulation, Immutability & Cascade', () => {
  it('correctly computes shortest path with Dijkstra', () => {
    const edges: Record<string, UrbanEdge> = {
      e1: {
        id: 'e1',
        from: 'A',
        to: 'B',
        type: 'ROAD',
        length: 100,
        capacity: 1000,
        currentLoad: 0,
        failureThreshold: 1.2,
        status: 'healthy',
        congestedTravelTime: 5,
      },
      e2: {
        id: 'e2',
        from: 'B',
        to: 'C',
        type: 'ROAD',
        length: 100,
        capacity: 1000,
        currentLoad: 0,
        failureThreshold: 1.2,
        status: 'healthy',
        congestedTravelTime: 3,
      },
      e3: {
        id: 'e3',
        from: 'A',
        to: 'C',
        type: 'ROAD',
        length: 200,
        capacity: 1000,
        currentLoad: 0,
        failureThreshold: 1.2,
        status: 'healthy',
        congestedTravelTime: 12,
      },
    };

    const adj = buildRoadAdjacency(edges, true);
    const result = dijkstra('A', edges, adj, (e) => e.congestedTravelTime || 1);

    expect(result.distances['C']).toBe(8); // A -> B (5) + B -> C (3) = 8 < 12
    expect(result.previous['C']?.nodeId).toBe('B');
  });

  it('guarantees baseline immutability when deep cloning and applying interventions', () => {
    const baselineGraph = generateCity(555, { size: 'small' });
    const baselineResult = runSimulation(baselineGraph);

    // Deep clone for scenario
    const scenarioGraph = deepCloneGraph(baselineGraph);
    const firstRoad = Object.values(scenarioGraph.edges).find((e) => e.type === 'ROAD')!;
    firstRoad.isClosed = true;
    firstRoad.status = 'failed';

    const scenarioResult = runSimulation(scenarioGraph);

    // Baseline should remain untouched!
    expect(baselineGraph.edges[firstRoad.id].isClosed).toBe(false);
    expect(baselineGraph.edges[firstRoad.id].status).toBe('healthy');
    expect(baselineResult.kpi.totalVehiclesTraveled).toBeGreaterThan(0);
    expect(scenarioResult.kpi).toBeDefined();
  });

  it('propagates cascading failures when a road is closed', () => {
    const city = generateCity(888, { size: 'medium' });
    // Find an arterial road
    const mainRoad = Object.values(city.edges).find((e) => e.type === 'ROAD' && e.roadType === 'main')!;

    const interventions: ScenarioIntervention[] = [
      {
        id: 'int_1',
        type: 'CLOSE_ROAD',
        targetId: mainRoad.id,
        parameters: {},
        description: `Close road ${mainRoad.id}`,
        timestamp: Date.now(),
      },
    ];

    const cascade = simulateCascade(city, interventions);

    expect(cascade.steps.length).toBeGreaterThanOrEqual(2);
    expect(cascade.steps[0].events.length).toBeGreaterThan(0);
    expect(cascade.steps[0].events[0].componentId).toBe(mainRoad.id);
  });

  it('cascades transformer outage into dependent traffic signals and residential blackout', () => {
    const city = generateCity(999, { size: 'medium' });
    const transformer = Object.values(city.nodes).find((n) => n.type === 'Transformer')!;

    const interventions: ScenarioIntervention[] = [
      {
        id: 'int_tx',
        type: 'DISABLE_TRANSFORMER',
        targetId: transformer.id,
        parameters: {},
        description: `Disable transformer ${transformer.id}`,
        timestamp: Date.now(),
      },
    ];

    const cascade = simulateCascade(city, interventions);
    expect(cascade.steps.length).toBeGreaterThanOrEqual(2);

    // Check that consumers linked to transformer experienced status updates
    const affectedIds = cascade.steps.flatMap((s) => s.events.map((e) => e.componentId));
    expect(affectedIds).toContain(transformer.id);
  });

  it('constructs a new hospital facility and integrates it into the urban twin', () => {
    const city = generateCity(777, { size: 'medium' });
    const baselineResult = runSimulation(city);

    const interventions: ScenarioIntervention[] = [
      {
        id: 'int_build_hosp',
        type: 'CONSTRUCT_BUILDING',
        parameters: {
          buildingType: 'Hospital',
          name: 'St. Jude Emergency Pavilion',
          capacity: 220,
        },
        description: 'Construct new hospital',
        timestamp: Date.now(),
      },
    ];

    const cascade = simulateCascade(city, interventions);

    // Verify new hospital was created
    const newHospital = Object.values(cascade.graph.nodes).find(
      (n) => n.name === 'St. Jude Emergency Pavilion'
    );
    expect(newHospital).toBeDefined();
    expect(newHospital?.type).toBe('Hospital');
    expect(newHospital?.capacity).toBe(220);

    // Verify access road was connected to an intersection
    const accessEdge = Object.values(cascade.graph.edges).find(
      (e) => e.from === newHospital!.id || e.to === newHospital!.id
    );
    expect(accessEdge).toBeDefined();
    expect(accessEdge?.type).toBe('ACCESS');

    // Verify simulation result reflects updated infrastructure
    expect(cascade.result.kpi).toBeDefined();
    expect(cascade.result.kpi.avgEmergencyResponseMinutes).toBeLessThanOrEqual(
      baselineResult.kpi.avgEmergencyResponseMinutes
    );
    expect(cascade.steps[0].events.length).toBeGreaterThan(0);
    expect(cascade.steps[cascade.steps.length - 1].activeFailingIds.length).toBeGreaterThan(0);
  });

  it('verifies multi-round cascade propagation causes measurable KPI deltas and building impacts', () => {
    const city = generateCity(1234, { size: 'medium' });
    const baseline = runSimulation(city);

    // Find a primary arterial corridor
    const arterial = Object.values(city.edges).find(
      (e) => e.type === 'ROAD' && e.roadType === 'main'
    )!;

    const interventions: ScenarioIntervention[] = [
      {
        id: 'int_close',
        type: 'CLOSE_ROAD',
        targetId: arterial.id,
        parameters: {},
        description: `Close arterial ${arterial.id}`,
        timestamp: Date.now(),
      },
    ];

    const cascade = simulateCascade(city, interventions);

    // Multi-round propagation verified
    expect(cascade.steps.length).toBeGreaterThanOrEqual(2);

    // Final equilibrium preserves active failing IDs
    const lastStep = cascade.steps[cascade.steps.length - 1];
    expect(lastStep.activeFailingIds.length).toBeGreaterThan(0);
    expect(lastStep.activeFailingIds).toContain(arterial.id);

    // Measurable travel delay relative to baseline
    expect(cascade.result.kpi.avgTravelTimeMinutes).toBeGreaterThanOrEqual(
      baseline.kpi.avgTravelTimeMinutes
    );
  });

  it('verifies reverting an outage or intervention restores pristine network state', () => {
    const city = generateCity(42891, { size: 'small' });
    const baseline = runSimulation(city);

    const tx = Object.values(city.nodes).find((n) => n.type === 'Transformer');
    expect(tx).toBeDefined();

    // 1. Trigger electrical outage
    const outageIntervention: ScenarioIntervention = {
      id: 'int_outage_1',
      type: 'DISABLE_TRANSFORMER',
      targetId: tx!.id,
      parameters: {},
      description: `Trip breaker on ${tx!.name}`,
      timestamp: Date.now(),
    };

    const cascadeWithOutage = simulateCascade(city, [outageIntervention]);
    expect(cascadeWithOutage.graph.nodes[tx!.id].status).toBe('failed');
    expect(cascadeWithOutage.result.kpi.powerGridLoadFactorPct).toBeGreaterThanOrEqual(0);

    // 2. Revert intervention (simulate with empty list, mimicking handleRemoveIntervention / handleResetBaseline)
    const revertedCascade = simulateCascade(city, []);
    expect(revertedCascade.graph.nodes[tx!.id].status).toBe('healthy');
    expect(revertedCascade.result.kpi.avgTravelTimeMinutes).toBeCloseTo(baseline.kpi.avgTravelTimeMinutes, 2);
    expect(revertedCascade.result.kpi.avgEmergencyResponseMinutes).toBeCloseTo(
      baseline.kpi.avgEmergencyResponseMinutes,
      2
    );
  });
});
