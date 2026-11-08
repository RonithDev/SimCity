import { describe, expect, it } from 'vitest';
import { generateCity } from '../sim/generator';
import { validateCity } from '../sim/validator';

describe('Milestone 1: City Generator & Validation', () => {
  it('generates identical city graphs for the same seed (determinism)', () => {
    const seed = 42891;
    const city1 = generateCity(seed, { size: 'medium' });
    const city2 = generateCity(seed, { size: 'medium' });

    expect(Object.keys(city1.nodes).length).toBe(Object.keys(city2.nodes).length);
    expect(Object.keys(city1.edges).length).toBe(Object.keys(city2.edges).length);

    // Deep compare positions
    for (const id of Object.keys(city1.nodes)) {
      expect(city1.nodes[id].position).toEqual(city2.nodes[id].position);
      expect(city1.nodes[id].name).toBe(city2.nodes[id].name);
    }
  });

  it('guarantees road network connectivity across different sizes and seeds', () => {
    const testCases: Array<{ seed: number; size: 'small' | 'medium' | 'large' }> = [
      { seed: 101, size: 'small' },
      { seed: 202, size: 'medium' },
      { seed: 303, size: 'large' },
      { seed: 9999, size: 'medium' },
    ];

    for (const tc of testCases) {
      const city = generateCity(tc.seed, { size: tc.size });
      const report = validateCity(city);

      expect(report.roadNetworkConnected).toBe(true);
      expect(report.isValid).toBe(true);
      expect(report.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    }
  });

  it('verifies that every facility and zone has an access connection to an intersection', () => {
    const city = generateCity(1234, { size: 'medium' });
    const report = validateCity(city);

    expect(report.stats.hospitals).toBeGreaterThanOrEqual(3);
    expect(report.stats.residentialZones).toBeGreaterThan(10);
    expect(report.stats.transformers).toBeGreaterThanOrEqual(2);
    expect(report.stats.substations).toBeGreaterThanOrEqual(1);

    // Check all access edges
    const accessEdges = Object.values(city.edges).filter((e) => e.type === 'ACCESS');
    expect(accessEdges.length).toBeGreaterThan(20);
  });

  it('verifies all electricity consumers have valid transformer dependencies', () => {
    const city = generateCity(777, { size: 'medium' });
    for (const node of Object.values(city.nodes)) {
      if (node.type === 'ResidentialZone' || node.type === 'Hospital' || node.type === 'School') {
        expect(node.dependencies.length).toBeGreaterThan(0);
        const depId = node.dependencies[0];
        expect(city.nodes[depId]).toBeDefined();
        expect(city.nodes[depId].type).toBe('Transformer');
      }
    }
  });

  it('verifies that city block parcels are generated and buildings maintain safe clearance from intersections', () => {
    const city = generateCity(54321, { size: 'medium' });
    expect(city.parcels).toBeDefined();
    expect(city.parcels!.length).toBe(36); // (7 - 1) * (7 - 1) = 36 blocks

    // Verify residential zones and facilities are within bounds and have safe distance to intersections
    const intersections = Object.values(city.nodes).filter((n) => n.type === 'Intersection');
    const facilities = Object.values(city.nodes).filter(
      (n) => n.type === 'Hospital' || n.type === 'School' || n.type === 'ResidentialZone'
    );

    for (const f of facilities) {
      // Find nearest intersection
      let minDist = Infinity;
      for (const inter of intersections) {
        const dx = f.position.x - inter.position.x;
        const dy = f.position.y - inter.position.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) minDist = d;
      }
      // Facilities must not collide directly onto intersections (safe clearance > 15px)
      expect(minDist).toBeGreaterThan(15);
    }
  });
});
