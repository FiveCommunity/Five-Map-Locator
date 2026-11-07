// ============================================================
// File Analysis Orchestrator
// Traverses resources, parses GTA V & generic 3D assets,
// correlates YMAP entities with YDR models and YTYP archetypes,
// builds 3D scene representation for the visualizer.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import type {
  FileAnalysisResult,
  ResourceAnalysis,
  YdrModelData,
  TextureDef,
  YbnCollisionData,
  MloInstance,
} from '@five-map/shared';
import { MAX_ZIP_SIZE_BYTES, MAX_SINGLE_FILE_SIZE_BYTES } from '@five-map/shared';
import { detectFileFormat } from './detector';
import { parseYmapXml, parseYmapBinary } from './formats/ymap';
import { parseYtypXml, parseYtypBinary } from './formats/ytyp';
import { parseYdrXml, parseYdrBinary } from './formats/ydr';
import { parseYbnXml, parseYbnBinary } from './formats/ybn';
import { parseYtdXml, parseYtdBinary } from './formats/ytd';
import { parseYmfXml, parseYmfBinary } from './formats/ymf';
import { parseObjGeometry, parseObjBasicInfo, parseGltfBasicInfo, parseGlbBasicInfo } from './formats/generic';

export type ProgressCallback = (processed: number, total: number, currentFile: string) => void;
export type CancelToken = { cancelled: boolean };

export interface AnalyzeOptions {
  skipGeometry?: boolean;
}

