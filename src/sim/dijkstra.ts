import { UrbanEdge } from '../types/graph';

export interface DijkstraResult {
  distances: Record<string, number>;
  previous: Record<string, { nodeId: string; edgeId: string } | null>;
}

/**
 * Priority queue for Dijkstra
 */
class MinPriorityQueue {
  private items: Array<{ id: string; priority: number }> = [];

  push(id: string, priority: number) {
    this.items.push({ id, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }

  pop(): { id: string; priority: number } | undefined {
    return this.items.shift();
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

/**
 * Single-Source Shortest Path using Dijkstra algorithm
 * Works on intersections and road edges.
 * Edge weight can be length (meters) or congested travel time (minutes).
 */
export function dijkstra(
  startId: string,
  _edges: Record<string, UrbanEdge>,
  adjacency: Map<string, { neighborId: string; edgeId: string; edge: UrbanEdge }[]>,
  weightSelector: (edge: UrbanEdge) => number = (e) => e.congestedTravelTime || e.freeFlowTravelTime || 1,
  targetId?: string
): DijkstraResult {
  const distances: Record<string, number> = {};
  const previous: Record<string, { nodeId: string; edgeId: string } | null> = {};
  const pq = new MinPriorityQueue();

  distances[startId] = 0;
  previous[startId] = null;
  pq.push(startId, 0);

  const visited = new Set<string>();

  while (!pq.isEmpty()) {
    const { id: u, priority: d } = pq.pop()!;

    if (visited.has(u)) continue;
    visited.add(u);

    if (targetId && u === targetId) {
      break;
    }

    if (d > (distances[u] ?? Infinity)) continue;

    const neighbors = adjacency.get(u) || [];
    for (const { neighborId: v, edgeId, edge } of neighbors) {
      // Disallow traversing impassable or closed roads
      if (edge.status === 'failed' || edge.isClosed) continue;

      const weight = weightSelector(edge);
      const newDist = d + weight;

      if (newDist < (distances[v] ?? Infinity)) {
        distances[v] = newDist;
        previous[v] = { nodeId: u, edgeId };
        pq.push(v, newDist);
      }
    }
  }

  return { distances, previous };
}

/**
 * Reconstructs path of edge IDs from Dijkstra result
 */
export function reconstructPath(
  targetId: string,
  dijkstraResult: DijkstraResult
): string[] {
  const edgePath: string[] = [];
  let curr = targetId;

  while (dijkstraResult.previous[curr]) {
    const prev = dijkstraResult.previous[curr]!;
    edgePath.unshift(prev.edgeId);
    curr = prev.nodeId;
  }

  return edgePath;
}
