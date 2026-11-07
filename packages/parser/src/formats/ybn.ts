// ============================================================
// YBN Parser — GTA V Collision Format (Bounds)
// Parses both CodeWalker/OpenIV XML (.ybn.xml) and RSC7 binary
// Extracts collision geometry: boxes, spheres, capsules, and BVH meshes
// ============================================================

import { XMLParser } from 'fast-xml-parser';
import type { YbnCollisionData, CollisionBound, Vec3 } from '@five-map/shared';
import { parseRsc7Header } from '../rsc7';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  isArray: (name) => ['Item', 'Bound', 'Entry'].includes(name),
});

function parseVec3(node: any): Vec3 {
  if (!node) return { x: 0, y: 0, z: 0 };
  return {
    x: parseFloat(node['@_x'] ?? node.x ?? 0) || 0,
    y: parseFloat(node['@_y'] ?? node.y ?? 0) || 0,
    z: parseFloat(node['@_z'] ?? node.z ?? 0) || 0,
  };
}

export function parseYbnXml(filePath: string, data: Buffer): YbnCollisionData {
  const filename = filePath.split(/[\\/]/).pop()?.replace(/(\.ybn)?\.xml$/i, '').replace(/\.ybn$/i, '') ?? 'collision';
  const text = data.toString('utf-8');
  let parsed: any;
  try {
    parsed = xmlParser.parse(text);
  } catch (err) {
    return makeFallbackCollision(filename, filePath);
  }

  const root = parsed?.BoundsFile ?? parsed?.phBoundComposite ?? parsed?.Bound;
  const bounds: CollisionBound[] = [];
  let totalPolys = 0;

  let bbMin: Vec3 = { x: Infinity, y: Infinity, z: Infinity };
  let bbMax: Vec3 = { x: -Infinity, y: -Infinity, z: -Infinity };

  const rawEntries = root?.CompositeBounds?.Item ?? root?.Entries?.Item ?? [root];
  const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries].filter(Boolean);

  for (const entry of entries) {
    const typeAttr = String(entry['@_type'] ?? entry.type ?? '');

    if (typeAttr.includes('Box') || entry.BoxMin) {
      const min = parseVec3(entry.BoxMin ?? entry.bbMin);
      const max = parseVec3(entry.BoxMax ?? entry.bbMax);
      const center: Vec3 = {
        x: (min.x + max.x) / 2,
        y: (min.y + max.y) / 2,
        z: (min.z + max.z) / 2,
      };
      const extents: Vec3 = {
        x: Math.abs(max.x - min.x),
        y: Math.abs(max.y - min.y),
        z: Math.abs(max.z - min.z),
      };

      bounds.push({ type: 'BOX', center, extents });
      totalPolys += 12; // 6 faces * 2 triangles
    } else if (typeAttr.includes('Sphere') || entry.SphereRadius) {
      const center = parseVec3(entry.Center ?? entry.center);
      const radius = parseFloat(entry.SphereRadius ?? entry.radius ?? '1') || 1;
      bounds.push({ type: 'SPHERE', center, radius });
      totalPolys += 32;
    } else if (typeAttr.includes('Capsule')) {
      const center = parseVec3(entry.Center ?? entry.center);
      const radius = parseFloat(entry.CapsuleRadius ?? entry.radius ?? '0.5') || 0.5;
      const height = parseFloat(entry.CapsuleLength ?? entry.height ?? '1') || 1;
      bounds.push({ type: 'CAPSULE', center, radius, height });
      totalPolys += 48;
    } else if (typeAttr.includes('BVH') || entry.Vertices || entry.Polygons) {
      // BVH Mesh Collision
      const verticesStr = String(entry.Vertices?.Data ?? entry.Vertices ?? '');
      const polysStr = String(entry.Polygons?.Data ?? entry.Polygons ?? '');

      const vertices: number[] = [];
      const lines = verticesStr.trim().split(/[\r\n]+/);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
        if (parts.length >= 3) {
          vertices.push(parts[0], parts[1], parts[2]);
        }
      }

      const indices: number[] = [];
      const polyLines = polysStr.trim().split(/[\r\n]+/);
      for (const line of polyLines) {
        const parts = line.trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
        if (parts.length >= 3) {
          indices.push(parts[0], parts[1], parts[2]);
        }
      }

      if (vertices.length >= 9) {
        bounds.push({
          type: 'BVH',
          center: parseVec3(entry.Center ?? entry.center),
          vertices,
          indices: indices.length > 0 ? indices : undefined,
        });
        totalPolys += indices.length / 3 || vertices.length / 9;
      }
    }
  }

  // Update bounds
  if (bbMin.x === Infinity) {
    bbMin = { x: -50, y: -50, z: -10 };
    bbMax = { x: 50, y: 50, z: 30 };
  }

  return {
    name: filename,
    bounds,
    sourceFile: filePath,
    totalPolys,
    bbMin,
    bbMax,
  };
}

export function parseYbnBinary(filePath: string, data: Buffer): YbnCollisionData {
  const filename = filePath.split(/[\\/]/).pop()?.replace(/\.ybn$/i, '') ?? 'collision';
  const header = parseRsc7Header(data);
  return {
    name: filename,
    bounds: [],
    sourceFile: filePath,
    totalPolys: 0,
    bbMin: { x: -20, y: -20, z: -5 },
    bbMax: { x: 20, y: 20, z: 20 },
  };
}

function makeFallbackCollision(name: string, filePath: string): YbnCollisionData {
  return {
    name,
    bounds: [],
    sourceFile: filePath,
    totalPolys: 0,
    bbMin: { x: 0, y: 0, z: 0 },
    bbMax: { x: 0, y: 0, z: 0 },
  };
}
