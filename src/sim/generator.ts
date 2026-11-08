import {
  CityConfig,
  CityParcel,
  DrainageNode,
  FloodRiskLevel,
  FloodZoneArea,
  GraphData,
  HospitalNode,
  IntersectionNode,
  ResidentialZoneNode,
  SchoolNode,
  SubstationNode,
  TransformerNode,
  UrbanEdge,
  UrbanNode,
} from '../types/graph';
import { distance, findNearestIntersection, findRoadComponents } from './graphUtils';
import { SeededRNG } from './rng';

export function generateCity(seed: number, customConfig?: Partial<CityConfig>): GraphData {
  const rng = new SeededRNG(seed);
  const size = customConfig?.size || 'medium';

  let width = 1400;
  let height = 1000;
  let gridCols = 7;
  let gridRows = 7;
  let hospitalCount = 4;
  let schoolCount = 5;
  let substationCount = 2;
  let residentialCount = 28;
  let floodZoneCount = 3;

  if (size === 'small') {
    width = 1050;
    height = 800;
    gridCols = 5;
    gridRows = 5;
    hospitalCount = 3;
    schoolCount = 3;
    substationCount = 1;
    residentialCount = 16;
    floodZoneCount = 2;
  } else if (size === 'large') {
    width = 1800;
    height = 1250;
    gridCols = 9;
    gridRows = 9;
    hospitalCount = 5;
    schoolCount = 7;
    substationCount = 3;
    residentialCount = 45;
    floodZoneCount = 4;
  }

  const config: CityConfig = {
    size,
    seed,
    gridCols,
    gridRows,
    hospitalCount,
    schoolCount,
    substationCount,
    residentialCount,
    rainfallIntensityMmPerHour: customConfig?.rainfallIntensityMmPerHour ?? 0,
    ...customConfig,
  };

  const nodes: Record<string, UrbanNode> = {};
  const edges: Record<string, UrbanEdge> = {};
  const floodZones: Record<string, FloodZoneArea> = {};

  // 1. Grid of Intersections with Jitter and Elevation model
  const paddingX = width * 0.1;
  const paddingY = height * 0.12;
  const colSpacing = (width - paddingX * 2) / (gridCols - 1);
  const rowSpacing = (height - paddingY * 2) / (gridRows - 1);

  // Identify main arterial corridors (e.g. 2 horizontal, 2 vertical)
  const mainCol1 = Math.floor(gridCols * 0.33);
  const mainCol2 = Math.floor(gridCols * 0.67);
  const mainRow1 = Math.floor(gridRows * 0.33);
  const mainRow2 = Math.floor(gridRows * 0.67);

  const intersectionGrid: string[][] = [];

  for (let r = 0; r < gridRows; r++) {
    intersectionGrid[r] = [];
    for (let c = 0; c < gridCols; c++) {
      const id = `int_${r}_${c}`;
      const isMainIntersection =
        (c === mainCol1 || c === mainCol2) && (r === mainRow1 || r === mainRow2);
      const isArterialCorridor =
        c === mainCol1 || c === mainCol2 || r === mainRow1 || r === mainRow2;

      // Jitter (smaller jitter on main corridors to preserve arterials)
      const maxJitter = isArterialCorridor ? colSpacing * 0.08 : colSpacing * 0.18;
      const jx = rng.float(-maxJitter, maxJitter);
      const jy = rng.float(-maxJitter, maxJitter);

      const x = Math.round(paddingX + c * colSpacing + jx);
      const y = Math.round(paddingY + r * rowSpacing + jy);

      // Terrain elevation: higher at top-left, sloping down to low basin at bottom-right
      const normalizedElevation =
        1.0 - 0.5 * (x / width) - 0.5 * (y / height) + 0.1 * Math.sin((x + y) / 180);
      const elevation = Math.round(Math.max(2, normalizedElevation * 45));

      const intersectionNode: IntersectionNode = {
        id,
        type: 'Intersection',
        name: isMainIntersection
          ? `Main Junction ${String.fromCharCode(65 + r)}${c + 1}`
          : `Intersection ${String.fromCharCode(65 + r)}${c + 1}`,
        position: { x, y },
        capacity: isMainIntersection ? 3200 : 1600, // vehicles per hour throughput
        currentLoad: 0,
        failureThreshold: 1.25,
        status: 'healthy',
        dependencies: [],
        isMainIntersection,
        hasTrafficSignal: isArterialCorridor,
        trafficSignalWorking: isArterialCorridor,
        elevation,
      };

      nodes[id] = intersectionNode;
      intersectionGrid[r][c] = id;
    }
  }

  // 2. Road Edges Generation
  let roadIdCounter = 1;

  // Helper to add road edge
  const addRoadEdge = (
    fromId: string,
    toId: string,
    isMainRoad: boolean
  ): UrbanEdge => {
    const fromNode = nodes[fromId];
    const toNode = nodes[toId];
    const distMeters = Math.round(distance(fromNode.position, toNode.position) * 6); // scale 1 SVG px = 6m (150px block = 900m)

    const speed = isMainRoad ? 50 : 30; // km/h (arterial 50, local 30)
    const freeFlowMinutes = (distMeters / 1000 / speed) * 60;
    const capacity = isMainRoad ? 2200 : 900; // veh/hr capacity (arterial 2200, local 900)

    const edgeId = `road_${roadIdCounter++}`;
    const edge: UrbanEdge = {
      id: edgeId,
      from: fromId,
      to: toId,
      type: 'ROAD',
      length: distMeters,
      capacity,
      currentLoad: 0,
      failureThreshold: 1.15,
      status: 'healthy',
      roadType: isMainRoad ? 'main' : 'local',
      lanes: isMainRoad ? 4 : 2,
      freeFlowSpeed: speed,
      freeFlowTravelTime: freeFlowMinutes,
      congestedTravelTime: freeFlowMinutes,
      floodDepthMm: 0,
      floodMaxTolerableMm: isMainRoad ? 200 : 130, // main roads have better clearance
      isClosed: false,
    };

    edges[edgeId] = edge;
    return edge;
  };

  // Add horizontal roads
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols - 1; c++) {
      const isMain = r === mainRow1 || r === mainRow2;
      // Main roads are always built. Local roads have 92% build chance to leave natural breaks
      if (isMain || rng.chance(0.92)) {
        addRoadEdge(intersectionGrid[r][c], intersectionGrid[r][c + 1], isMain);
      }
    }
  }

  // Add vertical roads
  for (let c = 0; c < gridCols; c++) {
    for (let r = 0; r < gridRows - 1; r++) {
      const isMain = c === mainCol1 || c === mainCol2;
      if (isMain || rng.chance(0.92)) {
        addRoadEdge(intersectionGrid[r][c], intersectionGrid[r + 1][c], isMain);
      }
    }
  }

  // Guaranteed Road Network Connectivity (BFS Check & Auto-Repair)
  const intersectionsMap: Record<string, IntersectionNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type === 'Intersection') {
      intersectionsMap[id] = node as IntersectionNode;
    }
  }

  let components = findRoadComponents(intersectionsMap, edges, false);
  let repairAttempts = 0;

  while (components.length > 1 && repairAttempts < 20) {
    repairAttempts++;
    const primaryComponent = components[0];
    const isolatedComponent = components[1];

    // Find closest pair between primary and isolated
    let bestDist = Infinity;
    let bestU = primaryComponent[0];
    let bestV = isolatedComponent[0];

    for (const u of primaryComponent) {
      for (const v of isolatedComponent) {
        const d = distance(nodes[u].position, nodes[v].position);
        if (d < bestDist) {
          bestDist = d;
          bestU = u;
          bestV = v;
        }
      }
    }

    addRoadEdge(bestU, bestV, false);
    components = findRoadComponents(intersectionsMap, edges, false);
  }

  // 2.5 Construct City Block Parcels with strict setbacks
  interface InternalBlock {
    id: string;
    row: number;
    col: number;
    tl: IntersectionNode;
    tr: IntersectionNode;
    bl: IntersectionNode;
    br: IntersectionNode;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
    cx: number;
    cy: number;
    setbackX: number;
    setbackY: number;
    parcelMinX: number;
    parcelMaxX: number;
    parcelMinY: number;
    parcelMaxY: number;
    parcelWidth: number;
    parcelHeight: number;
    isArterial: boolean;
    elevation: number;
    assignedFacility?: 'hospital' | 'school' | 'substation' | 'utility' | 'drainage' | 'residential';
  }

  const blocks: InternalBlock[] = [];
  for (let r = 0; r < gridRows - 1; r++) {
    for (let c = 0; c < gridCols - 1; c++) {
      const tl = nodes[intersectionGrid[r][c]] as IntersectionNode;
      const tr = nodes[intersectionGrid[r][c + 1]] as IntersectionNode;
      const bl = nodes[intersectionGrid[r + 1][c]] as IntersectionNode;
      const br = nodes[intersectionGrid[r + 1][c + 1]] as IntersectionNode;

      const minX = Math.max(tl.position.x, bl.position.x);
      const maxX = Math.min(tr.position.x, br.position.x);
      const minY = Math.max(tl.position.y, tr.position.y);
      const maxY = Math.min(bl.position.y, br.position.y);

      const width = Math.max(60, maxX - minX);
      const height = Math.max(60, maxY - minY);
      const cx = Math.round((minX + maxX) / 2);
      const cy = Math.round((minY + maxY) / 2);

      // Safe street setback: ~18% of dimension, minimum 18px
      const setbackX = Math.round(Math.max(18, width * 0.18));
      const setbackY = Math.round(Math.max(18, height * 0.18));

      const isArterial =
        r === mainRow1 - 1 ||
        r === mainRow1 ||
        r === mainRow2 - 1 ||
        r === mainRow2 ||
        c === mainCol1 - 1 ||
        c === mainCol1 ||
        c === mainCol2 - 1 ||
        c === mainCol2;

      const avgElevation = Math.round((tl.elevation + tr.elevation + bl.elevation + br.elevation) / 4);

      blocks.push({
        id: `block_${r}_${c}`,
        row: r,
        col: c,
        tl,
        tr,
        bl,
        br,
        minX,
        maxX,
        minY,
        maxY,
        width,
        height,
        cx,
        cy,
        setbackX,
        setbackY,
        parcelMinX: minX + setbackX,
        parcelMaxX: maxX - setbackX,
        parcelMinY: minY + setbackY,
        parcelMaxY: maxY - setbackY,
        parcelWidth: width - setbackX * 2,
        parcelHeight: height - setbackY * 2,
        isArterial,
        elevation: avgElevation,
      });
    }
  }

  // 3. Flood Zones (placed in low elevation basin blocks)
  const lowElevationBlocks = [...blocks].sort((a, b) => a.elevation - b.elevation);
  const chosenFloodBlocks = lowElevationBlocks.slice(0, floodZoneCount);
  const floodRiskLevels: FloodRiskLevel[] = ['severe', 'moderate', 'low'];

  chosenFloodBlocks.forEach((block, idx) => {
    const floodId = `flood_zone_${idx + 1}`;
    const risk = floodRiskLevels[idx % floodRiskLevels.length];
    const radius = Math.round(Math.min(block.width, block.height) * 0.72);

    const fZone: FloodZoneArea = {
      id: floodId,
      type: 'FloodZone',
      name: `${risk.toUpperCase()} Flood Basin #${idx + 1}`,
      position: {
        x: block.cx,
        y: block.cy,
      },
      capacity: risk === 'severe' ? 3000 : risk === 'moderate' ? 2000 : 1200,
      currentLoad: 0,
      failureThreshold: 1.0,
      status: 'healthy',
      dependencies: [],
      riskLevel: risk,
      radius,
      waterLevelMm: 0,
      criticalThresholdMm: risk === 'severe' ? 120 : risk === 'moderate' ? 170 : 220,
      drainageRateLps: risk === 'severe' ? 600 : 900,
    };

    floodZones[floodId] = fZone;
  });

  // 4. Drainage Nodes (constricted within stormwater utility easements)
  const drainageCount = Math.min(8, Math.max(4, Math.floor(gridCols * 0.8)));
  for (let i = 0; i < drainageCount; i++) {
    const drainId = `drain_${i + 1}`;
    const targetBlock = lowElevationBlocks[i % lowElevationBlocks.length];
    const targetInter = targetBlock.br;
    const pos = {
      x: Math.round(targetBlock.parcelMaxX - 10),
      y: Math.round(targetBlock.parcelMaxY - 10),
    };

    const drainageNode: DrainageNode = {
      id: drainId,
      type: 'DrainageNode',
      name: `Stormwater Station #${i + 1}`,
      position: pos,
      capacity: rng.int(1200, 2400),
      currentLoad: 0,
      failureThreshold: 1.2,
      status: 'healthy',
      dependencies: [],
      elevation: targetInter.elevation,
      drainageCapacityLps: rng.int(1200, 2400),
      servicedRoadIds: [],
      servicedZoneIds: [],
      backup: {
        type: 'drainage_pump',
        capacity: 1000,
        durationHours: 12,
        active: false,
      },
    };

    nodes[drainId] = drainageNode;

    edges[`drain_edge_${i + 1}`] = {
      id: `drain_edge_${i + 1}`,
      from: drainId,
      to: targetInter.id,
      type: 'DRAINS',
      length: Math.round(distance(pos, targetInter.position) * 4),
      capacity: drainageNode.capacity,
      currentLoad: 0,
      failureThreshold: 1.0,
      status: 'healthy',
    };
  }

  // 5. Substations & Transformers (Electrical Network)
  const substationIds: string[] = [];
  const transformerNodes: TransformerNode[] = [];

  for (let s = 0; s < substationCount; s++) {
    const subId = `substation_${s + 1}`;
    substationIds.push(subId);

    const subBlock =
      s === 0
        ? blocks[0]
        : s === 1
        ? blocks[blocks.length - 1]
        : blocks[gridCols - 2];

    subBlock.assignedFacility = 'substation';

    const subPos = {
      x: s === 0 ? subBlock.parcelMinX + 12 : subBlock.parcelMaxX - 12,
      y: s === 1 ? subBlock.parcelMaxY - 12 : subBlock.parcelMinY + 12,
    };

    const subNode: SubstationNode = {
      id: subId,
      type: 'Substation',
      name: `Grid Substation ${String.fromCharCode(65 + s)} (${s === 0 ? 'West' : s === 1 ? 'East' : 'Central'})`,
      position: subPos,
      capacity: 35000,
      currentLoad: 0,
      failureThreshold: 1.2,
      status: 'healthy',
      dependencies: [],
      voltageKV: 132,
      transformerIds: [],
      backup: {
        type: 'battery',
        capacity: 8000,
        durationHours: 6,
        active: false,
      },
    };

    nodes[subId] = subNode;

    // Distribute 2-3 transformers per substation
    const transformersPerSub = Math.max(2, Math.floor(6 / substationCount));
    for (let t = 0; t < transformersPerSub; t++) {
      const transId = `transformer_${s + 1}_${t + 1}`;
      subNode.transformerIds.push(transId);

      // Select distinct block in substation's quadrant/sector
      const step = Math.max(1, Math.floor(blocks.length / (substationCount * transformersPerSub)));
      const blockIndex = (s * transformersPerSub * step + t * step + 1) % blocks.length;
      const targetBlock = blocks[blockIndex];

      // Constrict transformer to the top-left utility corner of the parcel
      const tPos = {
        x: Math.round(targetBlock.parcelMinX + 12),
        y: Math.round(targetBlock.parcelMinY + 12),
      };

      const transNode: TransformerNode = {
        id: transId,
        type: 'Transformer',
        name: `Distribution Transformer TX-${s + 1}.${t + 1}`,
        position: tPos,
        capacity: 10000,
        currentLoad: 0,
        failureThreshold: 1.25,
        status: 'healthy',
        dependencies: [subId],
        substationId: subId,
        servicedConsumerIds: [],
      };

      nodes[transId] = transNode;
      transformerNodes.push(transNode);

      edges[`power_feed_${subId}_${transId}`] = {
        id: `power_feed_${subId}_${transId}`,
        from: subId,
        to: transId,
        type: 'POWER_SUPPLY',
        length: Math.round(distance(subPos, tPos) * 4),
        capacity: transNode.capacity,
        currentLoad: 0,
        failureThreshold: 1.2,
        status: 'healthy',
      };
    }
  }

  // 6. Hospitals (Constricted at center of designated arterial blocks)
  const hospitalTiers: Array<{
    name: string;
    tier: 'Tertiary' | 'Secondary' | 'Primary';
    beds: number;
    demand: number;
    powerKW: number;
    hasGenerator: boolean;
    duration: number;
  }> = [
    {
      name: 'Metropolitan General Hospital',
      tier: 'Tertiary',
      beds: 500,
      demand: 280,
      powerKW: 450,
      hasGenerator: true,
      duration: 24,
    },
    {
      name: 'St. Jude District Hospital',
      tier: 'Secondary',
      beds: 240,
      demand: 140,
      powerKW: 220,
      hasGenerator: true,
      duration: 16,
    },
    {
      name: 'Riverside Community Hospital',
      tier: 'Secondary',
      beds: 180,
      demand: 100,
      powerKW: 160,
      hasGenerator: true,
      duration: 12,
    },
    {
      name: 'Greenfield Urgent Care Clinic',
      tier: 'Primary',
      beds: 75,
      demand: 50,
      powerKW: 80,
      hasGenerator: false,
      duration: 4,
    },
    {
      name: 'Northgate Health Pavilion',
      tier: 'Primary',
      beds: 60,
      demand: 40,
      powerKW: 60,
      hasGenerator: false,
      duration: 4,
    },
  ];

  const arterialBlocks = blocks.filter((b) => b.isArterial && !b.assignedFacility);
  const shuffledArterials = rng.shuffle(arterialBlocks.length > 0 ? arterialBlocks : blocks);

  for (let h = 0; h < hospitalCount; h++) {
    const tierConfig = hospitalTiers[h % hospitalTiers.length];
    const hospId = `hospital_${h + 1}`;
    const targetBlock = shuffledArterials[h % shuffledArterials.length];
    targetBlock.assignedFacility = 'hospital';

    // Strictly centered inside the parcel
    const hospPos = {
      x: targetBlock.cx,
      y: targetBlock.cy,
    };

    // Arterial corner intersection for direct emergency vehicle access
    const nearestInter = [targetBlock.tl, targetBlock.tr, targetBlock.bl, targetBlock.br].sort(
      (a, b) => (b.isMainIntersection ? 1 : 0) - (a.isMainIntersection ? 1 : 0)
    )[0];

    const nearestTx = transformerNodes.reduce((prev, curr) =>
      distance(hospPos, curr.position) < distance(hospPos, prev.position) ? curr : prev
    );

    const hospitalNode: HospitalNode = {
      id: hospId,
      type: 'Hospital',
      name: tierConfig.name,
      position: hospPos,
      capacity: tierConfig.beds,
      currentLoad: 0,
      failureThreshold: 1.05,
      status: 'healthy',
      dependencies: [nearestTx.id],
      tier: tierConfig.tier,
      beds: tierConfig.beds,
      emergencyDemand: tierConfig.demand,
      hasBackupGenerator: tierConfig.hasGenerator,
      nearestIntersectionId: nearestInter.id,
      backup: tierConfig.hasGenerator
        ? {
            type: 'generator',
            capacity: tierConfig.powerKW,
            durationHours: tierConfig.duration,
            active: false,
            fuelRemaining: 100,
          }
        : undefined,
    };

    nodes[hospId] = hospitalNode;
    nearestTx.servicedConsumerIds.push(hospId);

    // ACCESS road link
    edges[`access_hosp_${h + 1}`] = {
      id: `access_hosp_${h + 1}`,
      from: hospId,
      to: nearestInter.id,
      type: 'ACCESS',
      length: Math.round(distance(hospPos, nearestInter.position) * 4),
      capacity: 1000,
      currentLoad: 0,
      failureThreshold: 1.2,
      status: 'healthy',
    };

    // POWER_SUPPLY link
    edges[`power_hosp_${h + 1}`] = {
      id: `power_hosp_${h + 1}`,
      from: nearestTx.id,
      to: hospId,
      type: 'POWER_SUPPLY',
      length: Math.round(distance(nearestTx.position, hospPos) * 4),
      capacity: tierConfig.powerKW * 1.5,
      currentLoad: tierConfig.powerKW,
      failureThreshold: 1.2,
      status: 'healthy',
    };
  }

  // 7. Schools (Constricted at center of designated civic blocks)
  const schoolTypes: Array<{ type: 'Elementary' | 'High School' | 'Community College'; cap: number; power: number }> = [
    { type: 'Elementary', cap: 500, power: 75 },
    { type: 'High School', cap: 1200, power: 150 },
    { type: 'Elementary', cap: 450, power: 70 },
    { type: 'Community College', cap: 2200, power: 300 },
    { type: 'High School', cap: 1000, power: 140 },
    { type: 'Elementary', cap: 400, power: 65 },
    { type: 'High School', cap: 900, power: 130 },
  ];

  const civicCandidateBlocks = blocks.filter((b) => !b.assignedFacility);
  const shuffledCivic = rng.shuffle(civicCandidateBlocks.length > 0 ? civicCandidateBlocks : blocks);

  for (let s = 0; s < schoolCount; s++) {
    const sConf = schoolTypes[s % schoolTypes.length];
    const sId = `school_${s + 1}`;
    const targetBlock = shuffledCivic[s % shuffledCivic.length];
    targetBlock.assignedFacility = 'school';

    // Strictly centered inside the parcel
    const sPos = {
      x: targetBlock.cx,
      y: targetBlock.cy,
    };

    const nearestInter = targetBlock.tl;

    const nearestTx = transformerNodes.reduce((prev, curr) =>
      distance(sPos, curr.position) < distance(sPos, prev.position) ? curr : prev
    );

    const schoolNode: SchoolNode = {
      id: sId,
      type: 'School',
      name: `${sConf.type} Campus #${s + 1}`,
      position: sPos,
      capacity: sConf.cap,
      currentLoad: Math.round(sConf.cap * 0.85),
      failureThreshold: 1.2,
      status: 'healthy',
      dependencies: [nearestTx.id],
      schoolType: sConf.type,
      studentCapacity: sConf.cap,
      nearestIntersectionId: nearestInter.id,
    };

    nodes[sId] = schoolNode;
    nearestTx.servicedConsumerIds.push(sId);

    // ACCESS link
    edges[`access_school_${s + 1}`] = {
      id: `access_school_${s + 1}`,
      from: sId,
      to: nearestInter.id,
      type: 'ACCESS',
      length: Math.round(distance(sPos, nearestInter.position) * 4),
      capacity: 800,
      currentLoad: 0,
      failureThreshold: 1.2,
      status: 'healthy',
    };

    // POWER link
    edges[`power_school_${s + 1}`] = {
      id: `power_school_${s + 1}`,
      from: nearestTx.id,
      to: sId,
      type: 'POWER_SUPPLY',
      length: Math.round(distance(nearestTx.position, sPos) * 4),
      capacity: sConf.power * 1.5,
      currentLoad: sConf.power,
      failureThreshold: 1.2,
      status: 'healthy',
    };
  }

  // 8. Bus Stops (Snapped directly along road edges with sidewalk/curb offset)
  const busStopCount = Math.min(18, Math.max(8, Math.floor(gridCols * gridRows * 0.35)));
  const roadEdgesList = Object.values(edges).filter((e) => e.type === 'ROAD');
  const busEligibleRoads = rng.shuffle(
    roadEdgesList.filter((e) => e.roadType === 'main').concat(roadEdgesList)
  );

  const busStopNodes: any[] = [];

  for (let bIdx = 0; bIdx < busStopCount; bIdx++) {
    const busId = `bus_stop_${bIdx + 1}`;
    const road = busEligibleRoads[bIdx % busEligibleRoads.length];
    const uNode = nodes[road.from];
    const vNode = nodes[road.to];

    const dx = vNode.position.x - uNode.position.x;
    const dy = vNode.position.y - uNode.position.y;
    const roadLen = Math.max(1, Math.sqrt(dx * dx + dy * dy));

    // Position along road segment: 35% or 65%
    const t = bIdx % 2 === 0 ? 0.35 : 0.65;
    const mx = uNode.position.x + t * dx;
    const my = uNode.position.y + t * dy;

    // Perpendicular curb offset (8px away from centerline onto shoulder/sidewalk)
    const side = bIdx % 2 === 0 ? 1 : -1;
    const nx = (-dy / roadLen) * 8 * side;
    const ny = (dx / roadLen) * 8 * side;

    const pos = {
      x: Math.round(mx + nx),
      y: Math.round(my + ny),
    };

    const nearestInterId = t < 0.5 ? uNode.id : vNode.id;

    const busNode = {
      id: busId,
      type: 'BusStop',
      name: `Transit Stop #${bIdx + 1} (${nodes[nearestInterId]?.name || 'Avenue'})`,
      position: pos,
      capacity: 250,
      currentLoad: 40,
      failureThreshold: 1.5,
      status: 'healthy',
      dependencies: [],
      routeIds: [`Line ${(bIdx % 4) + 1}`, `Line ${((bIdx + 2) % 4) + 1}`],
      connectedRoadId: road.id,
      nearestIntersectionId: nearestInterId,
    };

    nodes[busId] = busNode as any;
    busStopNodes.push(busNode);

    // ACCESS link to road/intersection
    edges[`access_bus_${bIdx + 1}`] = {
      id: `access_bus_${bIdx + 1}`,
      from: busId,
      to: nearestInterId,
      type: 'ACCESS',
      length: 25,
      capacity: 500,
      currentLoad: 0,
      failureThreshold: 1.5,
      status: 'healthy',
    };
  }

  // 9. Residential Zones (Constricted strictly within block parcels with road clearance)
  const densities: Array<{ density: 'low' | 'medium' | 'high'; popRange: [number, number]; radius: number }> = [
    { density: 'high', popRange: [2800, 4800], radius: 36 },
    { density: 'medium', popRange: [1200, 2400], radius: 28 },
    { density: 'low', popRange: [400, 950], radius: 22 },
  ];

  // Prioritize blocks without major facilities
  const pureResidentialBlocks = blocks.filter((b) => !b.assignedFacility);
  const residentialBlockPool = pureResidentialBlocks.length >= residentialCount
    ? pureResidentialBlocks
    : pureResidentialBlocks.concat(blocks.filter((b) => b.assignedFacility !== undefined));

  for (let z = 0; z < residentialCount; z++) {
    const zoneId = `zone_${z + 1}`;
    const block = residentialBlockPool[z % residentialBlockPool.length];
    const isCoLocated = block.assignedFacility !== undefined && block.assignedFacility !== 'residential';

    // Center in block with zero random jitter to guarantee no road overlap
    const posX = block.cx;
    const posY = isCoLocated
      ? Math.round(block.cy + block.parcelHeight * 0.22)
      : block.cy;

    // Downtown center has higher density
    const distToCenter = distance({ x: posX, y: posY }, { x: width / 2, y: height / 2 });
    const densityChoice =
      distToCenter < width * 0.22
        ? densities[0]
        : distToCenter < width * 0.42
        ? densities[1]
        : densities[2];

    // Strictly constrict radius to fit comfortably inside the parcel boundaries
    const maxAllowedRadius = isCoLocated
      ? Math.floor(block.parcelHeight * 0.22)
      : Math.floor(Math.min(block.parcelWidth, block.parcelHeight) * 0.38);

    const radius = Math.max(16, Math.min(densityChoice.radius, maxAllowedRadius));

    const population = rng.int(densityChoice.popRange[0], densityChoice.popRange[1]);
    const powerDemandKW = Math.round(population * 0.65);

    const nearestInter = findNearestIntersection({ x: posX, y: posY }, intersectionsMap)!;

    const nearestTx = transformerNodes.reduce((prev, curr) =>
      distance({ x: posX, y: posY }, curr.position) < distance({ x: posX, y: posY }, prev.position)
        ? curr
        : prev
    );

    // Nearest bus stop
    let nearestBus: any = null;
    let minBusDist = Infinity;
    for (const b of busStopNodes) {
      const d = distance({ x: posX, y: posY }, b.position);
      if (d < minBusDist) {
        minBusDist = d;
        nearestBus = b;
      }
    }

    const zoneNode: ResidentialZoneNode = {
      id: zoneId,
      type: 'ResidentialZone',
      name: `Neighborhood Sector ${String.fromCharCode(65 + (z % 26))}${Math.floor(z / 26) + 1}`,
      position: { x: posX, y: posY },
      capacity: population * 1.2,
      currentLoad: population,
      failureThreshold: 1.15,
      status: 'healthy',
      dependencies: [nearestTx.id],
      population,
      density: densityChoice.density,
      radius,
      elevation: nearestInter.elevation,
      nearestIntersectionId: nearestInter.id,
      nearestBusStopId: nearestBus ? nearestBus.id : undefined,
    };

    nodes[zoneId] = zoneNode;
    nearestTx.servicedConsumerIds.push(zoneId);

    // ACCESS road link
    edges[`access_zone_${z + 1}`] = {
      id: `access_zone_${z + 1}`,
      from: zoneId,
      to: nearestInter.id,
      type: 'ACCESS',
      length: Math.round(distance(zoneNode.position, nearestInter.position) * 4),
      capacity: 1200,
      currentLoad: 0,
      failureThreshold: 1.25,
      status: 'healthy',
    };

    // POWER_SUPPLY link
    edges[`power_zone_${z + 1}`] = {
      id: `power_zone_${z + 1}`,
      from: nearestTx.id,
      to: zoneId,
      type: 'POWER_SUPPLY',
      length: Math.round(distance(nearestTx.position, zoneNode.position) * 4),
      capacity: powerDemandKW * 1.4,
      currentLoad: powerDemandKW,
      failureThreshold: 1.2,
      status: 'healthy',
    };
  }

  // 10. Wire Traffic Signals to Transformers
  for (const [, node] of Object.entries(nodes)) {
    if (node.type === 'Intersection') {
      const inter = node as IntersectionNode;
      if (inter.hasTrafficSignal) {
        const nearestTx = transformerNodes.reduce((prev, curr) =>
          distance(inter.position, curr.position) < distance(inter.position, prev.position)
            ? curr
            : prev
        );
        inter.dependencies.push(nearestTx.id);
        nearestTx.servicedConsumerIds.push(inter.id);

        edges[`power_signal_${inter.id}`] = {
          id: `power_signal_${inter.id}`,
          from: nearestTx.id,
          to: inter.id,
          type: 'POWER_SUPPLY',
          length: Math.round(distance(nearestTx.position, inter.position) * 4),
          capacity: 25,
          currentLoad: 15, // 15 kW for signal systems
          failureThreshold: 1.2,
          status: 'healthy',
        };
      }
    }
  }

  // Sizing transformer capacity dynamically to ensure clean headroom
  for (const tx of transformerNodes) {
    let connectedDemand = 0;
    for (const consId of tx.servicedConsumerIds) {
      const consNode = nodes[consId];
      if (consNode.type === 'ResidentialZone') {
        connectedDemand += (consNode as ResidentialZoneNode).population * 0.65;
      } else if (consNode.type === 'Hospital') {
        connectedDemand += 300;
      } else if (consNode.type === 'School') {
        connectedDemand += 120;
      } else if (consNode.type === 'Intersection') {
        connectedDemand += 15;
      }
    }
    tx.capacity = Math.round(Math.max(5000, connectedDemand * 1.45));
    tx.currentLoad = Math.round(connectedDemand);
  }

  // 11. Compile City Parcels for Map Rendering
  const parcels: CityParcel[] = blocks.map((b) => ({
    id: b.id,
    row: b.row,
    col: b.col,
    minX: b.parcelMinX,
    maxX: b.parcelMaxX,
    minY: b.parcelMinY,
    maxY: b.parcelMaxY,
    width: b.parcelWidth,
    height: b.parcelHeight,
    cx: b.cx,
    cy: b.cy,
    parcelType:
      b.assignedFacility === 'hospital'
        ? 'hospital'
        : b.assignedFacility === 'school'
        ? 'school'
        : b.assignedFacility === 'substation'
        ? 'utility'
        : 'residential',
  }));

  return {
    nodes,
    edges,
    floodZones,
    bounds: { width, height },
    config,
    parcels,
  };
}