export function analyzeFile(filePath: string, skipGeometry = false): FileAnalysisResult {
  const filename = path.basename(filePath);
  const errors: string[] = [];
  const warnings: string[] = [];

  let size = 0;
  try {
    size = fs.statSync(filePath).size;
  } catch {
    return makeErrorResult(filePath, filename, ['File not accessible']);
  }

  if (size > MAX_SINGLE_FILE_SIZE_BYTES) {
    warnings.push('File exceeds 512MB — skipping content analysis');
    return {
      path: filePath, filename, format: 'UNKNOWN', size,
      parseSuccess: false, errors, warnings,
      hasCoordinates: false, entityCount: 0,
    };
  }

  const format = detectFileFormat(filePath);

  if (format === 'INVALID_BINARY') {
    return {
      path: filePath, filename, format, size,
      parseSuccess: false,
      errors: ['File has wrong magic bytes for its extension — not a valid RAGE or XML file'],
      warnings,
      hasCoordinates: false, entityCount: 0,
    };
  }

  if (format === 'UNKNOWN') {
    return {
      path: filePath, filename, format, size,
      parseSuccess: false, errors: [], warnings: ['Unrecognized file format'],
      hasCoordinates: false, entityCount: 0,
    };
  }

  // Fast-path for 3D geometry / texture / collision assets:
  // Coordinate localization only requires .ymap, .ytyp, and .ymf files.
  // Skipping full buffer reads for .ydr/.ybn/.ytd/.obj prevents multi-hundred-MB memory spikes and ENOSPC crashes.
  if (
    skipGeometry && (
      format === 'YDR_BINARY' ||
      format === 'YDR_XML' ||
      format === 'YBN_BINARY' ||
      format === 'YBN_XML' ||
      format === 'YTD_BINARY' ||
      format === 'YDD_BINARY' ||
      format === 'YFT_BINARY' ||
      format === 'FBX' ||
      format === 'OBJ' ||
      format === 'GLTF' ||
      format === 'GLB'
    )
  ) {
    return {
      path: filePath,
      filename,
      format,
      size,
      parseSuccess: true,
      errors,
      warnings,
      hasCoordinates: false,
      entityCount: format.startsWith('YDR') ? 1 : 0,
    };
  }

  try {
    const data = fs.readFileSync(filePath);

    switch (format) {
      case 'YMAP_XML': {
        const ymapData = parseYmapXml(filePath, data);
        const hasCoords = ymapData.streamingExtents !== null || ymapData.entities.length > 0;
        return {
          path: filePath, filename, format, size,
          parseSuccess: ymapData.parseWarnings.filter(w => w.includes('error')).length === 0,
          errors, warnings: [...warnings, ...ymapData.parseWarnings],
          ymapData,
          hasCoordinates: hasCoords,
          entityCount: ymapData.entities.length,
        };
      }

      case 'YMAP_BINARY': {
        const ymapData = parseYmapBinary(filePath, data);
        return {
          path: filePath, filename, format, size,
          parseSuccess: false,
          errors, warnings: [...warnings, ...ymapData.parseWarnings],
          ymapData,
          hasCoordinates: false,
          entityCount: 0,
        };
      }

      case 'YTYP_XML': {
        const ytypData = parseYtypXml(filePath, data);
        return {
          path: filePath, filename, format, size,
          parseSuccess: ytypData.parseWarnings.filter(w => w.includes('error')).length === 0,
          errors, warnings: [...warnings, ...ytypData.parseWarnings],
          ytypData,
          hasCoordinates: false,
          entityCount: ytypData.archetypes.length,
        };
      }

      case 'YTYP_BINARY': {
        const ytypData = parseYtypBinary(filePath, data);
        return {
          path: filePath, filename, format, size,
          parseSuccess: false,
          errors, warnings: [...warnings, ...ytypData.parseWarnings],
          ytypData,
          hasCoordinates: false,
          entityCount: 0,
        };
      }

      case 'YDR_XML': {
        const ydrData = parseYdrXml(filePath, data);
        return {
          path: filePath, filename, format, size,
          parseSuccess: ydrData.meshes.length > 0,
          errors, warnings,
          ydrData,
          hasCoordinates: false,
          entityCount: ydrData.meshes.length,
        };
      }

      case 'YDR_BINARY': {
        const ydrData = parseYdrBinary(filePath, data);
        return {
          path: filePath, filename, format, size,
          parseSuccess: true,
          errors, warnings: [...warnings, 'Binary YDR model — convert to XML for full mesh buffers'],
          ydrData,
          hasCoordinates: false,
          entityCount: 1,
        };
      }

      case 'YBN_XML': {
        const ybnData = parseYbnXml(filePath, data);
        return {
          path: filePath, filename, format, size,
          parseSuccess: ybnData.bounds.length > 0,
          errors, warnings,
          ybnData,
          hasCoordinates: false,
          entityCount: ybnData.bounds.length,
        };
      }

      case 'YBN_BINARY': {
        const ybnData = parseYbnBinary(filePath, data);
        return {
          path: filePath, filename, format, size,
          parseSuccess: true,
          errors, warnings: [...warnings, 'Binary YBN collision'],
          ybnData,
          hasCoordinates: false,
          entityCount: 0,
        };
      }

      case 'YMF_BINARY': {
        const ymfData = parseYmfBinary(filePath, data);
        const hasCoords = ymfData.interiors.some(i => !!i.position);
        return {
          path: filePath, filename, format, size,
          parseSuccess: true,
          errors, warnings: [...warnings, ...ymfData.parseWarnings],
          ymfData,
          hasCoordinates: hasCoords,
          entityCount: ymfData.interiors.length,
        };
      }

      case 'OBJ': {
        const ydrData = parseObjGeometry(filePath);
        return {
          path: filePath, filename, format, size,
          parseSuccess: ydrData.vertexCount > 0,
          errors, warnings,
          ydrData,
          hasCoordinates: false,
          entityCount: ydrData.meshes.length,
        };
      }

      case 'GLTF': {
        const info = parseGltfBasicInfo(filePath);
        return {
          path: filePath, filename, format, size,
          parseSuccess: true,
          errors, warnings: [...warnings, ...info.warnings],
          hasCoordinates: false, entityCount: 0,
        };
      }

      case 'GLB': {
        const info = parseGlbBasicInfo(filePath);
        return {
          path: filePath, filename, format, size,
          parseSuccess: true,
          errors, warnings: [...warnings, ...info.warnings],
          hasCoordinates: false, entityCount: 0,
        };
      }

      default:
        if (filePath.toLowerCase().endsWith('.ymf') || filePath.toLowerCase().endsWith('.ymf.xml')) {
          const ymfData = parseYmfXml(filePath, data);
          return {
            path: filePath, filename, format, size,
            parseSuccess: true,
            errors, warnings: [...warnings, ...ymfData.parseWarnings],
            ymfData,
            hasCoordinates: ymfData.interiors.some(i => !!i.position),
            entityCount: ymfData.interiors.length,
          };
        }
        return {
          path: filePath, filename, format, size,
          parseSuccess: true,
          errors, warnings,
          hasCoordinates: false, entityCount: 0,
        };
    }
  } catch (e) {
    return makeErrorResult(filePath, filename, [`Unexpected error: ${(e as Error).message}`]);
  }
}

