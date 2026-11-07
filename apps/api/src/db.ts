// ============================================================
// Local JSON Storage — Atomic & Compact Analysis Cache
// Strips transient 3D geometry buffers and writes atomically via .tmp rename
// ============================================================

import * as path from 'path';
import * as fs from 'fs';
import type { ResourceAnalysis } from '@five-map/shared';

let dbFilePath = '';

interface StoreSchema {
  analyses: Record<string, ResourceAnalysis>;
}

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
    if (dbFilePath && fs.existsSync(dbFilePath)) {
      const content = fs.readFileSync(dbFilePath, 'utf-8').trim();
      if (!content) return { analyses: {} };
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && parsed.analyses) {
        return parsed as StoreSchema;
      }
    }
  } catch (err) {
    console.error('Store file corrupted, resetting cleanly:', err);
    saveStore({ analyses: {} });
  }
  return { analyses: {} };
}

function saveStore(store: StoreSchema): void {
  if (!dbFilePath) return;
  const tmpPath = `${dbFilePath}.tmp`;
  try {
    fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    fs.writeFileSync(tmpPath, JSON.stringify(store), 'utf-8');
    fs.renameSync(tmpPath, dbFilePath);
  } catch (err) {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    console.error('Failed writing store file:', err);
  }
}

export function initDb(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
  dbFilePath = path.join(dataDir, 'analyses.json');
  if (!fs.existsSync(dbFilePath)) {
    saveStore({ analyses: {} });
  } else {
    // Validate on startup
    loadStore();
  }
}

export function saveAnalysis(analysis: ResourceAnalysis): void {
  const store = loadStore();
  store.analyses[analysis.id] = compactAnalysis(analysis);
  saveStore(store);
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

export function deleteAnalysis(id: string): void {
  const store = loadStore();
  delete store.analyses[id];
  saveStore(store);
}

export function getStats(): { total: number; confirmed: number; unidentified: number } {
  const store = loadStore();
  const items = Object.values(store.analyses);
  const total = items.length;
  const confirmed = items.filter(a => a.locationResult?.status === 'CONFIRMED').length;
  const unidentified = items.filter(a => a.locationResult?.status === 'UNIDENTIFIED').length;
  return { total, confirmed, unidentified };
}
