import { GraphData, IntersectionNode, Position, UrbanEdge, UrbanNode } from '../types/graph';

export function distance(p1: Position, p2: Position): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Builds adjacency map for road graph (intersections only, bidirectional)
 */
export function buildRoadAdjacency(
  edges: Record<string, UrbanEdge>,
  includeOnlyHealthy: boolean = false
): Map<string, { neighborId: string; edgeId: string; edge: UrbanEdge }[]> {
  const adj = new Map<string, { neighborId: string; edgeId: string; edge: UrbanEdge }[]>();

  for (const edge of Object.values(edges)) {
    if (edge.type !== 'ROAD') continue;
    if (includeOnlyHealthy && (edge.status === 'failed' || edge.isClosed)) continue;

    if (!adj.has(edge.from)) adj.set(edge.from, []);
    if (!adj.has(edge.to)) adj.set(edge.to, []);

    adj.get(edge.from)!.push({ neighborId: edge.to, edgeId: edge.id, edge });
    adj.get(edge.to)!.push({ neighborId: edge.from, edgeId: edge.id, edge });
  }

  return adj;
}

/**
 * Checks BFS connectivity of all intersections via ROAD edges.
 * Returns connected components (arrays of intersection IDs).
 */
export function findRoadComponents(
  intersections: Record<string, IntersectionNode>,
  edges: Record<string, UrbanEdge>,
  includeOnlyHealthy: boolean = false
): string[][] {
  const intersectionIds = Object.keys(intersections);
  if (intersectionIds.length === 0) return [];

  const adj = buildRoadAdjacency(edges, includeOnlyHealthy);
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const startId of intersectionIds) {
    if (visited.has(startId)) continue;

    const component: string[] = [];
    const queue: string[] = [startId];
    visited.add(startId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      const neighbors = adj.get(current) || [];
      for (const { neighborId } of neighbors) {
        if (intersections[neighborId] && !visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * Finds the nearest intersection node to a given position
 */
export function findNearestIntersection(
  pos: Position,
  intersections: Record<string, IntersectionNode>
): IntersectionNode | null {
  let nearest: IntersectionNode | null = null;
  let minDistance = Infinity;

  for (const node of Object.values(intersections)) {
    const dist = distance(pos, node.position);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = node;
    }
  }

  return nearest;
}

/**
 * Finds all nodes of a specific type
 */
export function getNodesByType<T extends UrbanNode>(
  nodes: Record<string, UrbanNode>,
  type: T['type']
): T[] {
  return Object.values(nodes).filter((n): n is T => n.type === type);
}

/**
 * Deep clones graph data cleanly without mutating original
 */
export function deepCloneGraph(graph: GraphData): GraphData {
  return JSON.parse(JSON.stringify(graph));
}