function walkDirectory(dir: string, files: string[] = []): string[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDirectory(full, files);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  } catch (e) {
    // ignore unreadable dirs
  }
  return files;
}

function detectResourceStructure(rootPath: string, files: string[]): {
  hasFxManifest: boolean;
  streamFolder: boolean;
  dataFolder: boolean;
  mapsFolder: boolean;
} {
  const lowerFiles = files.map(f => f.toLowerCase());
  return {
    hasFxManifest: lowerFiles.some(f => path.basename(f) === 'fxmanifest.lua'),
    streamFolder: lowerFiles.some(f => f.includes(`${path.sep}stream${path.sep}`) || f.endsWith(`${path.sep}stream`)),
    dataFolder: lowerFiles.some(f => f.includes(`${path.sep}data${path.sep}`)),
    mapsFolder: lowerFiles.some(f => f.includes(`${path.sep}maps${path.sep}`)),
  };
}

function extractZipToTemp(zipPath: string): { tempDir: string; cleanup: () => void } | null {
  const stats = fs.statSync(zipPath);
  if (stats.size > MAX_ZIP_SIZE_BYTES) {
    throw new Error('ZIP file exceeds 2GB size limit');
  }

  const os = require('os');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fml_'));

  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const entryPath = entry.entryName.replace(/\\/g, '/');
      if (entryPath.includes('../') || entryPath.startsWith('/')) continue;

      const ext = path.extname(entryPath).toLowerCase();
      if (['.exe', '.bat', '.cmd', '.ps1', '.sh'].includes(ext)) continue;

      const outPath = path.join(tempDir, entryPath);
      const outDir = path.dirname(outPath);
      if (!outPath.startsWith(tempDir)) continue;

      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outPath, entry.getData());
    }
  } catch (e) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw e;
  }

  return {
    tempDir,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  };
}

