import { describe, it, expect } from 'vitest';
import { parseYmapXml } from '../src/formats/ymap';
import { detectFileFormat } from '../src/detector';
import * as path from 'path';

// ============================================================
// YMAP Parser Tests
// ============================================================

describe('YMAP XML Parser', () => {
  it('should parse a valid YMAP XML with entities', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<CMapData>
  <name>test_map</name>
  <flags value="0"/>
  <contentFlags value="1"/>
  <streamingExtentsMin x="-1723.391" y="-903.703" z="-62.803"/>
  <streamingExtentsMax x="-1235.868" y="-561.229" z="155.651"/>
  <entitiesExtentsMin x="-1650.675" y="-850.986" z="10.196"/>
  <entitiesExtentsMax x="-1300.585" y="-600.946" z="55.651"/>
  <entities>
    <Item type="CEntityDef">
      <archetypeName>prop_container_01a</archetypeName>
      <flags value="1572864"/>
      <guid value="0"/>
      <position x="-1452.379" y="-782.804" z="22.182"/>
      <rotation x="0.0" y="0.0" z="0.754" w="0.656"/>
      <scaleXY value="1.0"/>
      <scaleZ value="1.0"/>
      <parentIndex value="-1"/>
      <lodDist value="500.0"/>
      <lodLevel>LODLEVEL_HIGH</lodLevel>
    </Item>
    <Item type="CEntityDef">
      <archetypeName>prop_barrier_work_01</archetypeName>
      <flags value="1572864"/>
      <guid value="1"/>
      <position x="-1460.0" y="-790.0" z="20.0"/>
      <rotation x="0.0" y="0.0" z="0.0" w="1.0"/>
      <scaleXY value="1.0"/>
      <scaleZ value="1.0"/>
      <parentIndex value="-1"/>
      <lodDist value="200.0"/>
      <lodLevel>LODLEVEL_HIGH</lodLevel>
    </Item>
  </entities>
</CMapData>`;

    const result = parseYmapXml('test.ymap', Buffer.from(xml));

    expect(result.name).toBe('test_map');
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].archetypeName).toBe('prop_container_01a');
    expect(result.entities[0].position.x).toBeCloseTo(-1452.379);
    expect(result.entities[0].position.y).toBeCloseTo(-782.804);
    expect(result.entities[0].position.z).toBeCloseTo(22.182);
    expect(result.streamingExtents).not.toBeNull();
    expect(result.streamingExtents!.min.x).toBeCloseTo(-1723.391);
    expect(result.parseWarnings.some((w: string) => w.includes('error'))).toBe(false);
  });

  it('should handle YMAP with no entities gracefully', () => {
    const xml = `<?xml version="1.0"?>
<CMapData>
  <name>empty_map</name>
  <flags value="0"/>
  <entities/>
</CMapData>`;

    const result = parseYmapXml('empty.ymap', Buffer.from(xml));
    expect(result.entities).toHaveLength(0);
    expect(result.parseWarnings.length).toBeGreaterThan(0);
  });

  it('should NOT parse binary files as XML', () => {
    // RSC7 magic bytes
    const binary = Buffer.from([0x52, 0x53, 0x43, 0x37, 0x08, 0x00, 0x00, 0x00, ...Array(100).fill(0)]);
    const format = detectFileFormat;
    // Binary buffer should not produce valid YMAP XML data
    const result = parseYmapXml('binary.ymap', binary);
    // Should fail gracefully with an error warning, not throw
    expect(result.entities).toHaveLength(0);
    expect(result.parseWarnings.length).toBeGreaterThan(0);
  });

  it('should detect out-of-bounds coordinates and warn', () => {
    const xml = `<?xml version="1.0"?>
<CMapData>
  <name>invalid_coords</name>
  <flags value="0"/>
  <entities>
    <Item type="CEntityDef">
      <archetypeName>some_prop</archetypeName>
      <flags value="0"/>
      <guid value="0"/>
      <position x="99999.0" y="99999.0" z="99999.0"/>
      <rotation x="0" y="0" z="0" w="1"/>
      <scaleXY value="1.0"/>
      <scaleZ value="1.0"/>
      <parentIndex value="-1"/>
      <lodDist value="500.0"/>
      <lodLevel>LODLEVEL_HIGH</lodLevel>
    </Item>
  </entities>
</CMapData>`;

    const result = parseYmapXml('invalid.ymap', Buffer.from(xml));
    // Entity is included but we warn about out-of-bounds
    expect(result.entities).toHaveLength(1);
    expect(result.parseWarnings.some((w: string) => w.includes('out-of-bounds'))).toBe(true);
  });
});
