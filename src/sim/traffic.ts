import {
  GraphData,
  HospitalNode,
  IntersectionNode,
  ResidentialZoneNode,
  SchoolNode,
  UrbanEdge,
} from '../types/graph';
import { dijkstra, reconstructPath } from './dijkstra';
import { buildRoadAdjacency, getNodesByType } from './graphUtils';

/**
 * Bureau of Public Roads (BPR) function
 * t = t0 * (1 + alpha * (volume / capacity) ^ beta)
 */
export function calculateBprTravelTime(
  freeFlowMinutes: number,
  volume: number,
  capacity: number,
  alpha: number = 0.15,
  beta: number = 3.5
): number {
  if (capacity <= 0) return freeFlowMinutes * 10;
  const vcRatio = volume / capacity;
  return freeFlowMinutes * (1 + alpha * Math.pow(vcRatio, beta));
}

export interface TrafficAssignmentResult {
  roadLoads: Record<string, number>;
  roadTravelTimes: Record<string, number>;
  roadCongestionRatios: Record<string, number>;
  avgTravelTimeMinutes: number;
  pctRoadsCongested: number;
  totalTripsAssigned: number;
}

/**
 * Runs iterative traffic assignment using BPR equilibrium loading
 */
export function simulateTraffic(
  graph: GraphData,
  iterations: number = 3
): TrafficAssignmentResult {
  const roadEdges: Record<string, UrbanEdge> = {};
  for (const [id, edge] of Object.entries(graph.edges)) {
    if (edge.type === 'ROAD') {
      roadEdges[id] = edge;
    }
  }

  const intersections = getNodesByType<IntersectionNode>(graph.nodes, 'Intersection');
  const residentialZones = getNodesByType<ResidentialZoneNode>(graph.nodes, 'ResidentialZone');
  const hospitals = getNodesByType<HospitalNode>(graph.nodes, 'Hospital');
  const schools = getNodesByType<SchoolNode>(graph.nodes, 'School');

  // Commercial / employment destinations: main intersections
  const employmentCenters = intersections.filter((i) => i.isMainIntersection);
  if (employmentCenters.length === 0 && intersections.length > 0) {
    employmentCenters.push(intersections[0]);
  }

  // Pre-initialize edge loads to 0
  let edgeVolumes: Record<string, number> = {};
  for (const id of Object.keys(roadEdges)) {
    edgeVolumes[id] = 0;
  }

  let totalTripsAssigned = 0;
  let totalTripMinutes = 0;

  // Run iterative loading
  for (let iter = 1; iter <= iterations; iter++) {
    const iterVolumes: Record<string, number> = {};
    for (const id of Object.keys(roadEdges)) {
      iterVolumes[id] = 0;
    }

    // Build road adjacency using current congested travel times
    const adjacency = buildRoadAdjacency(roadEdges, true);

    // Assign trips from each residential zone to potential destinations
    for (const zone of residentialZones) {
      if (!zone.nearestIntersectionId || !graph.nodes[zone.nearestIntersectionId]) continue;
      const originIntId = zone.nearestIntersectionId;

      // Trips generated: peak hourly trips (~22% of population - standard urban trip rate)
      const totalZoneTrips = Math.round(zone.population * 0.22);
      if (totalZoneTrips <= 0) continue;

      // Split trips: 55% to employment centers, 25% to schools, 20% to hospitals/services
      const empTrips = Math.round(totalZoneTrips * 0.55);
      const schoolTrips = Math.round(totalZoneTrips * 0.25);
      const hospTrips = totalZoneTrips - empTrips - schoolTrips;

      // Solve Dijkstra from origin once for all destinations
      const dijkstraTree = dijkstra(
        originIntId,
        roadEdges,
        adjacency,
        (e) => e.congestedTravelTime || e.freeFlowTravelTime || 1
      );

      // 1. Distribute to employment centers (Gravity model)
      if (employmentCenters.length > 0) {
        const empWeights: Array<{ destId: string; weight: number }> = [];
        let totalW = 0;
        for (const dest of employmentCenters) {
          const d = dijkstraTree.distances[dest.id] ?? Infinity;
          if (d < Infinity) {
            const w = 1 / Math.pow(Math.max(1, d), 1.2);
            empWeights.push({ destId: dest.id, weight: w });
            totalW += w;
          }
        }
        if (totalW > 0) {
          for (const item of empWeights) {
            const trips = Math.round(empTrips * (item.weight / totalW));
            if (trips > 0) {
              const path = reconstructPath(item.destId, dijkstraTree);
              for (const edgeId of path) {
                iterVolumes[edgeId] = (iterVolumes[edgeId] || 0) + trips;
              }
            }
          }
        }
      }

      // 2. Distribute to nearest school
      let bestSchoolDist = Infinity;
      if (schools.length > 0) {
        let bestSchoolInt = schools[0].nearestIntersectionId;
        for (const sc of schools) {
          const d = dijkstraTree.distances[sc.nearestIntersectionId] ?? Infinity;
          if (d < bestSchoolDist) {
            bestSchoolDist = d;
            bestSchoolInt = sc.nearestIntersectionId;
          }
        }
        if (bestSchoolDist < Infinity && bestSchoolInt) {
          const path = reconstructPath(bestSchoolInt, dijkstraTree);
          for (const edgeId of path) {
            iterVolumes[edgeId] = (iterVolumes[edgeId] || 0) + schoolTrips;
          }
        }
      }

      // 3. Distribute to nearest hospital
      let bestHospDist = Infinity;
      if (hospitals.length > 0) {
        let bestHospInt = hospitals[0].nearestIntersectionId;
        for (const h of hospitals) {
          const d = dijkstraTree.distances[h.nearestIntersectionId] ?? Infinity;
          if (d < bestHospDist) {
            bestHospDist = d;
            bestHospInt = h.nearestIntersectionId;
          }
        }
        if (bestHospDist < Infinity && bestHospInt) {
          const path = reconstructPath(bestHospInt, dijkstraTree);
          for (const edgeId of path) {
            iterVolumes[edgeId] = (iterVolumes[edgeId] || 0) + hospTrips;
          }
        }
      }

      if (iter === iterations) {
        totalTripsAssigned += totalZoneTrips;

        // Track trip travel times for true city-wide commuter average
        if (employmentCenters.length > 0) {
          const empWeights: Array<{ destId: string; time: number; weight: number }> = [];
          let totalW = 0;
          for (const dest of employmentCenters) {
            const d = dijkstraTree.distances[dest.id] ?? Infinity;
            if (d < Infinity) {
              const w = 1 / Math.pow(Math.max(1, d), 1.2);
              empWeights.push({ destId: dest.id, time: d, weight: w });
              totalW += w;
            }
          }
          if (totalW > 0) {
            for (const item of empWeights) {
              const trips = Math.round(empTrips * (item.weight / totalW));
              totalTripMinutes += trips * item.time;
            }
          }
        }

        if (bestSchoolDist < Infinity && schoolTrips > 0) {
          totalTripMinutes += schoolTrips * bestSchoolDist;
        }

        if (bestHospDist < Infinity && hospTrips > 0) {
          totalTripMinutes += hospTrips * bestHospDist;
        }
      }
    }

    // Blend volumes (Method of Successive Averages: v = v_prev * (1 - 1/iter) + v_new * (1/iter))
    const blendWeight = 1 / iter;
    for (const [id, vol] of Object.entries(iterVolumes)) {
      edgeVolumes[id] = (edgeVolumes[id] || 0) * (1 - blendWeight) + vol * blendWeight;

      // Update edge travel times based on new blended volumes
      const edge = roadEdges[id];
      if (edge) {
        edge.currentLoad = Math.round(edgeVolumes[id]);
        edge.congestedTravelTime = calculateBprTravelTime(
          edge.freeFlowTravelTime || 1,
          edge.currentLoad,
          edge.capacity
        );
      }
    }
  }

  // Compute final statistics
  const roadTravelTimes: Record<string, number> = {};
  const roadCongestionRatios: Record<string, number> = {};
  let congestedCount = 0;
  let activeRoadCount = 0;

  for (const [id, edge] of Object.entries(roadEdges)) {
    if (edge.isClosed || edge.status === 'failed') continue;

    activeRoadCount++;
    const load = edge.currentLoad;
    const ratio = edge.capacity > 0 ? load / edge.capacity : 0;
    roadCongestionRatios[id] = Number(ratio.toFixed(2));
    roadTravelTimes[id] = Number((edge.congestedTravelTime || 1).toFixed(2));

    if (ratio > 0.85) {
      congestedCount++;
    }

    // Update edge status
    if (ratio >= edge.failureThreshold) {
      edge.status = 'overloaded';
    } else {
      edge.status = 'healthy';
    }
  }

  const avgTravelTimeMinutes =
    totalTripsAssigned > 0 ? Number((totalTripMinutes / totalTripsAssigned).toFixed(2)) : 8.5;
  const pctRoadsCongested =
    activeRoadCount > 0
      ? Number(((congestedCount / activeRoadCount) * 100).toFixed(1))
      : 0;

  return {
    roadLoads: edgeVolumes,
    roadTravelTimes,
    roadCongestionRatios,
    avgTravelTimeMinutes,
    pctRoadsCongested,
    totalTripsAssigned,
  };
}
