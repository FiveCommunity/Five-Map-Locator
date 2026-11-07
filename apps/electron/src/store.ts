// ============================================================
// Native Desktop Storage — Atomic & Compact Local Cache
// Saves analysis metadata cleanly in ~/.five-map-locator/analyses.json
// ============================================================

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type { ResourceAnalysis } from '@five-map/shared';

interface StoreSchema {
  analyses: Record<string, ResourceAnalysis>;
}

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.five-map-locator');
let dataDir = DEFAULT_DATA_DIR;
let dbFilePath = path.join(DEFAULT_DATA_DIR, 'analyses.json');

export function getDataDir(): string {
  return dataDir;
}

export function initNativeStore(customDir?: string): void {
  dataDir = customDir || DEFAULT_DATA_DIR;
  fs.mkdirSync(dataDir, { recursive: true });
  dbFilePath = path.join(dataDir, 'analyses.json');
  if (!fs.existsSync(dbFilePath)) {
    saveStore({ analyses: {} });
  } else {
    loadStore();
  }
}

/**
 * Strips heavy 3D vertex/index arrays and raw entity lists before persisting,
 * keeping each saved analysis around ~2-5 KB and preventing ENOSPC forever.
 */
export function compactAnalysis(analysis: ResourceAnalysis): ResourceAnalysis {
  return {
    ...analysis,
    modelsMap: {},
    texturesMap: {},
    collisionsMap: {},
    mlos: (analysis.mlos ?? []).map((m) => ({
      ...m,
      entities: [],
    })),
    files: (analysis.files ?? []).map((f) => ({
      path: f.path,
      filename: f.filename,
      format: f.format,
      size: f.size,
      parseSuccess: f.parseSuccess,
      errors: f.errors ?? [],
      warnings: f.warnings ?? [],
      hasCoordinates: f.hasCoordinates,
      entityCount: f.entityCount,
    })),
  };
}

function loadStore(): StoreSchema {
  try {
    if (fs.existsSync(dbFilePath)) {
      const content = fs.readFileSync(dbFilePath, 'utf-8').trim();
      if (!content) return { analyses: {} };
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && parsed.analyses) {
        return parsed as StoreSchema;
      }
    }
  } catch {
    // Auto-recover from truncated/corrupt JSON
    saveStore({ analyses: {} });
  }
  return { analyses: {} };
}

function saveStore(store: StoreSchema): void {
  const tmpPath = `${dbFilePath}.tmp`;
  try {
    fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    fs.writeFileSync(tmpPath, JSON.stringify(store), 'utf-8');
    fs.renameSync(tmpPath, dbFilePath);
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {}
    console.error('[Store] Failed atomic write:', err);
  }
}

export function saveAnalysis(analysis: ResourceAnalysis): ResourceAnalysis {
  const clean = compactAnalysis(analysis);
  const store = loadStore();
  store.analyses[clean.id] = clean;
  saveStore(store);
  return clean;
}

export function getAnalysis(id: string): ResourceAnalysis | null {
  const store = loadStore();
  return store.analyses[id] ?? null;
}

export function listAnalyses(limit = 50, offset = 0): ResourceAnalysis[] {
  const store = loadStore();
  const list = Object.values(store.analyses).sort((a, b) => b.timestamp - a.timestamp);
  return list.slice(offset, offset + limit);
}

export function deleteAnalysis(id: string): boolean {
  const store = loadStore();
  if (!(id in store.analyses)) return false;
  delete store.analyses[id];
  saveStore(store);
  return true;
}

export function clearAllAnalyses(): void {
  saveStore({ analyses: {} });
}

export function getStats(): { total: number; confirmed: number; unidentified: number } {
  const store = loadStore();
  const items = Object.values(store.analyses);
  const total = items.length;
  const confirmed = items.filter((a) => a.locationResult?.status === 'CONFIRMED').length;
  const unidentified = items.filter((a) => a.locationResult?.status === 'UNIDENTIFIED').length;
  return { total, confirmed, unidentified };
}
