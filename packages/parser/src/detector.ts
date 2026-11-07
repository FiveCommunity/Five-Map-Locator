// ============================================================
// Format Auto-Detector
// Determines the correct FileFormat from file extension + magic bytes.
// Distinguishes XML exports from raw RSC7 binaries.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { FileFormat } from '@five-map/shared';
import { isBinaryRage } from './rsc7';

function readMagicBytes(filePath: string, count = 16): Buffer {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(count);
  try {
    fs.readSync(fd, buf, 0, count, 0);
  } finally {
    fs.closeSync(fd);
  }
  return buf;
}

function isXmlContent(buf: Buffer): boolean {
  const peek = buf.slice(0, 10).toString('utf8');
  return peek.startsWith('<?xml') || peek.startsWith('<CMap') || peek.startsWith('<CMlo') ||
         peek.startsWith('<Drawable') || peek.startsWith('<Bounds') || peek.startsWith('<Texture');
}

function isGlbBinary(buf: Buffer): boolean {
  return buf.length >= 4 &&
    buf[0] === 0x67 && buf[1] === 0x6C && buf[2] === 0x54 && buf[3] === 0x46;
}

function isGltfJson(filePath: string): boolean {
  try {
    const buf = readMagicBytes(filePath, 20);
    const s = buf.toString('utf8').trimStart();
    return s.startsWith('{');
  } catch {
    return false;
  }
}

export function detectFileFormat(filePath: string): FileFormat {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  let magic: Buffer;

  try {
    magic = readMagicBytes(filePath);
  } catch {
    return 'UNKNOWN';
  }

  // === PSIN (RAGE PSO) or RSC7 binary manifest ===
  const magicStr = magic.slice(0, 4).toString('utf8');
  if (magicStr === 'PSIN' || isBinaryRage(magic)) {
    switch (ext) {
      case '.ymap': return 'YMAP_BINARY';
      case '.ytyp': return 'YTYP_BINARY';
      case '.ydr':  return 'YDR_BINARY';
      case '.ydd':  return 'YDD_BINARY';
      case '.ybn':  return 'YBN_BINARY';
      case '.ytd':  return 'YTD_BINARY';
      case '.yft':  return 'YFT_BINARY';
      case '.ymf':  return 'YMF_BINARY';
      default:      return ext === '.ymf' ? 'YMF_BINARY' : 'YMAP_BINARY';
    }
  }

  if (ext === '.ymf') {
    return isXmlContent(magic) ? 'XML_GENERIC' : 'YMF_BINARY';
  }

  // === GLB binary ===
  if (isGlbBinary(magic)) return 'GLB';

  // Check double extensions like file.ydr.xml or file.ybn.xml
  const isXml = isXmlContent(magic);

  if (base.endsWith('.ydr.xml') || (ext === '.ydr' && isXml)) return 'YDR_XML';
  if (base.endsWith('.ybn.xml') || (ext === '.ybn' && isXml)) return 'YBN_XML';
  if (base.endsWith('.ymap.xml') || (ext === '.ymap' && isXml)) return 'YMAP_XML';
  if (base.endsWith('.ytyp.xml') || (ext === '.ytyp' && isXml)) return 'YTYP_XML';

  switch (ext) {
    case '.ymap':
      return isXml ? 'YMAP_XML' : 'INVALID_BINARY';
    case '.ytyp':
      return isXml ? 'YTYP_XML' : 'INVALID_BINARY';
    case '.ydr':
      return isXml ? 'YDR_XML' : 'INVALID_BINARY';
    case '.ybn':
      return isXml ? 'YBN_XML' : 'INVALID_BINARY';
    case '.meta':
      return isXml ? 'META_XML' : 'INVALID_BINARY';
    case '.xml':
      return isXml ? 'XML_GENERIC' : 'INVALID_BINARY';
    case '.obj':
      return 'OBJ';
    case '.fbx':
      return 'FBX';
    case '.gltf':
      return isGltfJson(filePath) ? 'GLTF' : 'UNKNOWN';
    case '.glb':
      return 'GLB';
    case '.lua':
      if (base === 'fxmanifest.lua') return 'FXMANIFEST';
      return 'UNKNOWN';
    case '.ydd': case '.ytd': case '.yft': case '.ymf':
      return 'INVALID_BINARY';
    default:
      return 'UNKNOWN';
  }
}

export function formatHasSpatialData(format: FileFormat): boolean {
  return ['YMAP_XML', 'YMAP_BINARY', 'YTYP_XML', 'YTYP_BINARY', 'META_XML', 'XML_GENERIC'].includes(format);
}

export function formatIs3DModel(format: FileFormat): boolean {
  return ['OBJ', 'FBX', 'GLTF', 'GLB', 'YDR_XML', 'YDR_BINARY', 'YDD_BINARY'].includes(format);
}
