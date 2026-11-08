# Sustainable Neighbourhoods: Synthetic Urban Digital Twin

> **Academic Prototype for SDG 11 (Sustainable Cities and Communities)**  
> A client-side, interactive synthetic urban digital twin modeling multi-layer heterogeneous urban graphs, equilibrium mobility and critical infrastructure simulations, what-if scenario testing, and rule-based cascading failure propagation.

---

## 🏙️ System Overview

This digital twin models an interconnected urban ecosystem as a **multi-layer heterogeneous graph** $G = (V, E)$, evaluating how physical and functional dependencies propagate disruptions across transport, healthcare, electrical grids, and stormwater drainage systems.

### Core Capabilities
- **Deterministic Procedural Generation**: Seeded PRNG (`mulberry32`) procedural synthesis generating reproducible urban topologies with guaranteed BFS road connectivity and automatic network repair.
- **Multimodal Infrastructure Simulation**:
  - **Mobility**: Dijkstra shortest-path routing with Bureau of Public Roads (BPR) volume-delay congestion function:  
    $$t = t_0 \left(1 + 0.15 \left(\frac{v}{c}\right)^4\right)$$
  - **Healthcare Accessibility**: Golden-hour emergency response times, hospital catchment areas, and patient overflow redistribution.
  - **Power Distribution**: Hierarchical substations $\rightarrow$ transformers $\rightarrow$ consumer loads with auxiliary backup generator failovers.
  - **Stormwater & Flood Inundation**: Net rainfall runoff accumulation minus drainage station pumping, road submergence thresholds, and isolated population tracking.
- **What-If Scenario Studio**: Deep-cloning scenario runner allowing non-destructive interventions (road severing, demand surges, grid blackouts, extreme atmospheric rainfall).
- **Multi-Round Cascading Failure Engine**: Iterative rule-based failure propagation with step-by-step scrubber playback, quantitative causality event logs, and animated vector map pulsing.
- **Resilience Mitigation Heuristics**: Static rule-based intervention suggestions with estimated impact metrics.

---

## 🚀 Quickstart

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ or v22+)
- npm (v9+)

### Installation & Run
```bash
# Clone or navigate to the repository directory
cd EL

# Install dependencies
npm install

# Start development server
npm run dev

# Run automated Vitest test suite
npm test

# Build production bundle
npm run build
```

The application will be served at `http://localhost:5173`.

---

## 📐 Architecture & Module Breakdown

The codebase enforces strict separation of concerns between simulation mathematics and UI presentation:

```
src/
├── types/
│   ├── graph.ts          # Schemas for nodes, typed edges, status, and validation
│   └── sim.ts            # KPIs, scenarios, cascade events, and mitigations
├── sim/
│   ├── rng.ts            # Mulberry32 seeded pseudo-random number generator
│   ├── graphUtils.ts     # Adjacency maps, BFS connectivity check & auto-repair
│   ├── generator.ts      # Grid layout with jitter, main/local roads, facilities, power wiring
│   ├── validator.ts      # Structural invariant verification (connectivity & power feeds)
│   ├── dijkstra.ts       # Dijkstra algorithm with custom BPR impedance cost functions
│   ├── traffic.ts        # Trip generation, BPR travel time, iterative equilibrium loading
│   ├── engine.ts         # Multimodal simulation engine (mobility, health, power, flood, KPIs)
│   ├── cascade.ts        # Multi-round cascading failure propagation loop
│   └── mitigation.ts     # Rule-based resilience intervention heuristics
├── ui/
│   ├── components/
│   │   ├── Header.tsx           # Seed controls, city size, validation badge, compare modal
│   │   ├── Map.tsx              # SVG interactive vector canvas (custom pan/zoom, layers, tooltips)
│   │   ├── LayerControls.tsx    # Transport, Healthcare, Population, Power, Flood toggles
│   │   ├── KpiDashboard.tsx     # 8 SDG 11 urban indicators with baseline delta badges
│   │   ├── SidePanel.tsx        # Inspector panel with load gauges, dependencies, and actions
│   │   ├── WhatIfStudio.tsx     # Intervention triggers & disaster presets
│   │   ├── CascadeViewer.tsx    # Interactive step-by-step timeline scrubber & player
│   │   ├── ComparisonModal.tsx  # Detailed baseline vs scenario delta table & mitigations
│   │   ├── ValidationModal.tsx  # Full topological integrity audit popup
│   │   └── Legend.tsx           # Map symbology and color codes
│   ├── App.tsx                  # Root state coordinator
│   └── index.css                # Slate-neutral styling, themes, and animations
└── tests/
    ├── generator.test.ts        # Determinism, guaranteed BFS connectivity, power wiring
    └── sim.test.ts              # Dijkstra routing, baseline immutability, cascade engine
```

---

## 📊 Graph Schema & Layer Model

