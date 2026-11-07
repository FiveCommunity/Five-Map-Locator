import { describe, it, expect } from 'vitest';
import { locateResource } from '../src/engine';
import type { ResourceAnalysis } from '@five-map/shared';

function makeAnalysis(overrides: Partial<Omit<ResourceAnalysis, 'id' | 'timestamp' | 'locationResult'>>): Parameters<typeof locateResource>[0] {
  return {
    name: 'test',
    rootPath: '/tmp/test',
    files: [],
    totalEntities: 0,
    totalFiles: 0,
    missingDependencies: [],
    structuralIssues: [],
    status: 'done',
    progress: 100,
    hasFxManifest: false,
    streamFolder: false,
    dataFolder: false,
    mapsFolder: false,
    ...overrides,
  };
}

describe('Location Engine', () => {
  it('should return CONFIRMED for YMAP with valid extents', () => {
    const analysis = makeAnalysis({
      files: [{
        path: '/test/test.ymap',
        filename: 'test.ymap',
        format: 'YMAP_XML',
        size: 1000,
        parseSuccess: true,
        errors: [],
        warnings: [],
        hasCoordinates: true,
        entityCount: 2,
        ymapData: {
          name: 'test',
          parent: null,
          flags: 0,
          contentFlags: 0,
          streamingExtents: {
            min: { x: -1723, y: -903, z: -62 },
            max: { x: -1235, y: -561, z: 155 },
          },
          entitiesExtents: {
            min: { x: -1650, y: -850, z: 10 },
            max: { x: -1300, y: -600, z: 55 },
          },
          entities: [
            { archetypeName: 'prop_container_01a', position: { x: -1452, y: -782, z: 22 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scaleXY: 1, scaleZ: 1, lodDist: 500, flags: 0, guid: 0, parentIndex: -1, lodLevel: 'LODLEVEL_HIGH' },
            { archetypeName: 'prop_barrier_work_01', position: { x: -1460, y: -790, z: 20 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scaleXY: 1, scaleZ: 1, lodDist: 200, flags: 0, guid: 1, parentIndex: -1, lodLevel: 'LODLEVEL_HIGH' },
          ],
          sourceFile: '/test/test.ymap',
          parseWarnings: [],
        },
      }],
      totalEntities: 2,
      totalFiles: 1,
    });

    const result = locateResource(analysis);
    expect(result.status).toBe('CONFIRMED');
    expect(result.primaryCoordinates).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0.75);
    // Should be in LSIA / La Puerta region
    expect(result.primaryRegion).not.toBeNull();
  });

  it('should return UNIDENTIFIED for OBJ file with no spatial data', () => {
    const analysis = makeAnalysis({
      files: [{
        path: '/test/model.obj',
        filename: 'model.obj',
        format: 'OBJ',
        size: 50000,
        parseSuccess: true,
        errors: [],
        warnings: [],
        hasCoordinates: false,
        entityCount: 0,
      }],
      totalFiles: 1,
    });

    const result = locateResource(analysis);
    expect(result.status).toBe('UNIDENTIFIED');
    expect(result.primaryCoordinates).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('should return MULTIPLE_CANDIDATES when entities are in different regions', () => {
    const entities = [
      { archetypeName: 'prop_a', position: { x: -1452, y: -782, z: 22 }, rotation: { x:0,y:0,z:0,w:1 }, scaleXY:1, scaleZ:1, lodDist:500, flags:0, guid:0, parentIndex:-1, lodLevel:'LODLEVEL_HIGH' },
      { archetypeName: 'prop_b', position: { x: 1739, y: 3259, z: 41 }, rotation: { x:0,y:0,z:0,w:1 }, scaleXY:1, scaleZ:1, lodDist:500, flags:0, guid:1, parentIndex:-1, lodLevel:'LODLEVEL_HIGH' },
    ];

    const analysis = makeAnalysis({
      files: [{
        path: '/test/conflict.ymap',
        filename: 'conflict.ymap',
        format: 'YMAP_XML',
        size: 1000,
        parseSuccess: true,
        errors: [],
        warnings: [],
        hasCoordinates: true,
        entityCount: 2,
        ymapData: {
          name: 'conflict',
          parent: null, flags: 0, contentFlags: 0,
          streamingExtents: null, entitiesExtents: null,
          entities,
          sourceFile: '/test/conflict.ymap',
          parseWarnings: [],
        },
      }],
      totalEntities: 2,
      totalFiles: 1,
    });

    const result = locateResource(analysis);
    expect(result.status).toBe('MULTIPLE_CANDIDATES');
  });

  it('should NOT invent coordinates when binary-only files provided', () => {
    const analysis = makeAnalysis({
      files: [{
        path: '/test/model.ydr',
        filename: 'model.ydr',
        format: 'YDR_BINARY',
        size: 500000,
        parseSuccess: true,
        errors: [],
        warnings: ['Binary RAGE asset — no spatial data extractable'],
        hasCoordinates: false,
        entityCount: 0,
      }],
      totalFiles: 1,
    });

    const result = locateResource(analysis);
    expect(result.primaryCoordinates).toBeNull();
    expect(['UNIDENTIFIED', 'ESTIMATED_WITH_REFS']).toContain(result.status);
    // Must NOT have CONFIRMED status without real data
    expect(result.status).not.toBe('CONFIRMED');
  });
});
