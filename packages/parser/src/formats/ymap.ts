// ============================================================
// YMAP Parser — XML and Binary (header-only) paths
// Supports CEntityDef and CMloInstanceDef (MLO interiors)
// ============================================================

import * as zlib from 'zlib';
import { XMLParser } from 'fast-xml-parser';
import type { YmapData, ParsedEntity, MloInstance, Vec3, Vec4, BoundingBox } from '@five-map/shared';
import { isValidGtaCoord } from '@five-map/shared';
import { parseRsc7Header } from '../rsc7';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  isArray: (name) => ['Item', 'Room', 'Portal'].includes(name),
});

function parseVec3(node: any): Vec3 | null {
  if (!node) return null;
  const x = parseFloat(node['@_x'] ?? node.x);
  const y = parseFloat(node['@_y'] ?? node.y);
  const z = parseFloat(node['@_z'] ?? node.z);
  if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
  return { x, y, z };
}

function parseVec4(node: any): Vec4 {
  if (!node) return { x: 0, y: 0, z: 0, w: 1 };
  return {
    x: parseFloat(node['@_x'] ?? node.x) || 0,
    y: parseFloat(node['@_y'] ?? node.y) || 0,
    z: parseFloat(node['@_z'] ?? node.z) || 0,
    w: parseFloat(node['@_w'] ?? node.w) ?? 1,
  };
}

function parseValue(node: any, defaultVal = 0): number {
  if (!node) return defaultVal;
  const v = typeof node === 'object' ? (node['@_value'] ?? node.value) : node;
  const n = parseFloat(v);
  return isNaN(n) ? defaultVal : n;
}

function parseEntityItem(item: any, isMloSubEntity = false, mloInstanceName?: string): ParsedEntity | null {
  if (!item) return null;
  const position = parseVec3(item.position);
  if (!position) return null;

  return {
    archetypeName: String(item.archetypeName ?? item.archetypeNam ?? ''),
    position,
    rotation: parseVec4(item.rotation),
    scaleXY: parseValue(item.scaleXY, 1),
    scaleZ: parseValue(item.scaleZ, 1),
    lodDist: parseValue(item.lodDist, 500),
    flags: parseValue(item.flags, 0),
    guid: parseValue(item.guid, 0),
    parentIndex: parseValue(item.parentIndex, -1),
    lodLevel: String(item.lodLevel ?? 'LODLEVEL_HIGH'),
    isMlo: isMloSubEntity,
    mloInstanceName,
  };
}

function parseMloInstance(item: any): MloInstance | null {
  const position = parseVec3(item.position);
  if (!position) return null;

  const archetypeName = String(item.archetypeName ?? item.archetypeNam ?? item.name ?? '');
  const rotation = parseVec4(item.rotation);

  // Parse embedded entities in MLO instance
  const entities: ParsedEntity[] = [];
  const rawEntities = item.entities?.Item;
  const entityList = Array.isArray(rawEntities) ? rawEntities : (rawEntities ? [rawEntities] : []);
  for (const ent of entityList) {
    const parsed = parseEntityItem(ent, true, archetypeName);
    if (parsed) entities.push(parsed);
  }

  return {
    name: archetypeName,
    archetypeName,
    position,
    rotation,
    rooms: [],
    portals: [],
    entities,
    bbMin: { x: position.x - 25, y: position.y - 25, z: position.z - 10 },
    bbMax: { x: position.x + 25, y: position.y + 25, z: position.z + 20 },
  };
}

function parseBBox(minNode: any, maxNode: any): BoundingBox | null {
  const min = parseVec3(minNode);
  const max = parseVec3(maxNode);
  if (!min || !max) return null;
  return { min, max };
}

export function parseYmapXml(filePath: string, data: Buffer): YmapData {
  const warnings: string[] = [];
  let xmlText: string;

  try {
    xmlText = data.toString('utf8');
  } catch {
    return makeEmptyYmap(filePath, ['Failed to decode file as UTF-8']);
  }

  let parsed: any;
  try {
    parsed = xmlParser.parse(xmlText);
  } catch (e) {
    return makeEmptyYmap(filePath, [`XML parse error: ${(e as Error).message}`]);
  }

  const root = parsed?.CMapData ?? parsed?.CMapDataFile ?? parsed?.MapData;
  if (!root) {
    return makeEmptyYmap(filePath, ['No CMapData root element found in XML']);
  }

  const streamingExtents = parseBBox(root.streamingExtentsMin, root.streamingExtentsMax);
  const entitiesExtents  = parseBBox(root.entitiesExtentsMin, root.entitiesExtentsMax);

  const rawItems = root.entities?.Item;
  const entities: ParsedEntity[] = [];
  const mlos: MloInstance[] = [];

  const items = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);

  for (const item of items) {
    const itemType = String(item['@_type'] ?? item.type ?? '');

    if (itemType === 'CMloInstanceDef' || item.mloInstance || item.isMlo) {
      const mlo = parseMloInstance(item);
      if (mlo) {
        mlos.push(mlo);
        // Also register MLO position as primary entity
        entities.push({
          archetypeName: mlo.archetypeName,
          position: mlo.position,
          rotation: mlo.rotation,
          scaleXY: 1,
          scaleZ: 1,
          lodDist: 500,
          flags: 0,
          guid: 0,
          parentIndex: -1,
          lodLevel: 'LODLEVEL_HIGH',
          isMlo: true,
        });
      }
    } else {
      const entity = parseEntityItem(item);
      if (entity) {
        if (!isValidGtaCoord(entity.position)) {
          warnings.push(`Entity "${entity.archetypeName}" has out-of-bounds position: ${JSON.stringify(entity.position)}`);
        }
        entities.push(entity);
      }
    }
  }

  if (entities.length === 0) {
    warnings.push('No entities found in YMAP');
  }

  return {
    name: String(root.name ?? ''),
    parent: root.parent ? String(root.parent) : null,
    flags: parseValue(root.flags, 0),
    contentFlags: parseValue(root.contentFlags, 0),
    streamingExtents,
    entitiesExtents,
    entities,
    mlos,
    sourceFile: filePath,
    parseWarnings: warnings,
  };
}

