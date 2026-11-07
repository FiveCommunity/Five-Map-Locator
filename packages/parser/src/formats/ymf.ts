// ============================================================
// YMF Parser — GTA V Manifest File Format (CMapTypesData)
// Parses both XML manifest (_manifest.ymf.xml) and binary PSIN / PSO / RSC7
// Extracts linked YMAP/YTYP dependencies and interior world positions/bounds
// ============================================================

import { XMLParser } from 'fast-xml-parser';
import type { YmfData, Vec3 } from '@five-map/shared';
import { isValidGtaCoord } from '@five-map/shared';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  isArray: (name) => ['Item', 'imapDependencies', 'itypDependencies', 'interiors'].includes(name),
});

function parseVec3(node: any): Vec3 | null {
  if (!node) return null;
  const x = parseFloat(node['@_x'] ?? node.x);
  const y = parseFloat(node['@_y'] ?? node.y);
  const z = parseFloat(node['@_z'] ?? node.z);
  if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
  return { x, y, z };
}

export function parseYmfXml(filePath: string, data: Buffer): YmfData {
  const filename = filePath.split(/[\\/]/).pop()?.replace(/(\.ymf)?\.xml$/i, '').replace(/\.ymf$/i, '') ?? 'manifest';
  const text = data.toString('utf-8');
  let parsed: any;
  const warnings: string[] = [];

  try {
    parsed = xmlParser.parse(text);
  } catch (err) {
    return {
      name: filename,
      imapDependencies: [],
      itypDependencies: [],
      interiors: [],
      sourceFile: filePath,
      parseWarnings: [`XML Parse Error: ${(err as Error).message}`],
    };
  }

  const root = parsed?.CMapTypesData ?? parsed?.CMapData ?? parsed;
  const imapDependencies: string[] = [];
  const itypDependencies: string[] = [];
  const interiors: YmfData['interiors'] = [];

  // Extract imap dependencies
  const rawImap = root?.imapDependencies_2?.Item ?? root?.imapDependencies?.Item ?? root?.imapDependencies;
  if (Array.isArray(rawImap)) {
    for (const item of rawImap) {
      const val = typeof item === 'object' ? String(item['#text'] ?? item['@_value'] ?? item.name ?? '') : String(item);
      if (val) imapDependencies.push(val);
    }
  }

  // Extract ityp dependencies
  const rawItyp = root?.itypDependencies_2?.Item ?? root?.itypDependencies?.Item ?? root?.itypDependencies;
  if (Array.isArray(rawItyp)) {
    for (const item of rawItyp) {
      const val = typeof item === 'object' ? String(item['#text'] ?? item['@_value'] ?? item.name ?? '') : String(item);
      if (val) itypDependencies.push(val);
    }
  }

  // Extract interiors with exact spatial coordinates
  const rawInteriors = root?.interiors?.Item ?? root?.interiors;
  if (Array.isArray(rawInteriors)) {
    for (const item of rawInteriors) {
      const name = String(item.name ?? item['@_name'] ?? item['#text'] ?? 'interior');
      const pos = parseVec3(item.position ?? item.pos ?? item.entrance);
      const bbMin = parseVec3(item.bbMin ?? item.BoundingBoxMin);
      const bbMax = parseVec3(item.bbMax ?? item.BoundingBoxMax);

      interiors.push({
        name,
        position: pos && isValidGtaCoord(pos) ? pos : undefined,
        bbMin: bbMin && isValidGtaCoord(bbMin) ? bbMin : undefined,
        bbMax: bbMax && isValidGtaCoord(bbMax) ? bbMax : undefined,
      });
    }
  }

  return {
    name: filename,
    imapDependencies,
    itypDependencies,
    interiors,
    sourceFile: filePath,
    parseWarnings: warnings,
  };
}

export function parseYmfBinary(filePath: string, data: Buffer): YmfData {
  const filename = filePath.split(/[\\/]/).pop()?.replace(/\.ymf$/i, '') ?? 'manifest';
  const warnings: string[] = [];
  const imapDependencies: string[] = [];
  const itypDependencies: string[] = [];
  const interiors: YmfData['interiors'] = [];

  // PSIN (RAGE PSO) or RSC7 format
  const magic = data.slice(0, 4).toString('utf8');
  if (magic !== 'PSIN' && magic !== 'RSC7') {
    warnings.push(`Non-standard manifest header: "${magic}"`);
  }

  // Extract string tokens matching common GTA map/ytyp filenames
  const str = data.toString('utf8');
  const tokens = str.match(/[a-zA-Z0-9_]{3,35}/g) || [];

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower.endsWith('.ymap') || lower.includes('_map') || lower.startsWith('map_')) {
      imapDependencies.push(token);
    } else if (lower.endsWith('.ytyp') || lower.includes('mlo') || lower.includes('_interior')) {
      itypDependencies.push(token);
    }
  }

  // Search for valid interior coordinate triplets in binary payload
  for (let i = 16; i < data.length - 12; i += 4) {
    const x = data.readFloatLE(i);
    const y = data.readFloatLE(i + 4);
    const z = data.readFloatLE(i + 8);

    if (
      x >= -3500 && x <= 4500 &&
      y >= -4500 && y <= 8500 &&
      z >= -50 && z <= 1200 &&
      Math.abs(x) > 20 && Math.abs(y) > 20
    ) {
      const alreadyHave = interiors.some(
        int => int.position && Math.abs(int.position.x - x) < 1 && Math.abs(int.position.y - y) < 1
      );
      if (!alreadyHave) {
        interiors.push({
          name: `${filename}_interior_${interiors.length + 1}`,
          position: { x, y, z },
        });
      }
    }
  }

  return {
    name: filename,
    imapDependencies: [...new Set(imapDependencies)],
    itypDependencies: [...new Set(itypDependencies)],
    interiors,
    sourceFile: filePath,
    parseWarnings: warnings,
  };
}
