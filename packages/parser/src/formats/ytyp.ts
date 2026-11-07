// ============================================================
// YTYP Parser — GTA V Archetype Definitions & MLO Specs
// Supports CBaseArchetypeDef, CTimeArchetypeDef, and CMloArchetypeDef
// Extracts rooms, portals, attached entities, and object bounds
// ============================================================

import { XMLParser } from 'fast-xml-parser';
import type { YtypData, ParsedArchetype, MloRoom, MloPortal, MloInstance, ParsedEntity, Vec3, Vec4 } from '@five-map/shared';
import { parseRsc7Header } from '../rsc7';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  isArray: (name) => ['Item', 'Room', 'Portal', 'Entity'].includes(name),
});

function parseVec3(node: any): Vec3 {
  if (!node) return { x: 0, y: 0, z: 0 };
  return {
    x: parseFloat(node['@_x'] ?? node.x ?? 0) || 0,
    y: parseFloat(node['@_y'] ?? node.y ?? 0) || 0,
    z: parseFloat(node['@_z'] ?? node.z ?? 0) || 0,
  };
}

function parseVec4(node: any): Vec4 {
  if (!node) return { x: 0, y: 0, z: 0, w: 1 };
  return {
    x: parseFloat(node['@_x'] ?? node.x ?? 0) || 0,
    y: parseFloat(node['@_y'] ?? node.y ?? 0) || 0,
    z: parseFloat(node['@_z'] ?? node.z ?? 0) || 0,
    w: parseFloat(node['@_w'] ?? node.w ?? 1) ?? 1,
  };
}

function parseValue(node: any, defaultVal = 0): number {
  if (!node) return defaultVal;
  const v = typeof node === 'object' ? (node['@_value'] ?? node.value) : node;
  const n = parseFloat(v);
  return isNaN(n) ? defaultVal : n;
}

function parseMloRooms(roomsNode: any): MloRoom[] {
  const rawRooms = roomsNode?.Item ?? roomsNode?.Room;
  const list = Array.isArray(rawRooms) ? rawRooms : (rawRooms ? [rawRooms] : []);
  const rooms: MloRoom[] = [];

  let idx = 0;
  for (const r of list) {
    const name = String(r.name ?? r.Name ?? `room_${idx}`);
    const bbMin = parseVec3(r.bbMin);
    const bbMax = parseVec3(r.bbMax);
    const portalCount = parseValue(r.portalCount, 0);

    const rawObjs = r.attachedObjects?.Item;
    const attachedObjects = Array.isArray(rawObjs) ? rawObjs.map(Number) : [];

    rooms.push({
      index: idx++,
      name,
      bbMin,
      bbMax,
      portalCount,
      attachedObjects,
    });
  }

  return rooms;
}

function parseMloPortals(portalsNode: any): MloPortal[] {
  const rawPortals = portalsNode?.Item ?? portalsNode?.Portal;
  const list = Array.isArray(rawPortals) ? rawPortals : (rawPortals ? [rawPortals] : []);
  const portals: MloPortal[] = [];

  let idx = 0;
  for (const p of list) {
    const fromRoom = parseValue(p.from, 0);
    const toRoom = parseValue(p.to, 0);
    const flags = parseValue(p.flags, 0);

    // Corners of the portal aperture
    const corners: Vec3[] = [];
    const rawCorners = p.corners?.Item;
    if (Array.isArray(rawCorners)) {
      for (const c of rawCorners) {
        corners.push(parseVec3(c));
      }
    }

    portals.push({
      index: idx++,
      fromRoom,
      toRoom,
      flags,
      corners,
      mirror: parseValue(p.mirror, 0) === 1,
    });
  }

  return portals;
}

