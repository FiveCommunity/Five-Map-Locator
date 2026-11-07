// ============================================================
// Location Engine — Main Orchestrator
// Takes a completed ResourceAnalysis, runs the full pipeline:
//   1. Extract coordinates from all parsed files
//   2. Score confidence
//   3. Match regions
//   4. Build LocationResult
// ============================================================

import type { LocationResult, ResourceAnalysis, Evidence, LocationCandidate, Vec3 } from '@five-map/shared';
import { computeBoundingBox } from '@five-map/shared';
import { extractCoordinates, extractArchetypeNames } from './coordinate-extractor';
import { matchRegion, matchAllRegions, scoreVanillaArchetypes, scoreFilenameHints } from './region-matcher';
import { scoreConfidence } from './confidence-scorer';

export function locateResource(
  analysis: Omit<ResourceAnalysis, 'id' | 'timestamp' | 'locationResult'>
): LocationResult {
  const { files } = analysis;

  // ---- Step 1: Extract coordinates ----
  const extracted = extractCoordinates(files);
  const archetypeNames = extractArchetypeNames(files);
  const filenames = files.map(f => f.filename);

  // ---- Step 2: Collect all evidence ----
  const evidence: Evidence[] = [...extracted.evidence];

  // Vanilla archetype scoring
  const vanillaEvidence = scoreVanillaArchetypes(archetypeNames);
  if (vanillaEvidence) evidence.push(vanillaEvidence);

  // Filename hint scoring
  const filenameEvidence = scoreFilenameHints(filenames);
  if (filenameEvidence) evidence.push(filenameEvidence);

  // ---- Step 3: Score confidence ----
  const scoring = scoreConfidence(
    extracted.positions,
    evidence,
    extracted.fromExtents,
    extracted.fromEntities,
    extracted.invalidCount
  );

  // ---- Step 4: Match primary region ----
  const primaryRegion = scoring.centroid ? matchRegion(scoring.centroid) : null;

  // ---- Step 5: Compute bounding box ----
  const boundingBox = extracted.positions.length > 0
    ? (extracted.boundingBoxes[0] ?? computeBoundingBox(extracted.positions))
    : null;

  // ---- Step 6: Build candidates from all matched regions ----
  const candidates: LocationCandidate[] = [];
  if (scoring.centroid) {
    const regionMatches = matchAllRegions(scoring.centroid);
    for (const { region, confidence } of regionMatches) {
      candidates.push({
        coordinates: scoring.centroid,
        region,
        confidence: parseFloat((confidence * scoring.confidence).toFixed(3)),
        evidence,
      });
    }
  }

  // ---- Step 7: Collect all warnings ----
  const warnings = [
    ...scoring.warnings,
    ...files.flatMap(f => f.warnings),
    ...analysis.structuralIssues,
  ];

  return {
    status: scoring.status,
    primaryCoordinates: scoring.centroid,
    primaryRegion,
    boundingBox,
    confidence: scoring.confidence,
    evidence,
    candidates,
    centroid: scoring.centroid,
    entityCount: analysis.totalEntities,
    warnings: [...new Set(warnings)], // deduplicate
  };
}
