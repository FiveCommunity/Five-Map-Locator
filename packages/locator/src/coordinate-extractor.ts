// ============================================================
// Coordinate Extractor
// Pulls every Vec3 coordinate out of parsed file results,
// validates them against GTA V world bounds, and collects evidence.
// ============================================================

import type { Vec3, BoundingBox, FileAnalysisResult, Evidence } from '@five-map/shared';
import { isValidGtaCoord, CONFIDENCE_WEIGHTS, GTA_SECTORS } from '@five-map/shared';

export interface ExtractedCoordinates {
  positions: Vec3[];
  boundingBoxes: BoundingBox[];
  evidence: Evidence[];
  fromExtents: boolean;    // true if coords come from YMAP root extents
  fromEntities: boolean;   // true if coords come from entity positions
  invalidCount: number;    // positions that failed world bounds check
}

export function extractCoordinates(files: FileAnalysisResult[]): ExtractedCoordinates {
  const positions: Vec3[] = [];
  const boundingBoxes: BoundingBox[] = [];
  const evidence: Evidence[] = [];
  let fromExtents = false;
  let fromEntities = false;
  let invalidCount = 0;

  // ---- Priority 0: Manifest (.ymf) Interior Placements & Exact Bounds ----
  for (const file of files) {
    if (!file.ymfData) continue;
    for (const interior of file.ymfData.interiors) {
      if (interior.position && isValidGtaCoord(interior.position)) {
        positions.push(interior.position);
        fromExtents = true;
        evidence.push({
          type: 'YMF_MANIFEST',
          description: `Manifest (${file.filename}) interior "${interior.name}" placed at (${interior.position.x.toFixed(1)}, ${interior.position.y.toFixed(1)}, ${interior.position.z.toFixed(1)})`,
          weight: CONFIDENCE_WEIGHTS.YMF_MANIFEST,
        });
      }
      if (interior.bbMin && interior.bbMax) {
        boundingBoxes.push({ min: interior.bbMin, max: interior.bbMax });
      }
    }
  }

  for (const file of files) {
    if (!file.ymapData) continue;
    const ymap = file.ymapData;

    // ---- Priority 1: Streaming / entities extents (most reliable) ----
    if (ymap.streamingExtents) {
      const se = ymap.streamingExtents;
      const center: Vec3 = {
        x: (se.min.x + se.max.x) / 2,
        y: (se.min.y + se.max.y) / 2,
        z: (se.min.z + se.max.z) / 2,
      };

      if (isValidGtaCoord(center)) {
        positions.push(center);
        boundingBoxes.push(se);
        fromExtents = true;
        evidence.push({
          type: 'YMAP_EXTENTS',
          description: `streamingExtents from ${file.filename}: center (${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)})`,
          weight: CONFIDENCE_WEIGHTS.YMAP_EXTENTS,
        });
      } else {
        invalidCount++;
      }
    }

    if (ymap.entitiesExtents) {
      const ee = ymap.entitiesExtents;
      const center: Vec3 = {
        x: (ee.min.x + ee.max.x) / 2,
        y: (ee.min.y + ee.max.y) / 2,
        z: (ee.min.z + ee.max.z) / 2,
      };

      if (isValidGtaCoord(center)) {
        // Don't duplicate if same as streaming extents
        const alreadyHave = positions.some(p => Math.abs(p.x - center.x) < 1 && Math.abs(p.y - center.y) < 1);
        if (!alreadyHave) {
          positions.push(center);
          boundingBoxes.push(ee);
          fromExtents = true;
        }
      }
    }

    // ---- Priority 2: Entity positions ----
    const entityPositions: Vec3[] = [];
    for (const entity of ymap.entities) {
      if (isValidGtaCoord(entity.position)) {
        entityPositions.push(entity.position);
      } else {
        invalidCount++;
      }
    }

    if (entityPositions.length > 0) {
      positions.push(...entityPositions);
      fromEntities = true;
      evidence.push({
        type: 'ENTITY_POSITIONS',
        description: `${entityPositions.length} valid entity positions from ${file.filename}`,
        weight: CONFIDENCE_WEIGHTS.ENTITY_POSITIONS,
      });
    }
  }

  // ---- Priority 3: GTA V Map Sector Grid matching from filenames ----
  if (positions.length === 0) {
    const sectorHits = new Map<string, number>();
    for (const file of files) {
      const lower = file.filename.toLowerCase();
      for (const sectorKey of Object.keys(GTA_SECTORS)) {
        if (lower.includes(sectorKey)) {
          sectorHits.set(sectorKey, (sectorHits.get(sectorKey) ?? 0) + 1);
        }
      }
    }

    if (sectorHits.size > 0) {
      const bestSector = Array.from(sectorHits.entries()).sort((a, b) => b[1] - a[1])[0];
      const sectorInfo = GTA_SECTORS[bestSector[0]];
      if (sectorInfo) {
        positions.push(sectorInfo.pos);
        boundingBoxes.push({
          min: { x: sectorInfo.pos.x - 200, y: sectorInfo.pos.y - 200, z: sectorInfo.pos.z - 20 },
          max: { x: sectorInfo.pos.x + 200, y: sectorInfo.pos.y + 200, z: sectorInfo.pos.z + 50 },
        });
        evidence.push({
          type: 'FILENAME',
          description: `Map sector "${bestSector[0]}" recognized across ${bestSector[1]} file(s) -> (${sectorInfo.pos.x}, ${sectorInfo.pos.y}, ${sectorInfo.pos.z})`,
          weight: 0.7,
        });
      }
    }
  }

  return { positions, boundingBoxes, evidence, fromExtents, fromEntities, invalidCount };
}

/** Extract archetype names for matching against known GTA vanilla models */
export function extractArchetypeNames(files: FileAnalysisResult[]): string[] {
  const names: string[] = [];
  for (const file of files) {
    if (file.ymapData) {
      names.push(...file.ymapData.entities.map(e => e.archetypeName).filter(Boolean));
    }
    if (file.ytypData) {
      names.push(...file.ytypData.archetypes.map(a => a.name).filter(Boolean));
    }
  }
  return [...new Set(names)];
}
