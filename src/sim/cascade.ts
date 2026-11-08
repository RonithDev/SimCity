import {
  DrainageNode,
  GraphData,
  HospitalNode,
  IntersectionNode,
  ResidentialZoneNode,
  SchoolNode,
  TransformerNode,
  UrbanEdge,
} from '../types/graph';
import {
  CascadeEvent,
  CascadeStep,
  ScenarioIntervention,
  SimulationResult,
} from '../types/sim';
import { runSimulation } from './engine';
import { deepCloneGraph, distance } from './graphUtils';

/**
 * Propagates rule-based cascading failures and policy interventions round by round.
 * Captures an exact graph snapshot and textual narrative insight at each step
 * so that playing the cascade visibly updates the map and telemetry step-by-step.
 */
export function simulateCascade(
  initialGraph: GraphData,
  interventions: ScenarioIntervention[],
  maxRounds: number = 6
): { graph: GraphData; steps: CascadeStep[]; result: SimulationResult } {
  const graph = deepCloneGraph(initialGraph);
  const steps: CascadeStep[] = [];
  let globalStepCounter = 1;
  const cumulativeFailingIds = new Set<string>();

  // Baseline initial simulation for relative comparisons
  const baselineResult = runSimulation(initialGraph);

  // Step 0: Apply initial intervention(s)
  const initialEvents: CascadeEvent[] = [];
  const initialActiveIds: string[] = [];
  const interventionSummaries: string[] = [];

  for (const intervention of interventions) {
    if (intervention.type === 'CLOSE_ROAD' && intervention.targetId) {
      const road = graph.edges[intervention.targetId];
      if (road) {
        const prev = road.status;
        road.status = 'failed';
        road.isClosed = true;
        initialActiveIds.push(road.id);
        cumulativeFailingIds.add(road.id);
        interventionSummaries.push(
          `Arterial corridor ${road.id} was closed (${road.capacity} veh/h capacity severed)`
        );
        initialEvents.push({
          id: `evt_${globalStepCounter++}`,
          step: 0,
          round: 0,
          componentId: road.id,
          componentType: 'ROAD',
          componentName: `Road ${road.id} (${road.roadType?.toUpperCase()})`,
          previousStatus: prev,
          newStatus: 'failed',
          reason: `Physical closure applied on ${road.roadType} corridor.`,
        });
      }
    } else if (intervention.type === 'DISABLE_TRANSFORMER' && intervention.targetId) {
      const tx = graph.nodes[intervention.targetId] as TransformerNode;
      if (tx) {
        const prev = tx.status;
        tx.status = 'failed';
        initialActiveIds.push(tx.id);
        cumulativeFailingIds.add(tx.id);
        interventionSummaries.push(
          `Transformer ${tx.name} breaker tripped (${tx.servicedConsumerIds.length} downstream assets de-energized)`
        );
        initialEvents.push({
          id: `evt_${globalStepCounter++}`,
          step: 0,
          round: 0,
          componentId: tx.id,
          componentType: 'Transformer',
          componentName: tx.name,
          previousStatus: prev,
          newStatus: 'failed',
          reason: `Electrical substation breaker tripped; transformer forced offline.`,
        });
      }
    } else if (intervention.type === 'SURGE_HOSPITAL_DEMAND' && intervention.targetId) {
      const hosp = graph.nodes[intervention.targetId] as HospitalNode;
      if (hosp) {
        const factor = intervention.parameters.demandMultiplier || 2.0;
        const prev = hosp.status;
        hosp.currentLoad = Math.round(hosp.capacity * factor);
        hosp.status = 'overloaded';
        initialActiveIds.push(hosp.id);
        cumulativeFailingIds.add(hosp.id);
        interventionSummaries.push(
          `Patient demand surged to ${factor}x (${hosp.currentLoad} patients) at ${hosp.name}`
        );
        initialEvents.push({
          id: `evt_${globalStepCounter++}`,
          step: 0,
          round: 0,
          componentId: hosp.id,
          componentType: 'Hospital',
          componentName: hosp.name,
          previousStatus: prev,
          newStatus: 'overloaded',
          metricValue: hosp.currentLoad,
          thresholdValue: hosp.capacity,
          reason: `Mass casualty surge: demand surged to ${hosp.currentLoad} patients (${factor}x capacity of ${hosp.capacity}).`,
        });
      }
    } else if (intervention.type === 'SET_RAINFALL') {
      const rainfall = intervention.parameters.rainfallIntensityMmPerHour || 60;
      graph.config.rainfallIntensityMmPerHour = rainfall;
      interventionSummaries.push(
        `Precipitation elevated to ${rainfall} mm/h across urban stormwater catchments`
      );
      initialEvents.push({
        id: `evt_${globalStepCounter++}`,
        step: 0,
        round: 0,
        componentId: 'climate-system',
        componentType: 'FloodZone',
        componentName: `Stormwater Event`,
        previousStatus: 'healthy',
        newStatus: 'damaged',
        reason: `Severe precipitation of ${rainfall} mm/h applied across catchment.`,
      });
    } else if (intervention.type === 'CONSTRUCT_BUILDING') {
      // Construction of a new facility
      const params = intervention.parameters || {};
      const buildingType = params.buildingType || 'Hospital';
      const buildingName = params.name || `New ${buildingType}`;
      const capacity = params.capacity || (buildingType === 'Hospital' ? 180 : buildingType === 'School' ? 800 : 2200);

      // Find suitable parcel
      const parcels = graph.parcels || [];
      const chosenParcel = params.parcelId
        ? parcels.find((p) => p.id === params.parcelId) || parcels[0]
        : parcels.find((p) => p.parcelType === 'open' || p.parcelType === 'residential') || parcels[0];

      const pos = params.position
        ? { x: Math.round(params.position.x), y: Math.round(params.position.y) }
        : chosenParcel
        ? { x: chosenParcel.cx, y: chosenParcel.cy }
        : { x: graph.bounds.width * 0.45, y: graph.bounds.height * 0.45 };

      // Find closest road intersection
      const intersections = Object.values(graph.nodes).filter(
        (n): n is IntersectionNode => n.type === 'Intersection'
      );
      let nearestInter = intersections[0];
      let minInterDist = Infinity;
      for (const inter of intersections) {
        const d = distance(pos, inter.position);
        if (d < minInterDist) {
          minInterDist = d;
          nearestInter = inter;
        }
      }

      // Find closest transformer
      const transformers = Object.values(graph.nodes).filter(
        (n): n is TransformerNode => n.type === 'Transformer'
      );
      let nearestTx = transformers[0];
      let minTxDist = Infinity;
      for (const tx of transformers) {
        const d = distance(pos, tx.position);
        if (d < minTxDist) {
          minTxDist = d;
          nearestTx = tx;
        }
      }

      const newId = `new_${buildingType.toLowerCase()}_${Date.now()}`;
      initialActiveIds.push(newId);
      cumulativeFailingIds.add(newId); // Keep active highlight

      if (buildingType === 'Hospital') {
        const newHospital: HospitalNode = {
          id: newId,
          type: 'Hospital',
          name: buildingName,
          position: pos,
          capacity: capacity,
          currentLoad: Math.round(capacity * 0.4),
          failureThreshold: 1.05,
          status: 'healthy',
          dependencies: nearestTx ? [nearestTx.id] : [],
          tier: capacity >= 200 ? 'Tertiary' : 'Secondary',
          beds: capacity,
          emergencyDemand: Math.round(capacity * 0.4),
          hasBackupGenerator: true,
          nearestIntersectionId: nearestInter?.id || 'inter_1',
          backup: {
            type: 'generator',
            capacity: 250,
            durationHours: 16,
            active: false,
            fuelRemaining: 100,
          },
        };
        graph.nodes[newId] = newHospital;
        interventionSummaries.push(
          `Constructed ${buildingName} (+${capacity} beds) at Block ${chosenParcel?.id || 'BLK-NEW'}`
        );
      } else if (buildingType === 'School') {
        const newSchool: SchoolNode = {
          id: newId,
          type: 'School',
          name: buildingName,
          position: pos,
          capacity: capacity,
          currentLoad: Math.round(capacity * 0.7),
          failureThreshold: 1.15,
          status: 'healthy',
          dependencies: nearestTx ? [nearestTx.id] : [],
          schoolType: capacity >= 1000 ? 'High School' : 'Elementary',
          studentCapacity: capacity,
          nearestIntersectionId: nearestInter?.id || 'inter_1',
        };
        graph.nodes[newId] = newSchool;
        interventionSummaries.push(
          `Constructed ${buildingName} (+${capacity} enrollment capacity) at Block ${chosenParcel?.id || 'BLK-NEW'}`
        );
      } else if (buildingType === 'ResidentialZone') {
        const newZone: ResidentialZoneNode = {
          id: newId,
          type: 'ResidentialZone',
          name: buildingName,
          position: pos,
          capacity: Math.round(capacity * 1.2),
          currentLoad: capacity,
          failureThreshold: 1.15,
          status: 'healthy',
          dependencies: nearestTx ? [nearestTx.id] : [],
          population: capacity,
          density: capacity > 2500 ? 'high' : capacity > 1200 ? 'medium' : 'low',
          radius: 28,
          elevation: nearestInter?.elevation || 20,
          nearestIntersectionId: nearestInter?.id || 'inter_1',
        };
        graph.nodes[newId] = newZone;
        interventionSummaries.push(
          `Constructed ${buildingName} (+${capacity} residents) at Block ${chosenParcel?.id || 'BLK-NEW'}`
        );
      } else if (buildingType === 'DrainageNode') {
        const newDrain: DrainageNode = {
          id: newId,
          type: 'DrainageNode',
          name: buildingName,
          position: pos,
          capacity: capacity || 2500,
          currentLoad: 0,
          failureThreshold: 1.2,
          status: 'healthy',
          dependencies: [],
          elevation: nearestInter?.elevation || 15,
          drainageCapacityLps: capacity || 2500,
          servicedRoadIds: [],
          servicedZoneIds: [],
          backup: {
            type: 'drainage_pump',
            capacity: 1200,
            durationHours: 12,
            active: false,
          },
        };
        graph.nodes[newId] = newDrain;
        interventionSummaries.push(
          `Constructed ${buildingName} (+${capacity || 2500} L/s flood drainage) at Block ${chosenParcel?.id || 'BLK-NEW'}`
        );
      }

      // Add ACCESS edge to nearest intersection
      if (nearestInter) {
        const accessEdgeId = `access_${newId}`;
        const accessEdge: UrbanEdge = {
          id: accessEdgeId,
          from: newId,
          to: nearestInter.id,
          type: 'ACCESS',
          length: Math.round(minInterDist * 8),
          capacity: 1000,
          currentLoad: 0,
          failureThreshold: 1.2,
          status: 'healthy',
        };
        graph.edges[accessEdgeId] = accessEdge;
      }

      // Add POWER_SUPPLY edge from transformer
      if (nearestTx) {
        nearestTx.servicedConsumerIds.push(newId);
        const powerEdgeId = `power_${newId}`;
        const powerEdge: UrbanEdge = {
          id: powerEdgeId,
          from: nearestTx.id,
          to: newId,
          type: 'POWER_SUPPLY',
          length: Math.round(minTxDist * 8),
          capacity: 500,
          currentLoad: 150,
          failureThreshold: 1.2,
          status: 'healthy',
        };
        graph.edges[powerEdgeId] = powerEdge;
      }

      initialEvents.push({
        id: `evt_${globalStepCounter++}`,
        step: 0,
        round: 0,
        componentId: newId,
        componentType: buildingType as any,
        componentName: buildingName,
        previousStatus: 'healthy',
        newStatus: 'healthy',
        reason: `New urban construction completed. Integrated into road network and power distribution.`,
      });
    }
  }

  // Snapshot Step 0
  const step0Result = runSimulation(graph);
  const step0Insight = interventionSummaries.length > 0
    ? `Direct Trigger Event: ${interventionSummaries.join('; ')}. Immediate structural change applied to the urban twin.`
    : `Initial network condition with applied parameters.`;

  steps.push({
    step: 0,
    round: 0,
    title: 'Step 0: Initial Trigger Event',
    description: 'Direct urban intervention applied to the digital twin.',
    narrativeInsight: step0Insight,
    events: initialEvents,
    activeFailingIds: initialActiveIds,
    cumulativeFailingIds: Array.from(cumulativeFailingIds),
    graphSnapshot: deepCloneGraph(graph),
    resultSnapshot: step0Result,
  });

  // Iterative propagation rounds
  let currentResult = step0Result;

  for (let round = 1; round <= maxRounds; round++) {
    const roundEvents: CascadeEvent[] = [];
    const roundFailingIds: string[] = [];
    const roundObservations: string[] = [];

    // ----------------------------------------------------
    // Cascade Rule C: Power supply failure propagation
    // ----------------------------------------------------
    for (const node of Object.values(graph.nodes)) {
      if (node.type === 'Transformer' && node.status === 'failed') {
        const tx = node as TransformerNode;
        for (const consId of tx.servicedConsumerIds) {
          const consumer = graph.nodes[consId];
          if (!consumer || cumulativeFailingIds.has(consumer.id)) continue;

          if (consumer.type === 'Intersection') {
            const inter = consumer as IntersectionNode;
            if (inter.trafficSignalWorking) {
              inter.trafficSignalWorking = false;
              inter.status = 'damaged';
              roundFailingIds.push(inter.id);
              cumulativeFailingIds.add(inter.id);
              roundObservations.push(
                `Traffic signals went dark at ${inter.name}, slashing arterial throughput`
              );
              roundEvents.push({
                id: `evt_${globalStepCounter++}`,
                step: steps.length,
                round,
                componentId: inter.id,
                componentType: 'Intersection',
                componentName: inter.name,
                previousStatus: 'healthy',
                newStatus: 'damaged',
                reason: `Traffic signal blackout due to unpowered transformer ${tx.name}.`,
              });
            }
          } else if (consumer.type === 'Hospital') {
            const hosp = consumer as HospitalNode;
            if (hosp.hasBackupGenerator && hosp.backup) {
              if (!hosp.backup.active) {
                hosp.backup.active = true;
                hosp.status = 'overloaded';
                roundFailingIds.push(hosp.id);
                cumulativeFailingIds.add(hosp.id);
                roundObservations.push(
                  `${hosp.name} auto-started emergency diesel backup generator (${hosp.backup.durationHours}h fuel)`
                );
                roundEvents.push({
                  id: `evt_${globalStepCounter++}`,
                  step: steps.length,
                  round,
                  componentId: hosp.id,
                  componentType: 'Hospital',
                  componentName: hosp.name,
                  previousStatus: 'healthy',
                  newStatus: 'overloaded',
                  reason: `Main grid feed lost; emergency diesel generator active (${hosp.backup.durationHours}h reserve).`,
                });
              }
            } else {
              hosp.status = 'failed';
              hosp.capacity = Math.round(hosp.capacity * 0.35);
              roundFailingIds.push(hosp.id);
              cumulativeFailingIds.add(hosp.id);
              roundObservations.push(
                `Unbacked clinic ${hosp.name} suffered clinical blackout, capacity collapsed to ${hosp.capacity} beds`
              );
              roundEvents.push({
                id: `evt_${globalStepCounter++}`,
                step: steps.length,
                round,
                componentId: hosp.id,
                componentType: 'Hospital',
                componentName: hosp.name,
                previousStatus: 'healthy',
                newStatus: 'failed',
                reason: `No backup generator! Main power loss forced ICU and surgical shutdown.`,
              });
            }
          } else if (consumer.type === 'School') {
            const school = consumer as SchoolNode;
            school.status = 'damaged';
            roundFailingIds.push(school.id);
            cumulativeFailingIds.add(school.id);
            roundObservations.push(
              `Campus power failure at ${school.name}; facility HVAC offline`
            );
            roundEvents.push({
              id: `evt_${globalStepCounter++}`,
              step: steps.length,
              round,
              componentId: school.id,
              componentType: 'School',
              componentName: school.name,
              previousStatus: 'healthy',
              newStatus: 'damaged',
              reason: `Feeder blackout from transformer ${tx.name}; school facility power lost.`,
            });
          } else if (consumer.type === 'ResidentialZone') {
            const zone = consumer as ResidentialZoneNode;
            zone.status = 'overloaded';
            roundFailingIds.push(zone.id);
            cumulativeFailingIds.add(zone.id);
            roundObservations.push(
              `Residential feeder blackout across ${zone.name} (${zone.population.toLocaleString()} residents)`
            );
            roundEvents.push({
              id: `evt_${globalStepCounter++}`,
              step: steps.length,
              round,
              componentId: zone.id,
              componentType: 'ResidentialZone',
              componentName: zone.name,
              previousStatus: 'healthy',
              newStatus: 'overloaded',
              reason: `Feeder blackout: ${zone.population.toLocaleString()} residents left without electricity.`,
            });
          }
        }
      }
    }

    // ----------------------------------------------------
    // Cascade Rule D: Flood Inundation Propagation
    // ----------------------------------------------------
    for (const [, road] of Object.entries(graph.edges)) {
      if (road.type === 'ROAD' && !road.isClosed && !cumulativeFailingIds.has(road.id)) {
        if (road.floodDepthMm && road.floodDepthMm >= (road.floodMaxTolerableMm || 150)) {
          road.status = 'failed';
          road.isClosed = true;
          roundFailingIds.push(road.id);
          cumulativeFailingIds.add(road.id);
          roundObservations.push(
            `Road ${road.id} submerged under ${road.floodDepthMm}mm stormwater (limit ${road.floodMaxTolerableMm}mm)`
          );
          roundEvents.push({
            id: `evt_${globalStepCounter++}`,
            step: steps.length,
            round,
            componentId: road.id,
            componentType: 'ROAD',
            componentName: `Road ${road.id}`,
            previousStatus: 'healthy',
            newStatus: 'failed',
            metricValue: road.floodDepthMm,
            thresholdValue: road.floodMaxTolerableMm,
            reason: `Water depth (${road.floodDepthMm}mm) exceeded roadway vehicle clearance limit.`,
          });
        }
      }
    }

    // Re-simulate traffic and healthcare with updated states
    currentResult = runSimulation(graph);

    // ----------------------------------------------------
    // Cascade Rule A: Traffic Diversion & Secondary Overload
    // ----------------------------------------------------
    let newlyOverloadedRoads = 0;
    for (const [, edge] of Object.entries(graph.edges)) {
      if (edge.type === 'ROAD' && !edge.isClosed && !cumulativeFailingIds.has(edge.id)) {
        const ratio = edge.capacity > 0 ? edge.currentLoad / edge.capacity : 0;
        if (ratio >= (edge.failureThreshold || 1.10)) {
          edge.status = 'overloaded';
          newlyOverloadedRoads++;
          roundFailingIds.push(edge.id);
          cumulativeFailingIds.add(edge.id);
          roundEvents.push({
            id: `evt_${globalStepCounter++}`,
            step: steps.length,
            round,
            componentId: edge.id,
            componentType: 'ROAD',
            componentName: `Road ${edge.id} (${edge.roadType?.toUpperCase()})`,
            previousStatus: 'healthy',
            newStatus: 'overloaded',
            metricValue: Number(ratio.toFixed(2)),
            thresholdValue: edge.failureThreshold,
            reason: `Traffic diversion pushed volume to ${edge.currentLoad} veh/hr (${(ratio * 100).toFixed(0)}% of capacity). Bottleneck gridlock occurred.`,
          });
        }
      }
    }
    if (newlyOverloadedRoads > 0) {
      roundObservations.push(
        `${newlyOverloadedRoads} parallel detour corridor(s) became overloaded due to diverted traffic volume`
      );
    }

    // ----------------------------------------------------
    // Cascade Rule B: Hospital Overload & Emergency Diversion
    // ----------------------------------------------------
    const hospitals = Object.values(graph.nodes).filter(
      (n): n is HospitalNode => n.type === 'Hospital'
    );
    for (const hosp of hospitals) {
      if (!cumulativeFailingIds.has(hosp.id)) {
        const alloc = currentResult.hospitalAllocations[hosp.id];
        if (alloc && alloc.loadRatio >= (hosp.failureThreshold || 1.05)) {
          hosp.status = 'overloaded';
          roundFailingIds.push(hosp.id);
          cumulativeFailingIds.add(hosp.id);
          roundObservations.push(
            `${hosp.name} exceeded intake capacity (${alloc.assignedDemand} patients, ${(alloc.loadRatio * 100).toFixed(0)}% occupancy)`
          );
          roundEvents.push({
            id: `evt_${globalStepCounter++}`,
            step: steps.length,
            round,
            componentId: hosp.id,
            componentType: 'Hospital',
            componentName: hosp.name,
            previousStatus: 'healthy',
            newStatus: 'overloaded',
            metricValue: Number(alloc.loadRatio.toFixed(2)),
            thresholdValue: hosp.failureThreshold,
            reason: `Patient inflow reached ${alloc.assignedDemand} patients (${(alloc.loadRatio * 100).toFixed(0)}% of ${hosp.capacity} beds). Emergency diversion initiated.`,
          });
        }
      }
    }

    // ----------------------------------------------------
    // Cascade Rule E: Relative Buildings (Residential Zones & Schools)
    // ----------------------------------------------------
    // 1. Residential Zone Access Delays or Severance:
    const residentialZones = Object.values(graph.nodes).filter(
      (n): n is ResidentialZoneNode => n.type === 'ResidentialZone'
    );
    for (const zone of residentialZones) {
      if (!cumulativeFailingIds.has(zone.id)) {
        const metric = currentResult.zoneHospitalMetrics[zone.id];
        const baselineMetric = baselineResult.zoneHospitalMetrics[zone.id];

        if (!metric || !metric.reachable) {
          // Completely cut off from emergency network!
          zone.status = 'failed';
          roundFailingIds.push(zone.id);
          cumulativeFailingIds.add(zone.id);
          roundObservations.push(
            `${zone.name} was isolated: emergency access severed by road closures`
          );
          roundEvents.push({
            id: `evt_${globalStepCounter++}`,
            step: steps.length,
            round,
            componentId: zone.id,
            componentType: 'ResidentialZone',
            componentName: zone.name,
            previousStatus: 'healthy',
            newStatus: 'failed',
            reason: `Road closures completely isolated this sector from all emergency and medical corridors.`,
          });
        } else if (
          baselineMetric &&
          (metric.travelTimeMinutes - baselineMetric.travelTimeMinutes >= 3.0 ||
            metric.travelTimeMinutes > 11)
        ) {
          // Significant emergency response delay!
          zone.status = 'overloaded';
          roundFailingIds.push(zone.id);
          cumulativeFailingIds.add(zone.id);
          roundObservations.push(
            `Emergency response to ${zone.name} delayed to ${metric.travelTimeMinutes.toFixed(1)} min (+${(metric.travelTimeMinutes - baselineMetric.travelTimeMinutes).toFixed(1)} min delay)`
          );
          roundEvents.push({
            id: `evt_${globalStepCounter++}`,
            step: steps.length,
            round,
            componentId: zone.id,
            componentType: 'ResidentialZone',
            componentName: zone.name,
            previousStatus: 'healthy',
            newStatus: 'overloaded',
            metricValue: Number(metric.travelTimeMinutes.toFixed(1)),
            thresholdValue: 10,
            reason: `Detour gridlock lengthened ambulance arrival time to ${metric.travelTimeMinutes.toFixed(1)} min (exceeds 10-minute golden hour standard).`,
          });
        }
      }
    }

    // 2. School Accessibility Disruption:
    const schools = Object.values(graph.nodes).filter(
      (n): n is SchoolNode => n.type === 'School'
    );
    for (const school of schools) {
      if (!cumulativeFailingIds.has(school.id)) {
        const nearestIntId = school.nearestIntersectionId;
        const inter = graph.nodes[nearestIntId];

        // Check connected roads to nearest intersection
        const connectedRoads = Object.values(graph.edges).filter(
          (e) => e.type === 'ROAD' && (e.from === nearestIntId || e.to === nearestIntId)
        );
        const closedCount = connectedRoads.filter((r) => r.isClosed || r.status === 'failed').length;
        const overloadedCount = connectedRoads.filter((r) => r.status === 'overloaded').length;

        if (closedCount >= 2 || (closedCount >= 1 && overloadedCount >= 1) || inter?.status === 'damaged') {
          school.status = 'overloaded';
          roundFailingIds.push(school.id);
          cumulativeFailingIds.add(school.id);
          roundObservations.push(
            `Access corridors to ${school.name} gridlocked; school transport disrupted`
          );
          roundEvents.push({
            id: `evt_${globalStepCounter++}`,
            step: steps.length,
            round,
            componentId: school.id,
            componentType: 'School',
            componentName: school.name,
            previousStatus: 'healthy',
            newStatus: 'overloaded',
            reason: `Corridor closures and severe bottleneck around junction ${inter?.name || nearestIntId} cut off student transit and bus arrivals.`,
          });
        }
      }
    }

    // Snapshot Round narrative
    const travelTimeDiff = currentResult.kpi.avgTravelTimeMinutes - baselineResult.kpi.avgTravelTimeMinutes;
    const congestionDiff = currentResult.kpi.pctRoadsCongested - baselineResult.kpi.pctRoadsCongested;
    const emergDiff = currentResult.kpi.avgEmergencyResponseMinutes - baselineResult.kpi.avgEmergencyResponseMinutes;

    let narrativeInsight = roundObservations.length > 0
      ? `Round ${round} Propagation: ${roundObservations.join('. ')}. `
      : `Round ${round} propagation settled. `;

    if (Math.abs(travelTimeDiff) > 0.05 || Math.abs(congestionDiff) > 0.5 || Math.abs(emergDiff) > 0.1) {
      narrativeInsight += `Systemic Impacts: City-wide travel delay ${travelTimeDiff >= 0 ? '+' : ''}${travelTimeDiff.toFixed(1)} min (${travelTimeDiff >= 0 ? '+' : ''}${((travelTimeDiff / Math.max(0.1, baselineResult.kpi.avgTravelTimeMinutes)) * 100).toFixed(0)}%), road congestion ${congestionDiff >= 0 ? '+' : ''}${congestionDiff.toFixed(1)}%, and ambulance response ${emergDiff >= 0 ? '+' : ''}${emergDiff.toFixed(1)} min.`;
    }

    if (roundEvents.length > 0) {
      steps.push({
        step: steps.length,
        round,
        title: `Round ${round}: Cascading Propagation`,
        description: `Secondary physical & operational impacts across interdependent networks.`,
        narrativeInsight,
        events: roundEvents,
        activeFailingIds: roundFailingIds,
        cumulativeFailingIds: Array.from(cumulativeFailingIds),
        graphSnapshot: deepCloneGraph(graph),
        resultSnapshot: currentResult,
      });
    } else {
      break;
    }
  }

  // Final equilibrium step
  const finalTravelDiff = currentResult.kpi.avgTravelTimeMinutes - baselineResult.kpi.avgTravelTimeMinutes;
  const finalEmergDiff = currentResult.kpi.avgEmergencyResponseMinutes - baselineResult.kpi.avgEmergencyResponseMinutes;
  const finalCongestDiff = currentResult.kpi.pctRoadsCongested - baselineResult.kpi.pctRoadsCongested;

  const finalEquilibriumInsight = `Cascade Stabilized at Equilibrium: Multi-round propagation converged after ${steps.length - 1} disruption rounds. Total ${cumulativeFailingIds.size} urban components were impacted. City-wide travel delays settled at ${finalTravelDiff >= 0 ? '+' : ''}${finalTravelDiff.toFixed(1)} min (${finalTravelDiff >= 0 ? '+' : ''}${((finalTravelDiff / Math.max(0.1, baselineResult.kpi.avgTravelTimeMinutes)) * 100).toFixed(0)}%), road congestion reached ${finalCongestDiff >= 0 ? '+' : ''}${finalCongestDiff.toFixed(1)}%, and emergency response settled at ${finalEmergDiff >= 0 ? '+' : ''}${finalEmergDiff.toFixed(1)} min relative to baseline.`;

  steps.push({
    step: steps.length,
    round: steps.length,
    title: 'Equilibrium: Stabilized Network State',
    description: 'System reached new operational equilibrium. All disruptions stabilized.',
    narrativeInsight: finalEquilibriumInsight,
    events: [],
    // Retain all cumulative failing IDs so highlights remain visible on the map
    activeFailingIds: Array.from(cumulativeFailingIds),
    cumulativeFailingIds: Array.from(cumulativeFailingIds),
    graphSnapshot: deepCloneGraph(graph),
    resultSnapshot: currentResult,
  });

  return {
    graph,
    steps,
    result: currentResult,
  };
}