export function parseYmapBinary(filePath: string, data: Buffer): YmapData {
  const filename = filePath.split(/[\\/]/).pop()?.replace(/\.ymap$/i, '') ?? 'map';
  const header = parseRsc7Header(data);
  if (!header) {
    return makeEmptyYmap(filePath, ['File lacks valid RSC7 header']);
  }

  const warnings: string[] = [];
  const entities: ParsedEntity[] = [];
  let streamingExtents: BoundingBox | null = null;
  let entitiesExtents: BoundingBox | null = null;

  try {
    const decomp = zlib.inflateRawSync(data.slice(16));
    const candidateCoords: Vec3[] = [];

    // Scan decompressed buffer for valid GTA V world positions
    for (let i = 0; i < decomp.length - 12; i += 4) {
      const x = decomp.readFloatLE(i);
      const y = decomp.readFloatLE(i + 4);
      const z = decomp.readFloatLE(i + 8);

      if (
        x >= -4000 && x <= 5000 &&
        y >= -5000 && y <= 9000 &&
        z >= -200 && z <= 2500 &&
        Math.abs(x) > 10 && Math.abs(y) > 10
      ) {
        const isDuplicate = candidateCoords.some(
          p => Math.abs(p.x - x) < 0.1 && Math.abs(p.y - y) < 0.1 && Math.abs(p.z - z) < 0.1
        );
        if (!isDuplicate) {
          candidateCoords.push({ x, y, z });
        }
      }
    }

    if (candidateCoords.length > 0) {
      // Step 1: Compute initial centroid to locate the primary facility/building
      const avgX = candidateCoords.reduce((s, c) => s + c.x, 0) / candidateCoords.length;
      const avgY = candidateCoords.reduce((s, c) => s + c.y, 0) / candidateCoords.length;
      const avgZ = candidateCoords.reduce((s, c) => s + c.z, 0) / candidateCoords.length;

      // Step 2: Keep only entities clustered within 450m of the compound center (eliminates stray binary memory noise)
      // and enforce a 1.2m spacing to prevent duplicate overlapping vertex floats
      const clusteredCoords: Vec3[] = [];
      const MAX_COMPOUND_RADIUS = 450;

      for (const c of candidateCoords) {
        const dx = c.x - avgX;
        const dy = c.y - avgY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= MAX_COMPOUND_RADIUS) {
          const isTooClose = clusteredCoords.some(
            p => Math.abs(p.x - c.x) < 1.2 && Math.abs(p.y - c.y) < 1.2 && Math.abs(p.z - c.z) < 1.0
          );
          if (!isTooClose) {
            clusteredCoords.push(c);
            if (clusteredCoords.length >= 180) break; // Optimal 60 FPS viewport ceiling
          }
        }
      }

      const finalCoords = clusteredCoords.length > 0 ? clusteredCoords : candidateCoords.slice(0, 100);

      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      for (const c of finalCoords) {
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.z < minZ) minZ = c.z;
        if (c.x > maxX) maxX = c.x;
        if (c.y > maxY) maxY = c.y;
        if (c.z > maxZ) maxZ = c.z;
      }

      streamingExtents = {
        min: { x: minX - 10, y: minY - 10, z: minZ - 5 },
        max: { x: maxX + 10, y: maxY + 10, z: maxZ + 10 },
      };

      entitiesExtents = {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
      };

      for (let i = 0; i < finalCoords.length; i++) {
        entities.push({
          archetypeName: `${filename}_ent_${i + 1}`,
          position: finalCoords[i],
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scaleXY: 1,
          scaleZ: 1,
          lodDist: 250,
          flags: 0,
          guid: i + 1,
          parentIndex: -1,
          lodLevel: 'LODLEVEL_HIGH',
        });
      }
    } else {
      warnings.push(`Binary YMAP (RSC7 v${header.version}) parsed but contained no valid coordinates.`);
    }
  } catch (err) {
    warnings.push(`Binary YMAP decompression failed: ${(err as Error).message}`);
  }

  return {
    name: filename,
    parent: null,
    flags: 0,
    contentFlags: 0,
    streamingExtents,
    entitiesExtents,
    entities,
    mlos: [],
    sourceFile: filePath,
    parseWarnings: warnings,
  };
}

function makeEmptyYmap(filePath: string, errors: string[]): YmapData {
  return {
    name: '',
    parent: null,
    flags: 0,
    contentFlags: 0,
    streamingExtents: null,
    entitiesExtents: null,
    entities: [],
    mlos: [],
    sourceFile: filePath,
    parseWarnings: errors,
  };
}