function parseArchetypeItem(item: any): { archetype: ParsedArchetype; mlo?: MloInstance } | null {
  if (!item) return null;
  const name = String(item.name ?? item.archetypeName ?? '');
  if (!name) return null;

  const itemType = String(item['@_type'] ?? item.type ?? '');
  const isMlo = itemType === 'CMloArchetypeDef' || Boolean(item.rooms) || Boolean(item.portals);

  const bbMin = parseVec3(item.bbMin);
  const bbMax = parseVec3(item.bbMax);

  let rooms: MloRoom[] | undefined;
  let portals: MloPortal[] | undefined;
  let mloEntities: ParsedEntity[] | undefined;
  let mloInstance: MloInstance | undefined;

  if (isMlo) {
    rooms = parseMloRooms(item.rooms);
    portals = parseMloPortals(item.portals);

    // MLO attached entities
    const rawEnts = item.entities?.Item;
    const entList = Array.isArray(rawEnts) ? rawEnts : (rawEnts ? [rawEnts] : []);
    mloEntities = [];

    for (const ent of entList) {
      const pos = parseVec3(ent.position);
      if (pos) {
        mloEntities.push({
          archetypeName: String(ent.archetypeName ?? ent.archetypeNam ?? ''),
          position: pos,
          rotation: parseVec4(ent.rotation),
          scaleXY: parseValue(ent.scaleXY, 1),
          scaleZ: parseValue(ent.scaleZ, 1),
          lodDist: parseValue(ent.lodDist, 500),
          flags: parseValue(ent.flags, 0),
          guid: parseValue(ent.guid, 0),
          parentIndex: parseValue(ent.parentIndex, -1),
          lodLevel: String(ent.lodLevel ?? 'LODLEVEL_HIGH'),
          isMlo: true,
          mloInstanceName: name,
        });
      }
    }

    mloInstance = {
      name,
      archetypeName: name,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      rooms,
      portals,
      entities: mloEntities,
      bbMin,
      bbMax,
    };
  }

  const archetype: ParsedArchetype = {
    name,
    bbMin,
    bbMax,
    hdTextureDist: parseValue(item.hdTextureDist, 60),
    lodDist: parseValue(item.lodDist, 500),
    textureDictionary: String(item.textureDictionary ?? ''),
    drawableDictionary: String(item.drawableDictionary ?? ''),
    physicsDictionary: String(item.physicsDictionary ?? ''),
    assetType: String(item.assetType ?? 'ASSET_TYPE_DRAWABLE'),
    flags: parseValue(item.flags, 0),
    isMlo,
    rooms,
    portals,
    entities: mloEntities,
  };

  return { archetype, mlo: mloInstance };
}

export function parseYtypXml(filePath: string, data: Buffer): YtypData {
  const warnings: string[] = [];
  let xmlText: string;

  try {
    xmlText = data.toString('utf8');
  } catch {
    return makeEmptyYtyp(filePath, ['Failed to decode as UTF-8']);
  }

  let parsed: any;
  try {
    parsed = xmlParser.parse(xmlText);
  } catch (e) {
    return makeEmptyYtyp(filePath, [`XML parse error: ${(e as Error).message}`]);
  }

  const root = parsed?.CMapTypes ?? parsed?.CMapTypesFile;
  if (!root) {
    return makeEmptyYtyp(filePath, ['No CMapTypes root element found']);
  }

  const rawItems = root.archetypes?.Item;
  const archetypes: ParsedArchetype[] = [];
  const mlos: MloInstance[] = [];

  const items = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);

  for (const item of items) {
    const res = parseArchetypeItem(item);
    if (res) {
      archetypes.push(res.archetype);
      if (res.mlo) mlos.push(res.mlo);
    }
  }

  return {
    name: String(root.name ?? ''),
    archetypes,
    mlos,
    sourceFile: filePath,
    parseWarnings: warnings,
  };
}

export function parseYtypBinary(filePath: string, data: Buffer): YtypData {
  const header = parseRsc7Header(data);
  const warnings = [
    header
      ? `Binary YTYP (RSC7 v${header.version}). Export to XML via CodeWalker for complete archetype data.`
      : 'File lacks RSC7 magic',
  ];

  return makeEmptyYtyp(filePath, warnings);
}

function makeEmptyYtyp(filePath: string, warnings: string[]): YtypData {
  return { name: '', archetypes: [], mlos: [], sourceFile: filePath, parseWarnings: warnings };
}
