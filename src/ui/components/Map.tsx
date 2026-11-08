import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  GraphData,
  HospitalNode,
  IntersectionNode,
  ResidentialZoneNode,
  TransformerNode,
  UrbanEdge,
  UrbanNode,
} from '../../types/graph';
import { SimulationResult } from '../../types/sim';
import { LayerVisibility } from './LayerControls';
import { Maximize2, Minus, Plus, X } from 'lucide-react';

interface MapProps {
  graph: GraphData;
  simulationResult: SimulationResult;
  layers: LayerVisibility;
  selectedId: string | null;
  onSelect: (item: { type: 'node' | 'edge'; data: UrbanNode | UrbanEdge } | null) => void;
  failingIds?: string[]; // IDs actively failing in current cascade step
  onConstructBuilding?: (
    facilityType: 'Hospital' | 'School' | 'ResidentialZone' | 'DrainageNode',
    position: { x: number; y: number },
    parcelId?: string
  ) => void;
}

export const Map: React.FC<MapProps> = ({
  graph,
  simulationResult,
  layers,
  selectedId,
  onSelect,
  failingIds = [],
  onConstructBuilding,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Pan and Zoom transform state
  const [transform, setTransform] = useState<{ x: number; y: number; k: number }>({
    x: 40,
    y: 30,
    k: 0.85,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragDistRef = useRef<number>(0);

  // Build Mode & Placement State
  const [isBuildMode, setIsBuildMode] = useState(false);
  const [selectedBuildType, setSelectedBuildType] = useState<
    'Hospital' | 'School' | 'ResidentialZone' | 'DrainageNode'
  >('Hospital');
  const [hoveredParcelId, setHoveredParcelId] = useState<string | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<{ x: number; y: number } | null>(null);
  const [toastNotice, setToastNotice] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const [quickBuildPopover, setQuickBuildPopover] = useState<{
    parcelId: string;
    parcelName: string;
    center: { x: number; y: number };
    screenPos: { x: number; y: number };
  } | null>(null);

  // Hover Tooltip state
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    subtitle: string;
    badge: string;
    badgeColor: string;
    details: Array<{ label: string; value: string }>;
  } | null>(null);

  // Auto-fit initial view
  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const scaleX = (clientWidth - 80) / graph.bounds.width;
    const scaleY = (clientHeight - 80) / graph.bounds.height;
    const k = Math.min(scaleX, scaleY, 1.2);
    const x = (clientWidth - graph.bounds.width * k) / 2;
    const y = (clientHeight - graph.bounds.height * k) / 2;
    setTransform({ x, y, k });
  }, [graph.bounds]);

  useEffect(() => {
    fitToScreen();
  }, [fitToScreen]);

  // Coordinate Conversion Helpers
  const getWorldPos = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transform.x) / transform.k,
      y: (clientY - rect.top - transform.y) / transform.k,
    };
  };

  const findParcelAt = (x: number, y: number) => {
    if (!graph.parcels) return undefined;
    return graph.parcels.find(
      (p) => x >= p.minX && x <= p.maxX && y >= p.minY && y <= p.maxY
    );
  };

  const placeBuildingAt = (
    type: 'Hospital' | 'School' | 'ResidentialZone' | 'DrainageNode',
    worldPos: { x: number; y: number },
    parcelId?: string
  ) => {
    if (!onConstructBuilding) return;
    onConstructBuilding(type, worldPos, parcelId);
    setToastNotice({
      text: `✨ Placed New ${type} at (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})${
        parcelId ? ` in Parcel ${parcelId}` : ''
      }`,
      type: 'success',
    });
    setQuickBuildPopover(null);
    setTimeout(() => setToastNotice(null), 3500);
  };

  // Handle Mouse Drag for Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    dragDistRef.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      dragDistRef.current += Math.hypot(e.movementX, e.movementY);
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    }
    if (isBuildMode && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - transform.x) / transform.k;
      const worldY = (e.clientY - rect.top - transform.y) / transform.k;
      setMouseWorldPos({ x: worldX, y: worldY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle Zoom via Wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newK = Math.max(0.3, Math.min(3.5, transform.k * zoomFactor));

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - (mouseX - transform.x) * (newK / transform.k);
    const newY = mouseY - (mouseY - transform.y) * (newK / transform.k);

    setTransform({ x: newX, y: newY, k: newK });
  };

  const zoomIn = () => {
    setTransform((prev) => ({
      ...prev,
      k: Math.min(3.5, prev.k * 1.2),
      x: prev.x - 40,
      y: prev.y - 30,
    }));
  };

  const zoomOut = () => {
    setTransform((prev) => ({
      ...prev,
      k: Math.max(0.3, prev.k / 1.2),
      x: prev.x + 40,
      y: prev.y + 30,
    }));
  };

  // Road styling helper - calibrated for realistic free-flow
  const getRoadColor = (edge: UrbanEdge) => {
    if (edge.isClosed || edge.status === 'failed') return '#ef4444';
    const ratio = simulationResult.roadCongestionRatios[edge.id] || 0;
    if (ratio >= 1.0) return '#f43f5e'; // congested / gridlocked
    if (ratio >= 0.75) return '#f59e0b'; // moderate
    return '#10b981'; // free flow (< 75% capacity)
  };

  // Helper for Status Badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return { text: 'HEALTHY', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
      case 'overloaded':
        return { text: 'OVERLOADED', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
      case 'damaged':
        return { text: 'DAMAGED', color: 'bg-rose-500/20 text-rose-400 border-rose-500/40' };
      case 'failed':
        return { text: 'FAILED', color: 'bg-red-950 text-rose-300 border-rose-600' };
      default:
        return { text: status.toUpperCase(), color: 'bg-slate-700 text-slate-300 border-slate-600' };
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-slate-950 select-none ${
        isBuildMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onClick={(e) => {
        if (dragDistRef.current > 5) return;
        if (isBuildMode) {
          const worldPos = getWorldPos(e.clientX, e.clientY);
          const parcel = findParcelAt(worldPos.x, worldPos.y);
          placeBuildingAt(selectedBuildType, worldPos, parcel?.id);
          return;
        }
        if (e.target === svgRef.current) {
          onSelect(null);
          setQuickBuildPopover(null);
        }
      }}
    >
      {/* Floating Place Building Mode HUD */}
      <div className="absolute top-4 right-28 z-20 flex items-center gap-2">
        {!isBuildMode ? (
          <button
            onClick={() => {
              setIsBuildMode(true);
              setQuickBuildPopover(null);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel border border-emerald-500/50 bg-slate-900/90 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800/95 shadow-xl transition-all duration-200 text-xs font-bold"
          >
            <span className="text-base">🏗️</span>
            <span>Place Building Mode</span>
          </button>
        ) : (
          <div className="glass-panel px-3 py-1.5 rounded-xl border border-emerald-500/70 bg-slate-900/95 shadow-2xl flex items-center gap-2.5 backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs pr-2 border-r border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Click Map or Block:</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setSelectedBuildType('Hospital')}
                className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                  selectedBuildType === 'Hospital'
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🏥 Hospital
              </button>
              <button
                onClick={() => setSelectedBuildType('School')}
                className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                  selectedBuildType === 'School'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🏫 School
              </button>
              <button
                onClick={() => setSelectedBuildType('ResidentialZone')}
                className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                  selectedBuildType === 'ResidentialZone'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🏢 Housing
              </button>
              <button
                onClick={() => setSelectedBuildType('DrainageNode')}
                className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                  selectedBuildType === 'DrainageNode'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                💧 Drainage
              </button>
            </div>
            <button
              onClick={() => setIsBuildMode(false)}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
              title="Exit Build Mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Zoom / Pan Controls */}
      <div className="absolute top-4 right-14 z-20 flex flex-col gap-1.5 glass-panel p-1.5 rounded-xl shadow-2xl">
        <button
          onClick={(e) => {
            e.stopPropagation();
            zoomIn();
          }}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            zoomOut();
          }}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            fitToScreen();
          }}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border-t border-slate-800"
          title="Reset View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full block"
        style={{ touchAction: 'none' }}
      >
        <defs>
          {/* Radial gradients for flood zones */}
          <radialGradient id="floodGradSevere" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#dc2626" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#991b1b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="floodGradModerate" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
            <stop offset="75%" stopColor="#d97706" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#b45309" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="floodGradLow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
            <stop offset="80%" stopColor="#0284c7" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
          </radialGradient>

          {/* Grid pattern background */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.8" />
          </pattern>
        </defs>

        {/* Global zoom/pan container */}
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* Background grid */}
          <rect
            x={-500}
            y={-500}
            width={graph.bounds.width + 1000}
            height={graph.bounds.height + 1000}
            fill="url(#grid)"
            opacity={0.7}
          />

          {/* 0. URBAN PARCEL BLOCKS (Constricted City Zoning Envelope) */}
          {graph.parcels && (
            <g className="city-parcels select-none">
              {graph.parcels.map((parcel) => {
                let fill = '#0a101f';
                let stroke = '#1e293b';
                if (parcel.parcelType === 'hospital') {
                  fill = '#1a0c16';
                  stroke = '#4c0519';
                } else if (parcel.parcelType === 'school') {
                  fill = '#09152b';
                  stroke = '#1e3a8a';
                } else if (parcel.parcelType === 'utility') {
                  fill = '#17120a';
                  stroke = '#451a03';
                }

                const isHovered = hoveredParcelId === parcel.id;

                return (
                  <g key={parcel.id} className="cursor-pointer">
                    <rect
                      x={parcel.minX}
                      y={parcel.minY}
                      width={parcel.width}
                      height={parcel.height}
                      rx={7}
                      fill={isHovered ? (isBuildMode ? '#064e3b' : '#1e293b') : fill}
                      fillOpacity={isHovered ? 0.85 : 0.65}
                      stroke={isHovered ? (isBuildMode ? '#10b981' : '#38bdf8') : stroke}
                      strokeWidth={isHovered ? 2 : 1}
                      strokeDasharray={isHovered ? undefined : '4,3'}
                      className="transition-colors duration-150"
                      onMouseEnter={(e) => {
                        setHoveredParcelId(parcel.id);
                        if (!isBuildMode) {
                          setTooltip({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            title: `City Parcel BLK ${parcel.row + 1}-${parcel.col + 1}`,
                            subtitle: `Zoning: ${parcel.parcelType.toUpperCase()} · Click to construct facility`,
                            badge: 'AVAILABLE',
                            badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
                            details: [
                              { label: 'Parcel ID', value: parcel.id },
                              {
                                label: 'Center',
                                value: `(${Math.round((parcel.minX + parcel.maxX) / 2)}, ${Math.round(
                                  (parcel.minY + parcel.maxY) / 2
                                )})`,
                              },
                              {
                                label: 'Area',
                                value: `${Math.round((parcel.width * parcel.height) / 100)} sq units`,
                              },
                            ],
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredParcelId(null);
                        if (!isBuildMode) setTooltip(null);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (dragDistRef.current > 5) return;
                        const center = {
                          x: Math.round((parcel.minX + parcel.maxX) / 2),
                          y: Math.round((parcel.minY + parcel.maxY) / 2),
                        };

                        if (isBuildMode) {
                          placeBuildingAt(selectedBuildType, center, parcel.id);
                        } else {
                          const rect = containerRef.current?.getBoundingClientRect();
                          const screenX =
                            (parcel.minX + parcel.width / 2) * transform.k +
                            transform.x +
                            (rect?.left || 0);
                          const screenY =
                            parcel.minY * transform.k + transform.y + (rect?.top || 0);
                          setQuickBuildPopover({
                            parcelId: parcel.id,
                            parcelName: `BLK ${parcel.row + 1}-${parcel.col + 1}`,
                            center,
                            screenPos: { x: screenX, y: screenY },
                          });
                        }
                      }}
                    />
                    <text
                      x={parcel.minX + 6}
                      y={parcel.minY + 12}
                      fontSize="7"
                      fontFamily="monospace"
                      fill={isHovered ? '#94a3b8' : '#475569'}
                      fillOpacity={0.85}
                      fontWeight="bold"
                      className="pointer-events-none select-none"
                    >
                      BLK {parcel.row + 1}-{parcel.col + 1}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* 1. FLOOD ZONES LAYER */}
          {layers.drainage &&
            Object.values(graph.floodZones).map((fz) => {
              const isFailing = failingIds.includes(fz.id);
              const gradId =
                fz.riskLevel === 'severe'
                  ? 'url(#floodGradSevere)'
                  : fz.riskLevel === 'moderate'
                  ? 'url(#floodGradModerate)'
                  : 'url(#floodGradLow)';

              return (
                <g key={fz.id}>
                  <circle
                    cx={fz.position.x}
                    cy={fz.position.y}
                    r={fz.radius}
                    fill={gradId}
                    stroke={fz.riskLevel === 'severe' ? '#ef4444' : '#0284c7'}
                    strokeWidth={1.5}
                    strokeDasharray={fz.riskLevel === 'severe' ? '6,4' : undefined}
                    opacity={fz.waterLevelMm > 0 ? 0.9 : 0.5}
                    className="cursor-pointer"
                    onMouseEnter={(e) => {
                      setTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        title: fz.name,
                        subtitle: `${fz.riskLevel.toUpperCase()} Flood Risk Area`,
                        badge: fz.status.toUpperCase(),
                        badgeColor: getStatusBadge(fz.status).color,
                        details: [
                          { label: 'Water Depth', value: `${fz.waterLevelMm} mm` },
                          { label: 'Critical Threshold', value: `${fz.criticalThresholdMm} mm` },
                          { label: 'Drainage Pumping', value: `${fz.drainageRateLps} L/s` },
                        ],
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ type: 'node', data: fz });
                    }}
                  />
                  {isFailing && (
                    <g className="pointer-events-none">
                      <circle cx={fz.position.x} cy={fz.position.y} r={fz.radius + 10} fill="none" stroke="#ef4444" strokeWidth={3}>
                        <animate attributeName="r" from={fz.radius} to={fz.radius + 35} dur="1.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
                      </circle>
                    </g>
                  )}
                </g>
              );
            })}

          {/* 2. POWER SUPPLY EDGES */}
          {layers.electricity &&
            Object.values(graph.edges)
              .filter((e) => e.type === 'POWER_SUPPLY')
              .map((edge) => {
                const fromNode = graph.nodes[edge.from];
                const toNode = graph.nodes[edge.to];
                if (!fromNode || !toNode) return null;
                const isDeenergized =
                  fromNode.status === 'failed' || edge.status === 'failed';

                return (
                  <line
                    key={edge.id}
                    x1={fromNode.position.x}
                    y1={fromNode.position.y}
                    x2={toNode.position.x}
                    y2={toNode.position.y}
                    stroke={isDeenergized ? '#475569' : '#f59e0b'}
                    strokeWidth={edge.capacity > 5000 ? 2 : 1}
                    strokeDasharray={isDeenergized ? '3,3' : '4,4'}
                    opacity={isDeenergized ? 0.35 : 0.65}
                  />
                );
              })}

          {/* 3. ACCESS & DRAINAGE EDGES */}
          {Object.values(graph.edges)
            .filter((e) => (layers.drainage && e.type === 'DRAINS') || (e.type === 'ACCESS' && selectedId && (e.from === selectedId || e.to === selectedId)))
            .map((edge) => {
              const fromNode = graph.nodes[edge.from];
              const toNode = graph.nodes[edge.to];
              if (!fromNode || !toNode) return null;

              if (edge.type === 'DRAINS') {
                return (
                  <line
                    key={edge.id}
                    x1={fromNode.position.x}
                    y1={fromNode.position.y}
                    x2={toNode.position.x}
                    y2={toNode.position.y}
                    stroke="#0284c7"
                    strokeWidth={1}
                    strokeDasharray="2,2"
                    opacity={0.4}
                  />
                );
              }

              // Subtle access link for selected element only
              return (
                <line
                  key={edge.id}
                  x1={fromNode.position.x}
                  y1={fromNode.position.y}
                  x2={toNode.position.x}
                  y2={toNode.position.y}
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  strokeDasharray="3,3"
                  opacity={0.8}
                />
              );
            })}

          {/* 4. TRANSPORT LAYER: ROADS */}
          {layers.transport &&
            Object.values(graph.edges)
              .filter((e) => e.type === 'ROAD')
              .map((road) => {
                const fromNode = graph.nodes[road.from];
                const toNode = graph.nodes[road.to];
                if (!fromNode || !toNode) return null;

                const isMain = road.roadType === 'main';
                const strokeColor = getRoadColor(road);
                const isSelected = selectedId === road.id;
                const isFailing = failingIds.includes(road.id);
                const strokeWidth = isMain ? (isSelected ? 7 : 5) : isSelected ? 4.5 : 2.8;

                const ratio = simulationResult.roadCongestionRatios[road.id] || 0;
                const delayMins = simulationResult.roadTravelTimes[road.id] || 1;
                const midX = (fromNode.position.x + toNode.position.x) / 2;
                const midY = (fromNode.position.y + toNode.position.y) / 2;

                return (
                  <g key={road.id}>
                    {/* Underlying clickable wider stroke */}
                    <line
                      x1={fromNode.position.x}
                      y1={fromNode.position.y}
                      x2={toNode.position.x}
                      y2={toNode.position.y}
                      stroke="transparent"
                      strokeWidth={16}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect({ type: 'edge', data: road });
                      }}
                      onMouseEnter={(e) => {
                        setTooltip({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          title: `Road ${road.id} (${isMain ? 'Arterial' : 'Local'})`,
                          subtitle: `${road.lanes} lanes · ${road.length} meters`,
                          badge: road.isClosed
                            ? 'CLOSED'
                            : ratio >= 1.0
                            ? 'CONGESTED'
                            : 'OPERATIONAL',
                          badgeColor: road.isClosed
                            ? 'bg-red-950 text-rose-300 border-rose-600'
                            : ratio >= 1.0
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
                          details: [
                            { label: 'Volume / Cap', value: `${road.currentLoad} / ${road.capacity} veh/h` },
                            { label: 'Congestion (v/c)', value: `${(ratio * 100).toFixed(0)}%` },
                            { label: 'Travel Time', value: `${delayMins.toFixed(1)} mins` },
                            { label: 'Speed', value: `${road.freeFlowSpeed} km/h` },
                            ...(road.floodDepthMm
                              ? [{ label: 'Flood Depth', value: `${road.floodDepthMm} mm` }]
                              : []),
                          ],
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />

                    {/* Visible road line */}
                    <line
                      x1={fromNode.position.x}
                      y1={fromNode.position.y}
                      x2={toNode.position.x}
                      y2={toNode.position.y}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={road.isClosed ? '6,4' : undefined}
                      strokeLinecap="round"
                      className="pointer-events-none transition-all duration-300"
                    />

                    {/* Closed Road "X" marker */}
                    {road.isClosed && (
                      <circle
                        cx={midX}
                        cy={midY}
                        r={7}
                        fill="#ef4444"
                        stroke="#7f1d1d"
                        strokeWidth={2}
                      />
                    )}

                    {/* Active cascade visual beacon on failing road */}
                    {isFailing && (
                      <g className="pointer-events-none">
                        <line
                          x1={fromNode.position.x}
                          y1={fromNode.position.y}
                          x2={toNode.position.x}
                          y2={toNode.position.y}
                          stroke="#f43f5e"
                          strokeWidth={strokeWidth + 10}
                          strokeLinecap="round"
                          opacity={0.8}
                        >
                          <animate attributeName="opacity" values="0.9;0.15;0.9" dur="1s" repeatCount="indefinite" />
                          <animate attributeName="stroke-width" values={`${strokeWidth + 4};${strokeWidth + 14};${strokeWidth + 4}`} dur="1s" repeatCount="indefinite" />
                        </line>
                        <g transform={`translate(${midX}, ${midY - 14})`}>
                          <rect x="-36" y="-10" width="72" height="16" rx="4" fill="#881337" stroke="#fda4af" strokeWidth="1.2" />
                          <text x="0" y="1.5" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">
                            {road.isClosed ? '💥 CLOSED' : '⚠️ OVERLOAD'}
                          </text>
                        </g>
                      </g>
                    )}
                  </g>
                );
              })}

          {/* 5. RESIDENTIAL ZONES LAYER */}
          {layers.population &&
            Object.values(graph.nodes)
              .filter((n): n is ResidentialZoneNode => n.type === 'ResidentialZone')
              .map((zone) => {
                const isSelected = selectedId === zone.id;
                const isFailing = failingIds.includes(zone.id);
                const isNewConstruction = zone.id.startsWith('new_');
                const isCompromised = isFailing || zone.status !== 'healthy';

                let fillColor =
                  zone.density === 'high'
                    ? '#a855f7'
                    : zone.density === 'medium'
                    ? '#3b82f6'
                    : '#10b981';
                let strokeColor = isSelected ? '#38bdf8' : fillColor;
                let strokeWidth = isSelected ? 2.5 : 1.2;

                if (isNewConstruction) {
                  fillColor = '#10b981';
                  strokeColor = '#34d399';
                  strokeWidth = 2.5;
                } else if (zone.status === 'failed') {
                  fillColor = '#dc2626';
                  strokeColor = '#fca5a5';
                  strokeWidth = 2.5;
                } else if (zone.status === 'overloaded' || zone.status === 'damaged') {
                  fillColor = '#f59e0b';
                  strokeColor = '#fcd34d';
                  strokeWidth = 2.0;
                }

                const zoneMetric = simulationResult.zoneHospitalMetrics[zone.id];

                // Determine contextual badge label and colors
                let badgeText = '⚡ BLACKOUT';
                let badgeFill = '#881337';
                let badgeStroke = '#fda4af';

                if (isNewConstruction) {
                  badgeText = '✨ NEW HOUSING';
                  badgeFill = '#064e3b';
                  badgeStroke = '#34d399';
                } else if (zoneMetric && !zoneMetric.reachable) {
                  badgeText = '⚠️ ACCESS CUT';
                  badgeFill = '#7f1d1d';
                  badgeStroke = '#fca5a5';
                } else if (zoneMetric && zoneMetric.travelTimeMinutes > 10) {
                  badgeText = `⏱️ DELAY ${zoneMetric.travelTimeMinutes.toFixed(0)}m`;
                  badgeFill = '#78350f';
                  badgeStroke = '#fcd34d';
                } else if (simulationResult.inundatedZoneIds?.includes(zone.id)) {
                  badgeText = '🌊 INUNDATED';
                  badgeFill = '#0c4a6e';
                  badgeStroke = '#38bdf8';
                }

                return (
                  <g key={zone.id}>
                    <circle
                      cx={zone.position.x}
                      cy={zone.position.y}
                      r={zone.radius}
                      fill={fillColor}
                      fillOpacity={isSelected ? 0.55 : isCompromised ? 0.45 : 0.22}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      className="cursor-pointer transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect({ type: 'node', data: zone });
                      }}
                      onMouseEnter={(e) => {
                        setTooltip({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          title: zone.name,
                          subtitle: `${zone.density.toUpperCase()} DENSITY RESIDENTIAL`,
                          badge: isNewConstruction ? 'NEW HOUSING' : zone.status.toUpperCase(),
                          badgeColor: isNewConstruction
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : getStatusBadge(zone.status).color,
                          details: [
                            { label: 'Population', value: `${zone.population.toLocaleString()} residents` },
                            {
                              label: 'Hospital Access',
                              value: zoneMetric?.reachable
                                ? `${zoneMetric.travelTimeMinutes} mins`
                                : 'UNREACHABLE',
                            },
                            { label: 'Elevation', value: `${zone.elevation} m` },
                            { label: 'Power Feed', value: zone.dependencies[0] || 'None' },
                          ],
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {/* Centroid icon */}
                    <circle
                      cx={zone.position.x}
                      cy={zone.position.y}
                      r={3.5}
                      fill={strokeColor}
                      className="pointer-events-none"
                    />

                    {/* Active cascade visual beacon or compromised state */}
                    {(isFailing || isCompromised || isNewConstruction) && (
                      <g className="pointer-events-none">
                        {isFailing && (
                          <circle cx={zone.position.x} cy={zone.position.y} r={zone.radius} fill="none" stroke={isNewConstruction ? '#10b981' : '#ef4444'} strokeWidth={2.5}>
                            <animate attributeName="r" from={zone.radius} to={zone.radius + 24} dur="1.2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
                          </circle>
                        )}
                        <g transform={`translate(${zone.position.x}, ${zone.position.y - zone.radius - 8})`}>
                          <rect x="-38" y="-9" width="76" height="15" rx="3" fill={badgeFill} stroke={badgeStroke} strokeWidth="1" />
                          <text x="0" y="1.5" fill="#ffffff" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                            {badgeText}
                          </text>
                        </g>
                      </g>
                    )}
                  </g>
                );
              })}

          {/* 6. INTERSECTIONS */}
          {layers.transport &&
            Object.values(graph.nodes)
              .filter((n): n is IntersectionNode => n.type === 'Intersection')
              .map((inter) => {
                const isSelected = selectedId === inter.id;
                const isFailing = failingIds.includes(inter.id);
                const radius = inter.isMainIntersection ? 5 : 3.5;

                return (
                  <g key={inter.id}>
                    <circle
                      cx={inter.position.x}
                      cy={inter.position.y}
                      r={radius}
                      fill={
                        inter.hasTrafficSignal
                          ? inter.trafficSignalWorking
                            ? '#22c55e'
                            : '#ef4444'
                          : '#64748b'
                      }
                      stroke={isSelected ? '#38bdf8' : '#0f172a'}
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect({ type: 'node', data: inter });
                      }}
                      onMouseEnter={(e) => {
                        setTooltip({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          title: inter.name,
                          subtitle: inter.isMainIntersection
                            ? 'Primary Arterial Junction'
                            : 'Local Intersection',
                          badge: inter.hasTrafficSignal
                            ? inter.trafficSignalWorking
                              ? 'SIGNALS ONLINE'
                              : 'SIGNALS DARK'
                            : 'UNSIGNALIZED',
                          badgeColor: inter.trafficSignalWorking
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/40',
                          details: [
                            { label: 'Capacity', value: `${inter.capacity} veh/h` },
                            { label: 'Elevation', value: `${inter.elevation} m` },
                            {
                              label: 'Signal Power',
                              value: inter.hasTrafficSignal
                                ? inter.trafficSignalWorking
                                  ? 'Active Grid'
                                  : 'Cut (Blackout)'
                                : 'N/A',
                            },
                          ],
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />

                    {/* Active cascade visual beacon on failing intersection */}
                    {isFailing && (
                      <g className="pointer-events-none">
                        <circle cx={inter.position.x} cy={inter.position.y} r={10} fill="none" stroke="#ef4444" strokeWidth={2}>
                          <animate attributeName="r" from="8" to="26" dur="1.1s" repeatCount="indefinite" />
                          <animate attributeName="opacity" from="1" to="0" dur="1.1s" repeatCount="indefinite" />
                        </circle>
                        <g transform={`translate(${inter.position.x}, ${inter.position.y - 14})`}>
                          <rect x="-35" y="-8" width="70" height="14" rx="3" fill="#991b1b" stroke="#fca5a5" strokeWidth="1" />
                          <text x="0" y="1.5" fill="#ffffff" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                            🚦 SIGNAL DARK
                          </text>
                        </g>
                      </g>
                    )}
                  </g>
                );
              })}

          {/* 7. DRAINAGE STATIONS */}
          {layers.drainage &&
            Object.values(graph.nodes)
              .filter((n) => n.type === 'DrainageNode')
              .map((drain) => {
                const isSelected = selectedId === drain.id;
                const isFailing = failingIds.includes(drain.id);

                return (
                  <g
                    key={drain.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ type: 'node', data: drain });
                    }}
                    onMouseEnter={(e) => {
                      setTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        title: drain.name,
                        subtitle: 'Stormwater Pumping Station',
                        badge: drain.status.toUpperCase(),
                        badgeColor: getStatusBadge(drain.status).color,
                        details: [
                          { label: 'Capacity', value: `${drain.capacity} L/s` },
                          { label: 'Current Load', value: `${drain.currentLoad} L/s` },
                          { label: 'Status', value: drain.status },
                        ],
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <rect
                      x={drain.position.x - 7}
                      y={drain.position.y - 7}
                      width={14}
                      height={14}
                      rx={3}
                      fill="#0369a1"
                      stroke={isSelected ? '#38bdf8' : '#38bdf8'}
                      strokeWidth={1.5}
                    />
                    <text
                      x={drain.position.x}
                      y={drain.position.y + 3.5}
                      fontSize="9"
                      fill="#e0f2fe"
                      textAnchor="middle"
                      className="pointer-events-none font-bold"
                    >
                      💧
                    </text>
                    {isFailing && (
                      <g className="pointer-events-none">
                        <circle cx={drain.position.x} cy={drain.position.y} r={12} fill="none" stroke="#ef4444" strokeWidth={2}>
                          <animate attributeName="r" from="10" to="30" dur="1.2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
                        </circle>
                      </g>
                    )}
                  </g>
                );
              })}

          {/* 8. ELECTRICITY INFRASTRUCTURE */}
          {layers.electricity &&
            Object.values(graph.nodes)
              .filter((n) => n.type === 'Substation' || n.type === 'Transformer')
              .map((pNode) => {
                const isSelected = selectedId === pNode.id;
                const isFailing = failingIds.includes(pNode.id);
                const isSub = pNode.type === 'Substation';

                return (
                  <g
                    key={pNode.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ type: 'node', data: pNode });
                    }}
                    onMouseEnter={(e) => {
                      setTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        title: pNode.name,
                        subtitle: isSub
                          ? `132kV Primary Substation`
                          : `11kV Distribution Transformer`,
                        badge: pNode.status.toUpperCase(),
                        badgeColor: getStatusBadge(pNode.status).color,
                        details: [
                          { label: 'Load / Capacity', value: `${pNode.currentLoad} / ${pNode.capacity} kW` },
                          {
                            label: 'Utilization',
                            value: `${((pNode.currentLoad / Math.max(1, pNode.capacity)) * 100).toFixed(0)}%`,
                          },
                          {
                            label: isSub ? 'Transformers' : 'Consumers',
                            value: isSub
                              ? `${(pNode as any).transformerIds?.length || 0} units`
                              : `${(pNode as TransformerNode).servicedConsumerIds?.length || 0} assets`,
                          },
                        ],
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {isSub ? (
                      <circle
                        cx={pNode.position.x}
                        cy={pNode.position.y}
                        r={12}
                        fill={pNode.status === 'failed' ? '#450a0a' : '#78350f'}
                        stroke={isSelected ? '#38bdf8' : '#f59e0b'}
                        strokeWidth={2}
                      />
                    ) : (
                      <rect
                        x={pNode.position.x - 7}
                        y={pNode.position.y - 7}
                        width={14}
                        height={14}
                        rx={2}
                        fill={pNode.status === 'failed' ? '#450a0a' : '#854d0e'}
                        stroke={isSelected ? '#38bdf8' : '#eab308'}
                        strokeWidth={1.5}
                      />
                    )}
                    <text
                      x={pNode.position.x}
                      y={pNode.position.y + (isSub ? 4 : 3.5)}
                      fontSize={isSub ? '11' : '8'}
                      fill="#fef08a"
                      textAnchor="middle"
                      className="pointer-events-none font-bold"
                    >
                      {isSub ? '⚡' : 'T'}
                    </text>

                    {/* Active cascade visual beacon on failing transformer */}
                    {isFailing && (
                      <g className="pointer-events-none">
                        <circle cx={pNode.position.x} cy={pNode.position.y} r={14} fill="none" stroke="#ef4444" strokeWidth={2.5}>
                          <animate attributeName="r" from="12" to="38" dur="1.2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
                        </circle>
                        <circle cx={pNode.position.x} cy={pNode.position.y} r={14} fill="none" stroke="#f59e0b" strokeWidth={1.5}>
                          <animate attributeName="r" from="12" to="50" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
                          <animate attributeName="opacity" from="0.8" to="0" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
                        </circle>
                        <g transform={`translate(${pNode.position.x}, ${pNode.position.y - 20})`}>
                          <rect x="-35" y="-10" width="70" height="16" rx="4" fill="#78350f" stroke="#fbbf24" strokeWidth="1" />
                          <text x="0" y="1.5" fill="#fef08a" fontSize="8" fontWeight="bold" textAnchor="middle">
                            ⚡ TRIPPED
                          </text>
                        </g>
                      </g>
                    )}
                  </g>
                );
              })}

          {/* 9. BUS STOPS */}
          {layers.transport &&
            Object.values(graph.nodes)
              .filter((n) => n.type === 'BusStop')
              .map((bus) => {
                const isSelected = selectedId === bus.id;
                return (
                  <circle
                    key={bus.id}
                    cx={bus.position.x}
                    cy={bus.position.y}
                    r={3}
                    fill="#6366f1"
                    stroke={isSelected ? '#38bdf8' : '#312e81'}
                    strokeWidth={1}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ type: 'node', data: bus });
                    }}
                    onMouseEnter={(e) => {
                      setTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        title: bus.name,
                        subtitle: 'Public Bus Transit Stop',
                        badge: 'OPERATIONAL',
                        badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
                        details: [
                          { label: 'Transit Lines', value: (bus as any).routeIds?.join(', ') || 'Line 1' },
                          { label: 'Access Point', value: (bus as any).nearestIntersectionId },
                        ],
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}

          {/* 10. SCHOOLS */}
          {layers.education &&
            Object.values(graph.nodes)
              .filter((n) => n.type === 'School')
              .map((school) => {
                const isSelected = selectedId === school.id;
                const isFailing = failingIds.includes(school.id);
                const isNewConstruction = school.id.startsWith('new_');
                const isCompromised = isFailing || school.status !== 'healthy';

                const schoolFill = isNewConstruction
                  ? '#065f46'
                  : isCompromised
                  ? '#7f1d1d'
                  : '#1e3a8a';
                const schoolStroke = isSelected
                  ? '#38bdf8'
                  : isNewConstruction
                  ? '#34d399'
                  : isCompromised
                  ? '#f87171'
                  : '#60a5fa';

                return (
                  <g
                    key={school.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ type: 'node', data: school });
                    }}
                    onMouseEnter={(e) => {
                      setTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        title: school.name,
                        subtitle: `${(school as any).schoolType || 'Educational'} Facility`,
                        badge: isNewConstruction ? 'NEW CAMPUS' : school.status.toUpperCase(),
                        badgeColor: isNewConstruction
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : getStatusBadge(school.status).color,
                        details: [
                          { label: 'Enrollment Cap', value: `${school.capacity} students` },
                          { label: 'Current Load', value: `${school.currentLoad} enrolled` },
                        ],
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <rect
                      x={school.position.x - 8}
                      y={school.position.y - 8}
                      width={16}
                      height={16}
                      rx={3}
                      fill={schoolFill}
                      stroke={schoolStroke}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                    <text
                      x={school.position.x}
                      y={school.position.y + 3.5}
                      fontSize="9"
                      fill="#bfdbfe"
                      textAnchor="middle"
                      className="pointer-events-none font-bold"
                    >
                      S
                    </text>

                    {/* School compromised or new construction indicator */}
                    {(isFailing || isCompromised || isNewConstruction) && (
                      <g className="pointer-events-none">
                        {isFailing && (
                          <circle cx={school.position.x} cy={school.position.y} r={12} fill="none" stroke={isNewConstruction ? '#10b981' : '#ef4444'} strokeWidth={2}>
                            <animate attributeName="r" from="10" to="28" dur="1.2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
                          </circle>
                        )}
                        <g transform={`translate(${school.position.x}, ${school.position.y - 18})`}>
                          <rect
                            x="-38"
                            y="-9"
                            width="76"
                            height="15"
                            rx="3"
                            fill={isNewConstruction ? '#064e3b' : '#7f1d1d'}
                            stroke={isNewConstruction ? '#34d399' : '#fca5a5'}
                            strokeWidth="1"
                          />
                          <text x="0" y="1.5" fill="#ffffff" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                            {isNewConstruction ? '✨ NEW CAMPUS' : school.status === 'damaged' ? '⚡ SCHOOL DARK' : '🏫 ACCESS CUT'}
                          </text>
                        </g>
                      </g>
                    )}
                  </g>
                );
              })}

          {/* 11. HOSPITALS (Top Layer) */}
          {layers.healthcare &&
            Object.values(graph.nodes)
              .filter((n): n is HospitalNode => n.type === 'Hospital')
              .map((hosp) => {
                const isSelected = selectedId === hosp.id;
                const isFailing = failingIds.includes(hosp.id);
                const isNewConstruction = hosp.id.startsWith('new_');
                const alloc = simulationResult.hospitalAllocations[hosp.id];
                const ratio = alloc?.loadRatio || 0;
                const isOverloaded = ratio >= 1.0;
                const isCompromised = isFailing || hosp.status !== 'healthy' || isOverloaded;

                return (
                  <g
                    key={hosp.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ type: 'node', data: hosp });
                    }}
                    onMouseEnter={(e) => {
                      setTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        title: hosp.name,
                        subtitle: `${hosp.tier} Healthcare Facility · ${hosp.beds} beds`,
                        badge: isNewConstruction ? 'NEW FACILITY' : hosp.status.toUpperCase(),
                        badgeColor: isNewConstruction
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : getStatusBadge(hosp.status).color,
                        details: [
                          { label: 'Emergency Intake', value: `${hosp.currentLoad} / ${hosp.capacity} pts` },
                          { label: 'Utilization', value: `${(ratio * 100).toFixed(0)}%` },
                          {
                            label: 'Overflow Diverted',
                            value: alloc?.overflow > 0 ? `${alloc.overflow} patients` : 'None',
                          },
                          {
                            label: 'Backup Generator',
                            value: hosp.hasBackupGenerator
                              ? hosp.backup?.active
                                ? 'ACTIVE (Fuel: 100%)'
                                : 'Standby'
                              : 'None (Grid dependent)',
                          },
                        ],
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {/* Catchment aura */}
                    <circle
                      cx={hosp.position.x}
                      cy={hosp.position.y}
                      r={isNewConstruction ? 26 : 22}
                      fill={isNewConstruction ? '#10b981' : isOverloaded ? '#f43f5e' : '#10b981'}
                      fillOpacity={isNewConstruction ? 0.35 : isOverloaded ? 0.35 : 0.15}
                    />

                    {/* Hospital marker badge */}
                    <circle
                      cx={hosp.position.x}
                      cy={hosp.position.y}
                      r={12}
                      fill={isNewConstruction ? '#065f46' : hosp.status === 'failed' ? '#4c0519' : '#881337'}
                      stroke={isSelected ? '#38bdf8' : isNewConstruction ? '#34d399' : isOverloaded ? '#f43f5e' : '#fb7185'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                    <text
                      x={hosp.position.x}
                      y={hosp.position.y + 4.5}
                      fontSize="14"
                      fontWeight="bold"
                      fill="#ffe4e6"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      +
                    </text>

                    {/* Active cascade visual beacon on hospital */}
                    {(isFailing || isCompromised || isNewConstruction) && (
                      <g className="pointer-events-none">
                        {isFailing && (
                          <>
                            <circle cx={hosp.position.x} cy={hosp.position.y} r={14} fill="none" stroke={isNewConstruction ? '#10b981' : '#ef4444'} strokeWidth={3}>
                              <animate attributeName="r" from="12" to="45" dur="1.2s" repeatCount="indefinite" />
                              <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
                            </circle>
                            <circle cx={hosp.position.x} cy={hosp.position.y} r={14} fill="none" stroke={isNewConstruction ? '#34d399' : '#fb7185'} strokeWidth={1.5}>
                              <animate attributeName="r" from="12" to="65" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
                              <animate attributeName="opacity" from="0.8" to="0" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
                            </circle>
                          </>
                        )}
                        <g transform={`translate(${hosp.position.x}, ${hosp.position.y - 24})`}>
                          <rect
                            x="-44"
                            y="-11"
                            width="88"
                            height="17"
                            rx="4"
                            fill={isNewConstruction ? '#064e3b' : '#881337'}
                            stroke={isNewConstruction ? '#34d399' : '#fda4af'}
                            strokeWidth="1.2"
                          />
                          <text x="0" y="1.5" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">
                            {isNewConstruction
                              ? '✨ NEW HOSPITAL'
                              : hosp.status === 'failed'
                              ? '⚡ CLINIC DARK'
                              : `🏥 OVERLOAD ${(ratio * 100).toFixed(0)}%`}
                          </text>
                        </g>
                      </g>
                    )}
                  </g>
                );
              })}

          {/* Build Mode Ghost / Preview Cursor Follower */}
          {isBuildMode && mouseWorldPos && (
            <g
              className="pointer-events-none opacity-85"
              transform={`translate(${mouseWorldPos.x}, ${mouseWorldPos.y})`}
            >
              <circle
                r={24}
                fill="#10b981"
                fillOpacity={0.25}
                stroke="#34d399"
                strokeWidth={1.5}
                strokeDasharray="3,3"
              />
              <circle r={9} fill="#059669" stroke="#6ee7b7" strokeWidth={1.5} />
              <text
                y={3.5}
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                {selectedBuildType === 'Hospital'
                  ? '+'
                  : selectedBuildType === 'School'
                  ? 'S'
                  : selectedBuildType === 'ResidentialZone'
                  ? 'R'
                  : 'D'}
              </text>
              <g transform="translate(0, -32)">
                <rect
                  x="-75"
                  y="-10"
                  width="150"
                  height="20"
                  rx="5"
                  fill="#064e3b"
                  stroke="#34d399"
                  strokeWidth="1.2"
                />
                <text
                  x="0"
                  y="3.5"
                  fill="#ecfdf5"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  Click to Place {selectedBuildType}
                </text>
              </g>
            </g>
          )}
        </g>
      </svg>

      {/* Quick-Build Popover on Clicked Parcel */}
      {quickBuildPopover && (
        <div
          className="absolute z-30 transform -translate-x-1/2 -translate-y-full mb-3 pointer-events-auto"
          style={{
            left: Math.max(120, Math.min(window.innerWidth - 140, quickBuildPopover.screenPos.x)),
            top: Math.max(60, quickBuildPopover.screenPos.y),
          }}
        >
          <div className="glass-panel p-2.5 rounded-xl border border-cyan-500/50 bg-slate-900/95 shadow-2xl space-y-2 min-w-[210px] backdrop-blur-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>🏗️</span> Build on {quickBuildPopover.parcelName}
              </span>
              <button
                onClick={() => setQuickBuildPopover(null)}
                className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() =>
                  placeBuildingAt('Hospital', quickBuildPopover.center, quickBuildPopover.parcelId)
                }
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-semibold transition-all"
              >
                <span>🏥</span> <span>Hospital</span>
              </button>
              <button
                onClick={() =>
                  placeBuildingAt('School', quickBuildPopover.center, quickBuildPopover.parcelId)
                }
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-[11px] font-semibold transition-all"
              >
                <span>🏫</span> <span>School</span>
              </button>
              <button
                onClick={() =>
                  placeBuildingAt(
                    'ResidentialZone',
                    quickBuildPopover.center,
                    quickBuildPopover.parcelId
                  )
                }
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[11px] font-semibold transition-all"
              >
                <span>🏢</span> <span>Housing</span>
              </button>
              <button
                onClick={() =>
                  placeBuildingAt(
                    'DrainageNode',
                    quickBuildPopover.center,
                    quickBuildPopover.parcelId
                  )
                }
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold transition-all"
              >
                <span>💧</span> <span>Drainage</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notice */}
      {toastNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-bounce">
          <div className="px-4 py-2 rounded-xl bg-emerald-950/95 border border-emerald-500/70 text-emerald-200 text-xs font-bold shadow-2xl backdrop-blur-md">
            {toastNotice.text}
          </div>
        </div>
      )}

      {/* Hover Floating Tooltip */}
      {tooltip && (
        <div
          className="map-tooltip"
          style={{
            left: Math.min(window.innerWidth - 280, tooltip.x + 14),
            top: Math.min(window.innerHeight - 200, tooltip.y + 14),
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-bold text-slate-100 text-xs truncate">{tooltip.title}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider border ${tooltip.badgeColor}`}
            >
              {tooltip.badge}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mb-2">{tooltip.subtitle}</div>
          <div className="space-y-1 border-t border-slate-700/80 pt-1.5">
            {tooltip.details.map((d, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span className="text-slate-400">{d.label}</span>
                <span className="font-medium text-slate-200">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