### Node Types
1. **Intersection**: Physical street junctions with coordinates and elevation; main junctions feature traffic signal systems.
2. **Hospital**: Categorized into Tertiary (500 beds + 24h generator), Secondary (180-240 beds + 12-16h generator), and Primary Urgent Care clinics.
3. **School**: Elementary, High School, and Community College campuses with student enrollments.
4. **ResidentialZone**: Neighborhood sectors categorized into High, Medium, and Low population densities.
5. **BusStop**: Public transit stops mapped to route corridors.
6. **Substation**: 132kV bulk transmission intake substations feeding distribution transformers.
7. **Transformer**: 11kV distribution transformers servicing localized consumer clusters.
8. **DrainageNode**: Stormwater pumping stations rated in Litres per second (L/s).
9. **FloodZone**: Geographic low-elevation retention basins with inundation thresholds.

### Edge Types
- `ROAD`: Physical links with length ($m$), capacity ($\text{veh/h}$), speed limit ($\text{km/h}$), lane count, and flood tolerance threshold ($mm$).
- `POWER_SUPPLY`: Electrical feeds connecting Substation $\rightarrow$ Transformer $\rightarrow$ Consumers.
- `ACCESS`: Physical egress links connecting facilities and residential zones to street intersections.
- `DRAINS`: Hydraulic runoff gravity lines connecting drainage basins to low-lying roads and zones.
- `DEPENDS_ON`: Functional operational dependency mapping.

---

## ⚡ Cascading Failure Mechanics

Disruptions propagate strictly across **explicitly modeled dependencies** in iterative rounds:

1. **Rule A (Traffic Diversion & Secondary Overload)**:
   - Closing or submerging a road removes it from the routing graph.
   - Traffic redistributes to parallel corridors via Dijkstra shortest paths.
   - Diverted volume inflates travel times via BPR and drives secondary roads over their failure threshold ($v/c \ge 1.25$), triggering secondary bottlenecks.
2. **Rule B (Hospital Overload & Emergency Diversion)**:
   - When emergency patient inflow exceeds hospital bed intake ($load / capacity > 1.0$), overflow patients are redirected to secondary hospitals.
   - Secondary hospitals become overloaded, degrading 10-minute golden-hour coverage.
3. **Rule C (Electrical Outage & Infrastructure Cascade)**:
   - Tripping a distribution transformer cuts grid power to connected consumers.
   - Hospitals with backup generators auto-start auxiliary diesel units; clinics without generators experience clinical capacity collapse.
   - Traffic signals at major intersections lose power, reverting to uncontrolled junctions and slashing arterial road throughput by $40\%$.
4. **Rule D (Atmospheric Storm & Road Submergence)**:
   - Rainfall exceeding local pumping capacity accumulates in flood basins.
   - Water depths surpassing road clearance thresholds ($130-200mm$) mark roads impassable, trapping residential zones and severing ambulance corridors.

---

## 🧪 How to Demo Each Scenario

### 1. Main Arterial Road Severing
1. Click on **What-If Studio** in the bottom right.
2. Under **1. Road Network Closure**, select a main arterial road (e.g., `road_1` or click any road directly on the map).
3. Click **Close**.
4. Observe the **Cascade Timeline**: Step 0 records the closure, Round 1 logs diverted traffic pushing adjacent parallel roads into overload ($v/c > 1.25$), and emergency response times jump.

### 2. Substation / Transformer Blackout
1. Under **Preset Disaster Scenarios**, click **Feeder Grid Outage**.
2. Notice the transformer outage cascades into traffic signals turning dark and unbacked clinics losing capacity.
3. Arterial road capacities drop by $40\%$, generating widespread secondary traffic jams.

### 3. Severe Storm & Flooding
1. Adjust the **Stormwater Rainfall Intensity** slider to **75 mm/h**.
2. Basins fill with water, submerging low-elevation roads.
3. The **Flood Exposed Population** metric surges on the top KPI bar, and isolated zones lose ambulance connectivity.

### 4. Interactive Cascade Replay
1. When a scenario is active, open the **Cascade Timeline**.
2. Drag the scrubber slider or click **Play Cascade** to watch failures light up step by step across the map.

### 5. Baseline vs Scenario Comparison
1. Click **Compare Scenario** in the top navigation bar.
2. Review side-by-side KPI differences with green/red delta badges and examine the tailored **Resilience Mitigation Suggestions**.

---

## 🔒 Determinism & Quality Guarantees

- **No Hardcoded Fakes**: All metrics, graphs, travel times, and cascade logs are computed dynamically by the simulation engine.
- **Deterministic**: The same seed (e.g. `42891`) always produces the exact same city geometry and simulation numbers.
- **Baseline Immutability**: All scenarios execute on isolated deep-clones, ensuring the baseline model is never mutated.
- **Unit Tested**: Vitest suite guarantees 100% road connectivity across varying seeds, correct shortest path routing, and cascade stability.
