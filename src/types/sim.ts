import { ComponentStatus, EdgeType, GraphData, NodeType } from './graph';

export interface SimulationKPI {
  avgTravelTimeMinutes: number;
  pctRoadsCongested: number; // % with load/capacity > 0.85
  avgEmergencyResponseMinutes: number;
  maxEmergencyResponseMinutes: number;
  pctPopulationWithin10MinHospital: number;
  overloadedHospitalsCount: number;
  publicTransitCoveragePct: number; // % population within 450m of a bus stop
  powerGridLoadFactorPct: number; // total load / total capacity * 100
  floodExposedPopulation: number;
  unservedResidentialCount: number; // zones with cut access or disconnected hospital/power
  totalVehiclesTraveled: number;
}

export interface CascadeEvent {
  id: string;
  step: number;
  round: number;
  componentId: string;
  componentType: NodeType | EdgeType;
  componentName: string;
  previousStatus: ComponentStatus;
  newStatus: ComponentStatus;
  metricValue?: number;
  thresholdValue?: number;
  reason: string;
}

export interface CascadeStep {
  step: number;
  round: number;
  title: string;
  description: string;
  narrativeInsight: string; // Rich textual insight explaining real-time causes & systemic effects
  events: CascadeEvent[];
  activeFailingIds: string[];
  cumulativeFailingIds: string[];
  graphSnapshot: GraphData; // Graph state at this exact point in the cascade
  resultSnapshot: SimulationResult; // Simulation result at this exact point in the cascade
}

export type InterventionType =
  | 'CLOSE_ROAD'
  | 'OPEN_ROAD'
  | 'SURGE_HOSPITAL_DEMAND'
  | 'SET_HOSPITAL_CAPACITY'
  | 'DISABLE_TRANSFORMER'
  | 'ENABLE_TRANSFORMER'
  | 'SET_RAINFALL'
  | 'SET_DRAINAGE_CAPACITY'
  | 'ADD_BACKUP_GENERATOR'
  | 'CONSTRUCT_BUILDING';

export interface ScenarioIntervention {
  id: string;
  type: InterventionType;
  targetId?: string;
  parameters: Record<string, any>;
  description: string;
  timestamp: number;
}

export interface MitigationSuggestion {
  id: string;
  category: 'Transport' | 'Healthcare' | 'Power' | 'Flood';
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  targetComponentId?: string;
  estimatedImpact: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  timestamp: number;
  interventions: ScenarioIntervention[];
  graph: GraphData;
  kpi: SimulationKPI;
  cascadeSteps: CascadeStep[];
  mitigations: MitigationSuggestion[];
}

export interface ZoneHospitalMetric {
  zoneId: string;
  nearestHospitalId: string | null;
  travelTimeMinutes: number;
  reachable: boolean;
  distanceMeters: number;
}

export interface SimulationResult {
  kpi: SimulationKPI;
  zoneHospitalMetrics: Record<string, ZoneHospitalMetric>;
  roadTravelTimes: Record<string, number>;
  roadCongestionRatios: Record<string, number>;
  transformerLoads: Record<string, number>;
  hospitalAllocations: Record<string, { assignedDemand: number; overflow: number; loadRatio: number }>;
  floodedRoadIds: string[];
  inundatedZoneIds: string[];
}
