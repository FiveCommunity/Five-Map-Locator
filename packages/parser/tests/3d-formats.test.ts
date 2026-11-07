import { describe, it, expect } from 'vitest';
import { parseYdrXml } from '../src/formats/ydr';
import { parseYbnXml } from '../src/formats/ybn';
import { parseObjGeometry } from '../src/formats/generic';
import * as fs from 'fs';
import * as path from 'path';

describe('3D Formats Real Geometry Parsers', () => {
  it('should parse real YDR XML geometry buffers and shaders', () => {
    const ydrXml = `<?xml version="1.0" encoding="UTF-8"?>
<Drawable>
  <BoundingBoxMin x="-10.5" y="-5.2" z="0.0"/>
  <BoundingBoxMax x="10.5" y="5.2" z="8.0"/>
  <ShaderGroup>
    <Shaders>
      <Item type="CShader">
        <Name>default_concrete</Name>
        <Parameters>
          <Item type="CShaderParamTexture">
            <Name>DiffuseSampler</Name>
            <TextureName>concrete_diffuse</TextureName>
          </Item>
        </Parameters>
      </Item>
    </Shaders>
  </ShaderGroup>
  <LodGroup>
    <Lod1>
      <Models>
        <Item>
          <Geometries>
            <Item>
              <ShaderIndex value="0"/>
              <BoundingBoxMin x="-10.5" y="-5.2" z="0.0"/>
              <BoundingBoxMax x="10.5" y="5.2" z="8.0"/>
              <VertexBuffer>
                <Data>
                  -10.0 -5.0 0.0  0.0 0.0 1.0  0.0 0.0
                   10.0 -5.0 0.0  0.0 0.0 1.0  1.0 0.0
                   10.0  5.0 0.0  0.0 0.0 1.0  1.0 1.0
                  -10.0  5.0 0.0  0.0 0.0 1.0  0.0 1.0
                </Data>
              </VertexBuffer>
              <IndexBuffer>
                <Data>
                  0 1 2 0 2 3
                </Data>
              </IndexBuffer>
            </Item>
          </Geometries>
        </Item>
      </Models>
    </Lod1>
  </LodGroup>
</Drawable>`;

    const model = parseYdrXml('building.ydr', Buffer.from(ydrXml));
    expect(model.name).toBe('building');
    expect(model.meshes).toHaveLength(1);
    expect(model.meshes[0].positions).toHaveLength(12); // 4 vertices * 3 coords
    expect(model.meshes[0].indices).toEqual([0, 1, 2, 0, 2, 3]);
    expect(model.materials).toHaveLength(1);
    expect(model.materials[0].name).toBe('default_concrete');
    expect(model.materials[0].mapTextureName).toBe('concrete_diffuse');
    expect(model.vertexCount).toBe(4);
    expect(model.indexCount).toBe(6);
  });

  it('should parse real YBN XML collision boxes and BVH triangles', () => {
    const ybnXml = `<?xml version="1.0" encoding="UTF-8"?>
<BoundsFile>
  <CompositeBounds>
    <Item type="phBoundBox">
      <BoxMin x="-5" y="-5" z="0"/>
      <BoxMax x="5" y="5" z="4"/>
    </Item>
    <Item type="phBoundBVH">
      <Vertices>
        <Data>
          0.0 0.0 0.0
          2.0 0.0 0.0
          0.0 2.0 0.0
        </Data>
      </Vertices>
      <Polygons>
        <Data>
          0 1 2
        </Data>
      </Polygons>
    </Item>
  </CompositeBounds>
</BoundsFile>`;

    const col = parseYbnXml('walls.ybn', Buffer.from(ybnXml));
    expect(col.name).toBe('walls');
    expect(col.bounds).toHaveLength(2);
    expect(col.bounds[0].type).toBe('BOX');
    expect(col.bounds[1].type).toBe('BVH');
    expect(col.bounds[1].vertices).toHaveLength(9);
    expect(col.bounds[1].indices).toEqual([0, 1, 2]);
    expect(col.totalPolys).toBeGreaterThan(0);
  });
});
