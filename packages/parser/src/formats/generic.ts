// ============================================================
// Generic 3D Formats — OBJ, GLTF, GLB
// Extracts full geometry (positions, indices, normals, uvs) and materials
// for direct 3D rendering in Three.js
// ============================================================

import * as fs from 'fs';
import type { YdrModelData, GeometryMesh, MaterialDef, Vec3 } from '@five-map/shared';

export interface Generic3DInfo {
  format: string;
  vertexCount: number;
  faceCount: number;
  hasNormals: boolean;
  hasMaterials: boolean;
  warnings: string[];
}

/** Parses Wavefront OBJ into full YdrModelData for 3D rendering */
export function parseObjGeometry(filePath: string): YdrModelData {
  const filename = filePath.split(/[\\/]/).pop()?.replace(/\.obj$/i, '') ?? 'mesh';
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/[\r\n]+/);

  const rawPositions: number[][] = [];
  const rawNormals: number[][] = [];
  const rawUvs: number[][] = [];

  const finalPositions: number[] = [];
  const finalNormals: number[] = [];
  const finalUvs: number[] = [];
  const finalIndices: number[] = [];

  let bbMin: Vec3 = { x: Infinity, y: Infinity, z: Infinity };
  let bbMax: Vec3 = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];

    if (cmd === 'v') {
      const x = parseFloat(parts[1]) || 0;
      const y = parseFloat(parts[2]) || 0;
      const z = parseFloat(parts[3]) || 0;
      rawPositions.push([x, y, z]);

      if (x < bbMin.x) bbMin.x = x;
      if (y < bbMin.y) bbMin.y = y;
      if (z < bbMin.z) bbMin.z = z;
      if (x > bbMax.x) bbMax.x = x;
      if (y > bbMax.y) bbMax.y = y;
      if (z > bbMax.z) bbMax.z = z;
    } else if (cmd === 'vn') {
      rawNormals.push([parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0, parseFloat(parts[3]) || 0]);
    } else if (cmd === 'vt') {
      rawUvs.push([parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0]);
    } else if (cmd === 'f') {
      // Triangulate face (handles quads and n-gons)
      const faceVerts = parts.slice(1);
      if (faceVerts.length >= 3) {
        for (let i = 1; i < faceVerts.length - 1; i++) {
          const triangle = [faceVerts[0], faceVerts[i], faceVerts[i + 1]];
          for (const vertStr of triangle) {
            const vParts = vertStr.split('/');
            const posIdx = parseInt(vParts[0]) - 1;
            const uvIdx = vParts[1] ? parseInt(vParts[1]) - 1 : -1;
            const normIdx = vParts[2] ? parseInt(vParts[2]) - 1 : -1;

            if (posIdx >= 0 && posIdx < rawPositions.length) {
              const p = rawPositions[posIdx];
              finalPositions.push(p[0], p[1], p[2]);

              if (normIdx >= 0 && normIdx < rawNormals.length) {
                const n = rawNormals[normIdx];
                finalNormals.push(n[0], n[1], n[2]);
              } else {
                finalNormals.push(0, 1, 0);
              }

              if (uvIdx >= 0 && uvIdx < rawUvs.length) {
                const uv = rawUvs[uvIdx];
                finalUvs.push(uv[0], uv[1]);
              } else {
                finalUvs.push(0, 0);
              }

              finalIndices.push(finalIndices.length);
            }
          }
        }
      }
    }
  }

  if (bbMin.x === Infinity) {
    bbMin = { x: -1, y: -1, z: -1 };
    bbMax = { x: 1, y: 1, z: 1 };
  }

  const mesh: GeometryMesh = {
    name: filename,
    positions: finalPositions,
    indices: finalIndices,
    normals: finalNormals,
    uvs: finalUvs,
    materialIndex: 0,
    bbMin,
    bbMax,
  };

  const material: MaterialDef = {
    name: `${filename}_mat`,
    diffuseColor: [0.75, 0.75, 0.8],
    roughness: 0.6,
    metalness: 0.1,
  };

  return {
    name: filename,
    meshes: [mesh],
    materials: [material],
    bbMin,
    bbMax,
    sourceFile: filePath,
    vertexCount: finalPositions.length / 3,
    indexCount: finalIndices.length,
  };
}

export function parseObjBasicInfo(filePath: string): Generic3DInfo {
  let vertexCount = 0;
  let faceCount = 0;
  let hasNormals = false;
  let hasMaterials = false;
  const warnings: string[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('v ')) vertexCount++;
      else if (trimmed.startsWith('vn ')) hasNormals = true;
      else if (trimmed.startsWith('f ')) faceCount++;
      else if (trimmed.startsWith('mtllib ') || trimmed.startsWith('usemtl ')) hasMaterials = true;
    }
  } catch (e) {
    warnings.push(`OBJ read error: ${(e as Error).message}`);
  }

  return { format: 'OBJ', vertexCount, faceCount, hasNormals, hasMaterials, warnings };
}

export function parseGltfBasicInfo(filePath: string): Generic3DInfo {
  const warnings: string[] = [];
  let vertexCount = 0;
  let faceCount = 0;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    const accessors = json.accessors ?? [];
    vertexCount = accessors.length > 0 ? (accessors[0]?.count ?? 0) : 0;
  } catch (e) {
    warnings.push(`GLTF parse error: ${(e as Error).message}`);
  }

  return { format: 'GLTF', vertexCount, faceCount, hasNormals: true, hasMaterials: true, warnings };
}

export function parseGlbBasicInfo(filePath: string): Generic3DInfo {
  const warnings: string[] = [];
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 20) {
      return { format: 'GLB', vertexCount: 0, faceCount: 0, hasNormals: false, hasMaterials: false, warnings };
    }
    const jsonChunkLength = buf.readUInt32LE(12);
    const jsonText = buf.slice(20, 20 + jsonChunkLength).toString('utf8');
    const json = JSON.parse(jsonText);
    const accessors = json.accessors ?? [];
    const vertexCount = accessors.length > 0 ? (accessors[0]?.count ?? 0) : 0;
    return { format: 'GLB', vertexCount, faceCount: 0, hasNormals: true, hasMaterials: true, warnings };
  } catch (e) {
    warnings.push(`GLB parse error: ${(e as Error).message}`);
    return { format: 'GLB', vertexCount: 0, faceCount: 0, hasNormals: false, hasMaterials: false, warnings };
  }
}
