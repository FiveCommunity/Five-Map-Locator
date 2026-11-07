import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { analyzeResource } from '@five-map/parser';
import { locateResource } from '../src/index';

describe('FiveM Resource Real 3D Integration Test', () => {
  it('should parse an entire stream resource with YMAP, YTYP, YDR, YBN, and MLO', async () => {
    const fixturePath = path.resolve(__dirname, '../../parser/tests/fixtures/luxury_yacht');

    const analysis = await analyzeResource(fixturePath, 'folder');

    // 1. Structural resource check
    expect(analysis.name).toBe('luxury_yacht');
    expect(analysis.hasFxManifest).toBe(true);
    expect(analysis.streamFolder).toBe(true);
    expect(analysis.totalFiles).toBe(5);

    // 2. YDR real mesh models check
    expect(analysis.modelsMap).toBeDefined();
    expect(analysis.modelsMap!['yacht_shell']).toBeDefined();
    const model = analysis.modelsMap!['yacht_shell'];
    expect(model.meshes).toHaveLength(1);
    expect(model.vertexCount).toBeGreaterThan(0);
    expect(model.materials[0].name).toBe('yacht_hull_white');

    // 3. YBN collision bounds check
    expect(analysis.collisionsMap).toBeDefined();
    expect(analysis.collisionsMap!['yacht_col']).toBeDefined();
    const col = analysis.collisionsMap!['yacht_col'];
    expect(col.bounds.length).toBeGreaterThan(0);

    // 4. MLO interior structure check
    expect(analysis.mlos).toBeDefined();
    expect(analysis.mlos!.length).toBeGreaterThan(0);
    const mlo = analysis.mlos![0];
    expect(mlo.rooms.length).toBe(2);
    expect(mlo.portals.length).toBe(1);

    // 5. Entity resolution check
    const ymapFile = analysis.files.find(f => f.ymapData);
    expect(ymapFile).toBeDefined();
    const entity = ymapFile!.ymapData!.entities.find(e => e.archetypeName === 'yacht_shell');
    expect(entity).toBeDefined();
    expect(entity!.resolvedModel).toBeDefined();
    expect(entity!.polygonCount).toBeGreaterThan(0);

    // 6. Location Engine test
    const location = locateResource(analysis);
    expect(location.status).toBe('CONFIRMED');
    expect(location.primaryCoordinates).not.toBeNull();
    expect(location.primaryCoordinates!.x).toBeCloseTo(-1520, -1);
    expect(location.primaryCoordinates!.y).toBeCloseTo(-1080, -1);
    // Position [-1520, -1080] is Vespucci Beach / Pier area in Los Santos
    expect(location.primaryRegion).not.toBeNull();
    expect(location.primaryRegion!.id).toBe('vespucci');
    expect(location.confidence).toBeGreaterThan(0.85);
  });
});
