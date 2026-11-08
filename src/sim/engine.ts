import {
  DrainageNode,
  GraphData,
  HospitalNode,
  IntersectionNode,
  ResidentialZoneNode,
  SubstationNode,
  TransformerNode,
  UrbanEdge,
} from '../types/graph';
import { SimulationKPI, SimulationResult, ZoneHospitalMetric } from '../types/sim';
import { dijkstra } from './dijkstra';
import { buildRoadAdjacency, distance, getNodesByType } from './graphUtils';
import { simulateTraffic } from './traffic';

/**
 * Executes the complete integrated urban simulation
 */
export function runSimulation(graph: GraphData): SimulationResult {
  const roadEdges: Record<string, UrbanEdge> = {};
  for (const [id, edge] of Object.entries(graph.edges)) {
    if (edge.type === 'ROAD') {
      roadEdges[id] = edge;
    }
  }

  const residentialZones = getNodesByType<ResidentialZoneNode>(graph.nodes, 'ResidentialZone');
  const hospitals = getNodesByType<HospitalNode>(graph.nodes, 'Hospital');
  const drainageNodes = getNodesByType<DrainageNode>(graph.nodes, 'DrainageNode');
  const substations = getNodesByType<SubstationNode>(graph.nodes, 'Substation');
  const transformers = getNodesByType<TransformerNode>(graph.nodes, 'Transformer');
  const floodZones = Object.values(graph.floodZones);

  // ==========================================
  // 1. FLOOD & DRAINAGE INUNDATION MODEL
  // ==========================================
  const rainfallMmH = graph.config.rainfallIntensityMmPerHour ?? 0;
  const floodedRoadIds: string[] = [];
  const inundatedZoneIds: string[] = [];
  let floodExposedPopulation = 0;

  // Calculate water level in flood zones
  for (const fZone of floodZones) {
    if (rainfallMmH <= 0) {
      fZone.waterLevelMm = 0;
      fZone.currentLoad = 0;
      fZone.status = 'healthy';
      continue;
    }

    // Net accumulation: rainfall - drainage capacity
    const effectiveDrainage = fZone.drainageRateLps / 10; // mm/h equivalent absorption
    const netRainfallRate = Math.max(0, rainfallMmH - effectiveDrainage);
    const accumulatedMm = Math.round(netRainfallRate * 1.8);

    fZone.waterLevelMm = accumulatedMm;
    fZone.currentLoad = accumulatedMm;

    if (accumulatedMm >= fZone.criticalThresholdMm) {
      fZone.status = 'failed';
    } else if (accumulatedMm > fZone.criticalThresholdMm * 0.7) {
      fZone.status = 'overloaded';
    } else {
      fZone.status = 'healthy';
    }

    // Check roads within flood zone radius
    for (const [rId, road] of Object.entries(roadEdges)) {
      const fromNode = graph.nodes[road.from];
      const toNode = graph.nodes[road.to];
      if (!fromNode || !toNode) continue;

      const midPoint = {
        x: (fromNode.position.x + toNode.position.x) / 2,
        y: (fromNode.position.y + toNode.position.y) / 2,
      };

      const distToFlood = distance(midPoint, fZone.position);
      if (distToFlood <= fZone.radius) {
        // Road receives proportional water depth
        const proximityFactor = 1 - distToFlood / (fZone.radius * 1.2);
        const roadWaterDepth = Math.round(accumulatedMm * Math.max(0.2, proximityFactor));
        road.floodDepthMm = Math.max(road.floodDepthMm || 0, roadWaterDepth);

        // Check if exceeds road passable threshold
        if (road.floodDepthMm >= (road.floodMaxTolerableMm || 150)) {
          road.status = 'failed';
          road.isClosed = true;
          if (!floodedRoadIds.includes(rId)) {
            floodedRoadIds.push(rId);
          }
        }
      }
    }

    // Check residential zones in flood basin
    for (const zone of residentialZones) {
      const dist = distance(zone.position, fZone.position);
      if (dist <= fZone.radius && accumulatedMm > 30) {
        if (!inundatedZoneIds.includes(zone.id)) {
          inundatedZoneIds.push(zone.id);
          floodExposedPopulation += zone.population;
          zone.status = accumulatedMm >= fZone.criticalThresholdMm ? 'damaged' : 'overloaded';
        }
      }
    }
  }

  // Check drainage stations loading
  for (const drain of drainageNodes) {
    if (rainfallMmH > 0) {
      drain.currentLoad = Math.min(
        drain.capacity * 1.5,
        Math.round((rainfallMmH / 50) * drain.capacity)
      );
      if (drain.currentLoad > drain.capacity * drain.failureThreshold) {
        drain.status = 'overloaded';
      }
    } else {
      drain.currentLoad = 0;
      drain.status = 'healthy';
    }
  }

  // ==========================================
  // 2. POWER GRID BALANCE & SIGNAL DEGRADATION
  // ==========================================
  const transformerLoads: Record<string, number> = {};

  for (const tx of transformers) {
    let actualLoad = 0;
    const isTxHealthy = tx.status !== 'failed';

    for (const consId of tx.servicedConsumerIds) {
      const consNode = graph.nodes[consId];
      if (!consNode) continue;

      if (!isTxHealthy) {
        // Grid power lost! Check backup capabilities
        if (consNode.type === 'Hospital') {
          const hosp = consNode as HospitalNode;
          if (hosp.backup && hosp.backup.active) {
            // Powered by generator
            consNode.status = 'overloaded'; // generator strain
          } else if (hosp.hasBackupGenerator) {
            hosp.backup!.active = true;
            consNode.status = 'overloaded';
          } else {
            // Clinic without generator loses clinical capacity!
            consNode.status = 'failed';
            consNode.capacity = Math.round(consNode.capacity * 0.3);
          }
        } else if (consNode.type === 'Intersection') {
          const inter = consNode as IntersectionNode;
          inter.trafficSignalWorking = false;
          inter.status = 'damaged';

          // Degrade capacity of connected roads by 40% due to dark signals!
          for (const edge of Object.values(roadEdges)) {
            if (edge.from === inter.id || edge.to === inter.id) {
              if (edge.roadType === 'main') {
                edge.capacity = Math.round(edge.capacity * 0.6);
              }
            }
          }
        } else if (consNode.type === 'ResidentialZone') {
          consNode.status = 'overloaded'; // blackout condition
        }
      } else {
        // Normal power supply
        if (consNode.type === 'ResidentialZone') {
          actualLoad += (consNode as ResidentialZoneNode).population * 0.65;
        } else if (consNode.type === 'Hospital') {
          actualLoad += 300;
        } else if (consNode.type === 'School') {
          actualLoad += 120;
        } else if (consNode.type === 'Intersection') {
          actualLoad += 15;
        }
      }
    }

    tx.currentLoad = Math.round(actualLoad);
    transformerLoads[tx.id] = tx.currentLoad;

    if (isTxHealthy) {
      const loadRatio = tx.capacity > 0 ? tx.currentLoad / tx.capacity : 0;
      if (loadRatio >= tx.failureThreshold) {
        tx.status = 'overloaded';
      } else {
        tx.status = 'healthy';
      }
    }
  }

  // Substation loading
  let totalGridLoad = 0;
  let totalGridCapacity = 0;
  for (const sub of substations) {
    let subLoad = 0;
    for (const txId of sub.transformerIds) {
      subLoad += transformerLoads[txId] || 0;
    }
    sub.currentLoad = subLoad;
    totalGridLoad += subLoad;
    totalGridCapacity += sub.capacity;

    if (sub.status !== 'failed') {
      const subRatio = sub.capacity > 0 ? sub.currentLoad / sub.capacity : 0;
      sub.status = subRatio >= sub.failureThreshold ? 'overloaded' : 'healthy';
    }
  }

  const powerGridLoadFactorPct =
    totalGridCapacity > 0
      ? Number(((totalGridLoad / totalGridCapacity) * 100).toFixed(1))
      : 0;

  // ==========================================
  // 3. MOBILITY & TRAFFIC SIMULATION
  // ==========================================
  const trafficResult = simulateTraffic(graph, 3);

  // ==========================================
  // 4. HEALTHCARE & EMERGENCY ACCESSIBILITY
  // ==========================================
  const roadAdj = buildRoadAdjacency(roadEdges, true);
  const zoneHospitalMetrics: Record<string, ZoneHospitalMetric> = {};
  const hospitalAllocations: Record<
    string,
    { assignedDemand: number; overflow: number; loadRatio: number }
  > = {};

  for (const h of hospitals) {
    hospitalAllocations[h.id] = {
      assignedDemand: 0,
      overflow: 0,
      loadRatio: 0,
    };
  }

  let totalEmergencyTime = 0;
  let maxEmergencyTime = 0;
  let popWithin10Min = 0;
  let totalPop = 0;
  let unservedResidentialCount = 0;

  // Initial assignment of zones to closest reachable hospital
  for (const zone of residentialZones) {
    totalPop += zone.population;
    const originIntId = zone.nearestIntersectionId;

    if (!originIntId || !graph.nodes[originIntId]) {
      unservedResidentialCount++;
      zoneHospitalMetrics[zone.id] = {
        zoneId: zone.id,
        nearestHospitalId: null,
        travelTimeMinutes: 999,
        reachable: false,
        distanceMeters: 99999,
      };
      continue;
    }

    const dijkstraResult = dijkstra(
      originIntId,
      roadEdges,
      roadAdj,
      (e) => e.congestedTravelTime || e.freeFlowTravelTime || 1
    );

    let bestHospital: HospitalNode | null = null;
    let minTime = Infinity;

    for (const hosp of hospitals) {
      if (hosp.status === 'failed') continue;
      const hospIntId = hosp.nearestIntersectionId;
      const timeToHosp = dijkstraResult.distances[hospIntId] ?? Infinity;

      if (timeToHosp < minTime) {
        minTime = timeToHosp;
        bestHospital = hosp;
      }
    }

    if (bestHospital && minTime < Infinity) {
      const metric: ZoneHospitalMetric = {
        zoneId: zone.id,
        nearestHospitalId: bestHospital.id,
        travelTimeMinutes: Number(minTime.toFixed(1)),
        reachable: true,
        distanceMeters: Math.round(minTime * 600), // approx
      };
      zoneHospitalMetrics[zone.id] = metric;

      totalEmergencyTime += minTime * zone.population;
      if (minTime > maxEmergencyTime) {
        maxEmergencyTime = minTime;
      }
      if (minTime <= 10) {
        popWithin10Min += zone.population;
      }

      // Add emergency patient demand from zone to hospital
      const patientDemand = Math.round(zone.population * 0.028);
      hospitalAllocations[bestHospital.id].assignedDemand += patientDemand;
    } else {
      // Unreachable
      unservedResidentialCount++;
      zoneHospitalMetrics[zone.id] = {
        zoneId: zone.id,
        nearestHospitalId: null,
        travelTimeMinutes: 999,
        reachable: false,
        distanceMeters: 99999,
      };
    }
  }

  // Evaluate hospital overflow and redirect if needed
  let overloadedHospitalsCount = 0;
  for (const hosp of hospitals) {
    const alloc = hospitalAllocations[hosp.id];
    hosp.currentLoad = alloc.assignedDemand;
    const ratio = hosp.capacity > 0 ? hosp.currentLoad / hosp.capacity : 0;
    alloc.loadRatio = Number(ratio.toFixed(2));

    if (ratio > 1.0) {
      alloc.overflow = hosp.currentLoad - hosp.capacity;
      overloadedHospitalsCount++;
      if (hosp.status !== 'failed') {
        hosp.status = 'overloaded';
      }
    } else if (hosp.status !== 'failed') {
      hosp.status = 'healthy';
    }
  }

  const avgEmergencyResponseMinutes =
    totalPop > 0 ? Number((totalEmergencyTime / totalPop).toFixed(1)) : 12;
  const pctPopulationWithin10MinHospital =
    totalPop > 0 ? Number(((popWithin10Min / totalPop) * 100).toFixed(1)) : 0;

  // ==========================================
  // 5. PUBLIC TRANSIT COVERAGE
  // ==========================================
  const busStops = Object.values(graph.nodes).filter((n) => n.type === 'BusStop');
  let transitCoveredPop = 0;

  for (const zone of residentialZones) {
    let nearestDist = Infinity;
    for (const bus of busStops) {
      const d = distance(zone.position, bus.position) * 4; // scale in meters
      if (d < nearestDist) {
        nearestDist = d;
      }
    }
    // Standard walk catchment: <= 450 meters (~5-6 min walk)
    if (nearestDist <= 450) {
      transitCoveredPop += zone.population;
    }
  }

  const publicTransitCoveragePct =
    totalPop > 0 ? Number(((transitCoveredPop / totalPop) * 100).toFixed(1)) : 0;

  // ==========================================
  // FINAL KPI COMPILATION
  // ==========================================
  const kpi: SimulationKPI = {
    avgTravelTimeMinutes: trafficResult.avgTravelTimeMinutes,
    pctRoadsCongested: trafficResult.pctRoadsCongested,
    avgEmergencyResponseMinutes,
    maxEmergencyResponseMinutes: Number(maxEmergencyTime.toFixed(1)),
    pctPopulationWithin10MinHospital,
    overloadedHospitalsCount,
    publicTransitCoveragePct,
    powerGridLoadFactorPct,
    floodExposedPopulation,
    unservedResidentialCount,
    totalVehiclesTraveled: trafficResult.totalTripsAssigned,
  };

  return {
    kpi,
    zoneHospitalMetrics,
    roadTravelTimes: trafficResult.roadTravelTimes,
    roadCongestionRatios: trafficResult.roadCongestionRatios,
    transformerLoads,
    hospitalAllocations,
    floodedRoadIds,
    inundatedZoneIds,
  };
}
