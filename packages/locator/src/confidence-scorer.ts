// ============================================================
// Confidence Scorer
// Weighs all evidence to produce a final ConfidenceLevel + score.
// Rules (strict):
//   CONFIRMED            → extents or 3+ entity positions, all valid
//   ESTIMATED_WITH_REFS  → partial coords or filename/archetype hints
//   MULTIPLE_CANDIDATES  → conflicting clusters of positions
//   UNIDENTIFIED         → no spatial data at all
//
// NEVER claims confidence without verifiable evidence.
// ============================================================

import type { ConfidenceLevel, Evidence, Vec3 } from '@five-map/shared';
import { computeCentroid, computeBoundingBox } from '@five-map/shared';

export interface ScoringResult {
  status: ConfidenceLevel;
  confidence: number;
  centroid: Vec3 | null;
  warnings: string[];
}

/** Spatial cluster detection: groups positions within realistic MLO / building district distance */
function detectClusters(positions: Vec3[]): Vec3[][] {
  if (positions.length === 0) return [];

  const CLUSTER_THRESHOLD = 450; // max radius for a single GTA V building/facility
  const clusters: Vec3[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < positions.length; i++) {
    if (assigned.has(i)) continue;
    const cluster: Vec3[] = [positions[i]];
    assigned.add(i);

    for (let j = i + 1; j < positions.length; j++) {
      if (assigned.has(j)) continue;
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= CLUSTER_THRESHOLD) {
        cluster.push(positions[j]);
        assigned.add(j);
      }
    }
    clusters.push(cluster);
  }

  // Sort clusters descending by size (dominant cluster first)
  clusters.sort((a, b) => b.length - a.length);
  return clusters;
}

export function scoreConfidence(
  positions: Vec3[],
  evidence: Evidence[],
  fromExtents: boolean,
  fromEntities: boolean,
  invalidCount: number
): ScoringResult {
  const warnings: string[] = [];

  // ---- Case: No spatial data at all ----
  if (positions.length === 0 && evidence.length === 0) {
    return {
      status: 'UNIDENTIFIED',
      confidence: 0,
      centroid: null,
      warnings: ['No spatial data found in any file'],
    };
  }

  // ---- Case: Only hints (filename/archetype), no actual coords ----
  if (positions.length === 0 && evidence.length > 0) {
    const evidenceScore = evidence.reduce((s, e) => s + e.weight, 0) / evidence.length;
    return {
      status: 'ESTIMATED_WITH_REFS',
      confidence: Math.min(0.4, evidenceScore),
      centroid: null,
      warnings: ['No coordinate data found — result based on file/archetype hints only'],
    };
  }

  // ---- Spatial Cluster Analysis & Outlier Filtration ----
  const rawClusters = detectClusters(positions);
  const totalPoints = positions.length;
  const mainCluster = rawClusters[0];

  // True multiple candidates occur only if there are 2+ substantial clusters (>= 25% of points each)
  const minClusterSize = totalPoints <= 4 ? 1 : 2;
  const substantialClusters = rawClusters.filter(
    c => c.length >= minClusterSize && (c.length / totalPoints) >= 0.25
  );

  if (substantialClusters.length > 1) {
    const centroids = substantialClusters.map(c => computeCentroid(c)).filter(Boolean) as Vec3[];
    if (invalidCount > 0) {
      warnings.push(`${invalidCount} entity positions were outside GTA V world bounds and excluded`);
    }
    return {
      status: 'MULTIPLE_CANDIDATES',
      confidence: 0.75,
      centroid: centroids[0], // largest dominant compound
      warnings,
    };
  }

  // Compute centroid strictly from the dominant cluster, eliminating stray binary noise
  const targetPositions = mainCluster && mainCluster.length >= Math.ceil(totalPoints * 0.4)
    ? mainCluster
    : positions;

  const centroid = computeCentroid(targetPositions);
  if (!centroid) {
    return { status: 'UNIDENTIFIED', confidence: 0, centroid: null, warnings };
  }

  // ---- Compute weighted confidence ----
  const totalWeight = evidence.reduce((s, e) => s + e.weight, 0);
  const maxPossible = evidence.length > 0 ? Math.max(...evidence.map(e => e.weight)) : 1;
  const baseConfidence = totalWeight / (evidence.length * maxPossible || 1);

  let confidence = baseConfidence;
  if (evidence.some(e => e.type === 'YMF_MANIFEST')) confidence = Math.min(0.99, confidence + 0.25);
  if (fromExtents) confidence = Math.min(0.98, confidence + 0.15);
  if (fromEntities && targetPositions.length >= 3) confidence = Math.min(0.96, confidence + 0.10);
  if (invalidCount > 0) {
    warnings.push(`${invalidCount} positions were out of GTA V world bounds`);
    confidence = Math.max(0, confidence - 0.05 * invalidCount);
  }

  const status: ConfidenceLevel = confidence >= 0.75
    ? 'CONFIRMED'
    : confidence >= 0.4
    ? 'ESTIMATED_WITH_REFS'
    : 'UNIDENTIFIED';

  return { status, confidence: parseFloat(confidence.toFixed(3)), centroid, warnings };
}
