import type { Vec3, BoundingBox } from './types';
import { GTA_WORLD_BOUNDS } from './constants';

/** Check if coordinates are within GTA V world bounds */
export function isValidGtaCoord(pos: Vec3): boolean {
  return (
    pos.x >= GTA_WORLD_BOUNDS.xMin && pos.x <= GTA_WORLD_BOUNDS.xMax &&
    pos.y >= GTA_WORLD_BOUNDS.yMin && pos.y <= GTA_WORLD_BOUNDS.yMax &&
    pos.z >= GTA_WORLD_BOUNDS.zMin && pos.z <= GTA_WORLD_BOUNDS.zMax
  );
}

/** Compute geometric centroid of a set of positions */
export function computeCentroid(positions: Vec3[]): Vec3 | null {
  if (positions.length === 0) return null;
  const sum = positions.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: sum.x / positions.length,
    y: sum.y / positions.length,
    z: sum.z / positions.length,
  };
}

/** Compute bounding box from a set of positions */
export function computeBoundingBox(positions: Vec3[]): BoundingBox | null {
  if (positions.length === 0) return null;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of positions) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

/** Get midpoint of a bounding box */
export function bboxCenter(bb: BoundingBox): Vec3 {
  return {
    x: (bb.min.x + bb.max.x) / 2,
    y: (bb.min.y + bb.max.y) / 2,
    z: (bb.min.z + bb.max.z) / 2,
  };
}

/** Clamp a number to [min, max] */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Format Vec3 for display */
export function formatVec3(v: Vec3, decimals = 2): string {
  return `X: ${v.x.toFixed(decimals)}, Y: ${v.y.toFixed(decimals)}, Z: ${v.z.toFixed(decimals)}`;
}

/** Check if a buffer starts with RSC7 magic bytes */
export function isRsc7Buffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return buf[0] === 0x52 && buf[1] === 0x53 && buf[2] === 0x43 && buf[3] === 0x37;
}

/** Check if a buffer starts with XML declaration */
export function isXmlBuffer(buf: Buffer): boolean {
  const peek = buf.slice(0, 5).toString('utf8');
  return peek.startsWith('<?xml') || peek.startsWith('<CMap') || peek.startsWith('<CMap');
}

/** Sanitize a path to prevent directory traversal */
export function sanitizePath(inputPath: string, basePath: string): string | null {
  const path = require('path');
  const resolved = path.resolve(basePath, inputPath);
  if (!resolved.startsWith(path.resolve(basePath))) return null;
  return resolved;
}

/** Generate a random job ID */
export function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Format file size in human-readable form */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
