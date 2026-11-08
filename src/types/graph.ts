export type ComponentStatus = 'healthy' | 'overloaded' | 'damaged' | 'failed';

export type NodeType =
  | 'Intersection'
  | 'Hospital'
  | 'School'
  | 'ResidentialZone'
  | 'BusStop'
  | 'Substation'
  | 'Transformer'
  | 'DrainageNode'
  | 'FloodZone';

export type EdgeType =
  | 'ROAD'
  | 'POWER_SUPPLY'
  | 'SERVES'
  | 'DEPENDS_ON'
  | 'DRAINS'
  | 'ACCESS';

export type RoadType = 'main' | 'local';

export type PopulationDensity = 'low' | 'medium' | 'high';

export type FloodRiskLevel = 'low' | 'moderate' | 'severe';

export interface Position {
  x: number;
  y: number;
}

export interface BackupCapability {
  type: 'generator' | 'battery' | 'drainage_pump';
  capacity: number; // e.g. kVA or kW or L/s
  durationHours: number;
  active: boolean;
  fuelRemaining?: number; // 0..100%
}

export interface BaseComponent {
  id: string;
  type: NodeType;
  name: string;
  position: Position;
  capacity: number;
  currentLoad: number;
  failureThreshold: number; // load / capacity ratio threshold (e.g. 1.25)
  status: ComponentStatus;
  dependencies: string[]; // IDs of components this relies on
  backup?: BackupCapability;
}

export interface IntersectionNode extends BaseComponent {
  type: 'Intersection';
  isMainIntersection: boolean;
  hasTrafficSignal: boolean;
  trafficSignalWorking: boolean;
  elevation: number; // meters above sea level
}

export interface HospitalNode extends BaseComponent {
  type: 'Hospital';
  tier: 'Primary' | 'Secondary' | 'Tertiary';
  beds: number;
  emergencyDemand: number;
  hasBackupGenerator: boolean;
  nearestIntersectionId: string;
}

export interface SchoolNode extends BaseComponent {
  type: 'School';
  schoolType: 'Elementary' | 'High School' | 'Community College';
  studentCapacity: number;
  nearestIntersectionId: string;
}

export interface ResidentialZoneNode extends BaseComponent {
  type: 'ResidentialZone';
  population: number;
  density: PopulationDensity;
  radius: number;
  elevation: number;
  nearestIntersectionId: string;
  nearestBusStopId?: string;
}

export interface BusStopNode extends BaseComponent {
  type: 'BusStop';
  routeIds: string[];
  connectedRoadId: string;
  nearestIntersectionId: string;
}

export interface SubstationNode extends BaseComponent {
  type: 'Substation';
  voltageKV: number;
  transformerIds: string[];
}

export interface TransformerNode extends BaseComponent {
  type: 'Transformer';
  substationId: string;
  servicedConsumerIds: string[];
}

export interface DrainageNode extends BaseComponent {
  type: 'DrainageNode';
  drainageCapacityLps: number; // Litres per second
  elevation: number;
  servicedZoneIds: string[];
  servicedRoadIds: string[];
}

export interface FloodZoneArea extends BaseComponent {
  type: 'FloodZone';
  riskLevel: FloodRiskLevel;
  radius: number;
  waterLevelMm: number; // Current flood depth in mm
  criticalThresholdMm: number; // Inundation threshold
  drainageRateLps: number;
}

export type UrbanNode =
  | IntersectionNode
  | HospitalNode
  | SchoolNode
  | ResidentialZoneNode
  | BusStopNode
  | SubstationNode
  | TransformerNode
  | DrainageNode
  | FloodZoneArea;

export interface UrbanEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  length: number; // meters
  capacity: number; // e.g. veh/hr for road, kVA for power
  currentLoad: number;
  failureThreshold: number; // load/capacity ratio e.g. 1.2
  status: ComponentStatus;
  // Road specific properties:
  roadType?: RoadType;
  lanes?: number;
  freeFlowSpeed?: number; // km/h
  freeFlowTravelTime?: number; // minutes
  congestedTravelTime?: number; // minutes calculated via BPR
  floodDepthMm?: number; // flood water depth on road
  floodMaxTolerableMm?: number; // max mm before impassable (e.g. 150mm)
  isClosed?: boolean;
}

export interface CityConfig {
  size: 'small' | 'medium' | 'large';
  seed: number;
  gridRows?: number;
  gridCols?: number;
  hospitalCount?: number;
  schoolCount?: number;
  substationCount?: number;
  residentialCount?: number;
  rainfallIntensityMmPerHour?: number; // default 0 mm/h
}

export interface CityParcel {
  id: string;
  row: number;
  col: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  parcelType: 'residential' | 'hospital' | 'school' | 'utility' | 'mixed' | 'open';
}

export interface GraphData {
  nodes: Record<string, UrbanNode>;
  edges: Record<string, UrbanEdge>;
  floodZones: Record<string, FloodZoneArea>;
  bounds: {
    width: number;
    height: number;
  };
  config: CityConfig;
  parcels?: CityParcel[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  componentId: string;
  message: string;
}

export interface ValidationReport {
  isValid: boolean;
  totalNodes: number;
  totalEdges: number;
  roadNetworkConnected: boolean;
  issues: ValidationIssue[];
  stats: {
    intersections: number;
    roads: number;
    hospitals: number;
    schools: number;
    residentialZones: number;
    busStops: number;
    substations: number;
    transformers: number;
    drainageNodes: number;
    floodZones: number;
    totalPopulation: number;
    totalPowerDemandKW: number;
    totalPowerCapacityKW: number;
  };
}