export async function analyzeResource(
  inputPath: string,
  inputType: 'file' | 'folder' | 'zip',
  onProgress?: ProgressCallback,
  cancelToken?: CancelToken,
  options?: AnalyzeOptions
): Promise<Omit<ResourceAnalysis, 'id' | 'timestamp' | 'locationResult'>> {
  let rootPath = inputPath;
  let files: string[] = [];
  let cleanup: (() => void) | null = null;

  try {
    if (inputType === 'zip') {
      const result = extractZipToTemp(inputPath);
      if (!result) throw new Error('ZIP extraction failed');
      rootPath = result.tempDir;
      cleanup = result.cleanup;
      files = walkDirectory(rootPath);
    } else if (inputType === 'folder') {
      files = walkDirectory(inputPath);
    } else {
      files = [inputPath];
    }

    const name = path.basename(inputPath, path.extname(inputPath));
    const structure = detectResourceStructure(rootPath, files);
    const analysisResults: FileAnalysisResult[] = [];
    const missingDependencies: string[] = [];
    const structuralIssues: string[] = [];

    const modelsMap: Record<string, YdrModelData> = {};
    const texturesMap: Record<string, TextureDef> = {};
    const collisionsMap: Record<string, YbnCollisionData> = {};
    const mlos: MloInstance[] = [];

    for (let i = 0; i < files.length; i++) {
      if (cancelToken?.cancelled) break;

      const file = files[i];
      onProgress?.(i, files.length, path.basename(file));

      const result = analyzeFile(file, options?.skipGeometry ?? false);
      analysisResults.push(result);

      if (result.ydrData) {
        modelsMap[result.ydrData.name.toLowerCase()] = result.ydrData;
      }
      if (result.ytdData) {
        for (const tex of result.ytdData.textures) {
          texturesMap[tex.name.toLowerCase()] = tex;
        }
      }
      if (result.ybnData) {
        collisionsMap[result.ybnData.name.toLowerCase()] = result.ybnData;
      }
    }

    // Correlate MLO instances from YMAP with their archetype definitions from YTYP
    const ytypMlos = analysisResults.flatMap(r => r.ytypData?.mlos ?? []);
    const ymapMlos = analysisResults.flatMap(r => r.ymapData?.mlos ?? []);

    if (ymapMlos.length > 0) {
      for (const ym of ymapMlos) {
        const matchingArchetype = ytypMlos.find(
          yt => yt.name.toLowerCase() === ym.archetypeName.toLowerCase()
        );
        if (matchingArchetype) {
          mlos.push({
            ...ym,
            rooms: matchingArchetype.rooms,
            portals: matchingArchetype.portals,
            entities: [...ym.entities, ...matchingArchetype.entities],
          });
        } else {
          mlos.push(ym);
        }
      }
    } else {
      mlos.push(...ytypMlos);
    }

    // Resolve entities with loaded models
    for (const r of analysisResults) {
      if (r.ymapData) {
        for (const ent of r.ymapData.entities) {
          const modelKey = ent.archetypeName.toLowerCase();
          if (modelsMap[modelKey]) {
            ent.resolvedModel = modelsMap[modelKey];
            ent.polygonCount = modelsMap[modelKey].indexCount / 3;
          }
        }
      }
    }

    // Missing dependencies detection
    const ymapFiles = analysisResults.filter(r => r.ymapData);
    const ytypFiles = analysisResults.filter(r => r.ytypData);
    const knownArchetypes = new Set(ytypFiles.flatMap(r => r.ytypData?.archetypes.map(a => a.name) ?? []));

    for (const ymap of ymapFiles) {
      const entities = ymap.ymapData?.entities ?? [];
      for (const entity of entities) {
        if (entity.archetypeName && !knownArchetypes.has(entity.archetypeName)) {
          if (!missingDependencies.includes(entity.archetypeName)) {
            missingDependencies.push(entity.archetypeName);
          }
        }
      }
    }

    if (!structure.hasFxManifest && files.length > 1) {
      structuralIssues.push('No fxmanifest.lua found — resource may not register correctly in FiveM');
    }

    return {
      name,
      rootPath,
      files: analysisResults,
      totalEntities: analysisResults.reduce((s, r) => s + r.entityCount, 0),
      totalFiles: analysisResults.length,
      missingDependencies,
      structuralIssues,
      modelsMap,
      texturesMap,
      collisionsMap,
      mlos,
      status: cancelToken?.cancelled ? 'cancelled' : 'done',
      progress: 100,
      ...structure,
    };
  } finally {
    cleanup?.();
  }
}

function makeErrorResult(filePath: string, filename: string, errors: string[]): FileAnalysisResult {
  return {
    path: filePath, filename, format: 'UNKNOWN', size: 0,
    parseSuccess: false, errors, warnings: [],
    hasCoordinates: false, entityCount: 0,
  };
}
