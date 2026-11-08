import {
  GraphData,
  HospitalNode,
  IntersectionNode,
  ResidentialZoneNode,
  SchoolNode,
  TransformerNode,
  UrbanNode,
  ValidationIssue,
  ValidationReport,
} from '../types/graph';
import { findRoadComponents } from './graphUtils';

/**
 * Validates the city graph structure:
 * 1. Road network is fully connected (single component)
 * 2. Every facility/zone has access to an intersection
 * 3. Every consumer has a valid transformer power supply dependency
 */
export function validateCity(graph: GraphData): ValidationReport {
  const issues: ValidationIssue[] = [];

  // Filter components
  const intersections: Record<string, IntersectionNode> = {};
  const transformers: Record<string, TransformerNode> = {};

  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.type === 'Intersection') {
      intersections[id] = node as IntersectionNode;
    } else if (node.type === 'Transformer') {
      transformers[id] = node as TransformerNode;
    }
  }

  // 1. Road network connectivity check
  const components = findRoadComponents(intersections, graph.edges, false);
  const roadNetworkConnected = components.length <= 1;

  if (!roadNetworkConnected) {
    issues.push({
      severity: 'error',
      componentId: 'road-network',
      message: `Road network is fragmented into ${components.length} disconnected components.`,
    });
  }

  // 2. Road access check for facilities and zones
  const consumersNeedingPower: UrbanNode[] = [];
  let totalPopulation = 0;

  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.type === 'ResidentialZone') {
      const zone = node as ResidentialZoneNode;
      totalPopulation += zone.population;
      consumersNeedingPower.push(node);

      if (!zone.nearestIntersectionId || !graph.nodes[zone.nearestIntersectionId]) {
        issues.push({
          severity: 'error',
          componentId: id,
          message: `Residential Zone "${zone.name}" (${id}) is not linked to any road intersection.`,
        });
      }
    } else if (node.type === 'Hospital') {
      const hosp = node as HospitalNode;
      consumersNeedingPower.push(node);
      if (!hosp.nearestIntersectionId || !graph.nodes[hosp.nearestIntersectionId]) {
        issues.push({
          severity: 'error',
          componentId: id,
          message: `Hospital "${hosp.name}" (${id}) is not linked to any road intersection.`,
        });
      }
    } else if (node.type === 'School') {
      const school = node as SchoolNode;
      consumersNeedingPower.push(node);
      if (!school.nearestIntersectionId || !graph.nodes[school.nearestIntersectionId]) {
        issues.push({
          severity: 'error',
          componentId: id,
          message: `School "${school.name}" (${id}) is not linked to any road intersection.`,
        });
      }
    } else if (node.type === 'BusStop') {
      const bus = node as any;
      if (!bus.nearestIntersectionId || !graph.nodes[bus.nearestIntersectionId]) {
        issues.push({
          severity: 'warning',
          componentId: id,
          message: `Bus Stop "${bus.name}" (${id}) is not linked to any road intersection.`,
        });
      }
    } else if (node.type === 'Intersection') {
      const inter = node as IntersectionNode;
      if (inter.hasTrafficSignal) {
        consumersNeedingPower.push(node);
      }
    }
  }

  // 3. Power supply dependency check
  let totalPowerDemandKW = 0;
  for (const consumer of consumersNeedingPower) {
    totalPowerDemandKW += consumer.capacity; // Initial design load demand

    const powerDependencies = consumer.dependencies.filter(
      (depId) => graph.nodes[depId]?.type === 'Transformer'
    );

    if (powerDependencies.length === 0) {
      issues.push({
        severity: 'error',
        componentId: consumer.id,
        message: `Consumer "${consumer.name}" (${consumer.id}) lacks a power supply dependency.`,
      });
    } else {
      const transformerId = powerDependencies[0];
      if (!transformers[transformerId]) {
        issues.push({
          severity: 'error',
          componentId: consumer.id,
          message: `Consumer "${consumer.name}" references non-existent transformer ${transformerId}.`,
        });
      }
    }
  }

  let totalPowerCapacityKW = 0;
  for (const t of Object.values(transformers)) {
    totalPowerCapacityKW += t.capacity;
  }

  // Count edge and node breakdown
  let roadCount = 0;
  for (const edge of Object.values(graph.edges)) {
    if (edge.type === 'ROAD') roadCount++;
  }

  const stats = {
    intersections: Object.keys(intersections).length,
    roads: roadCount,
    hospitals: Object.values(graph.nodes).filter((n) => n.type === 'Hospital').length,
    schools: Object.values(graph.nodes).filter((n) => n.type === 'School').length,
    residentialZones: Object.values(graph.nodes).filter((n) => n.type === 'ResidentialZone').length,
    busStops: Object.values(graph.nodes).filter((n) => n.type === 'BusStop').length,
    substations: Object.values(graph.nodes).filter((n) => n.type === 'Substation').length,
    transformers: Object.values(transformers).length,
    drainageNodes: Object.values(graph.nodes).filter((n) => n.type === 'DrainageNode').length,
    floodZones: Object.values(graph.floodZones).length,
    totalPopulation,
    totalPowerDemandKW,
    totalPowerCapacityKW,
  };

  const hasErrors = issues.some((i) => i.severity === 'error');

  return {
    isValid: !hasErrors && roadNetworkConnected,
    totalNodes: Object.keys(graph.nodes).length,
    totalEdges: Object.keys(graph.edges).length,
    roadNetworkConnected,
    issues,
    stats,
  };
}
