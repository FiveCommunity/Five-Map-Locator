// ============================================================
// Region Matcher
// Cross-references a Vec3 position against the GTA V region map.
// Returns the best matching region + all overlapping regions.
// ============================================================

import type { Vec3, GtaRegion, Evidence } from '@five-map/shared';
import { GTA_REGIONS, CONFIDENCE_WEIGHTS, VANILLA_ARCHETYPE_PREFIXES } from '@five-map/shared';

export interface RegionMatch {
  region: GtaRegion;
  confidence: number;
}

/** Find the most specific region containing a point */
export function matchRegion(pos: Vec3): GtaRegion | null {
  // Filter to regions that actually contain this point
  const matches = GTA_REGIONS.filter(r =>
    pos.x >= r.xMin && pos.x <= r.xMax &&
    pos.y >= r.yMin && pos.y <= r.yMax &&
    r.id !== 'ocean' // Ocean is catch-all, prefer specifics
  );

  if (matches.length === 0) {
    // Check if it's in ocean/outside
    const isInWorldBounds = pos.x >= -4000 && pos.x <= 5000 && pos.y >= -5000 && pos.y <= 9000;
    if (isInWorldBounds) return GTA_REGIONS.find(r => r.id === 'ocean') ?? null;
    return null;
  }

  // Sort by area (smallest = most specific) and return the best match
  matches.sort((a, b) => {
    const areaA = (a.xMax - a.xMin) * (a.yMax - a.yMin);
    const areaB = (b.xMax - b.xMin) * (b.yMax - b.yMin);
    return areaA - areaB;
  });

  return matches[0];
}

/** Get all matching regions for a point (for multi-candidate display) */
export function matchAllRegions(pos: Vec3): RegionMatch[] {
  return GTA_REGIONS
    .filter(r => pos.x >= r.xMin && pos.x <= r.xMax && pos.y >= r.yMin && pos.y <= r.yMax)
    .map(r => {
      const area = (r.xMax - r.xMin) * (r.yMax - r.yMin);
      const maxArea = 9000 * 14000; // rough world size
      const confidence = r.id === 'ocean' ? 0.3 : Math.min(0.95, 1 - (area / maxArea));
      return { region: r, confidence };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

/** Check how many archetypes are vanilla GTA V models */
export function scoreVanillaArchetypes(archetypeNames: string[]): Evidence | null {
  if (archetypeNames.length === 0) return null;

  let vanillaCount = 0;
  for (const name of archetypeNames) {
    const lower = name.toLowerCase();
    if (VANILLA_ARCHETYPE_PREFIXES.some(prefix => lower.startsWith(prefix))) {
      vanillaCount++;
    }
  }

  const ratio = vanillaCount / archetypeNames.length;
  if (ratio === 0) return null;

  return {
    type: 'ARCHETYPE_MATCH',
    description: `${vanillaCount} of ${archetypeNames.length} archetypes match vanilla GTA V models (${(ratio * 100).toFixed(0)}%)`,
    weight: CONFIDENCE_WEIGHTS.ARCHETYPE_MATCH * ratio,
  };
}

/** Analyze filenames for GTA V region hints */
export function scoreFilenameHints(filenames: string[]): Evidence | null {
  const regionKeywords: Record<string, string> = {
    'airport': 'Los Santos International Airport',
    'lsia': 'Los Santos International Airport',
    'downtown': 'Downtown Los Santos',
    'vinewood': 'Vinewood Hills',
    'vespucci': 'Vespucci Beach',
    'sandy': 'Sandy Shores',
    'paleto': 'Paleto Bay',
    'chiliad': 'Mount Chiliad',
    'zancudo': 'Fort Zancudo',
    'del_perro': 'Del Perro',
    'chumash': 'Chumash',
    'grapeseed': 'Grapeseed',
    'alamo': 'Alamo Sea',
    'strawberry': 'Strawberry',
    'davis': 'Davis',
    'rockford': 'Rockford Hills',
    'eclipse': 'Rockford Hills',
  };

  const allText = filenames.join(' ').toLowerCase();
  const matches: string[] = [];

  for (const [keyword, region] of Object.entries(regionKeywords)) {
    if (allText.includes(keyword) && !matches.includes(region)) {
      matches.push(region);
    }
  }

  if (matches.length === 0) return null;

  return {
    type: 'FILENAME',
    description: `Filename hints suggest: ${matches.join(', ')}`,
    weight: CONFIDENCE_WEIGHTS.FILENAME,
  };
}
