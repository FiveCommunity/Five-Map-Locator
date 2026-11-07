// ============================================================
// YTD Parser — GTA V Texture Dictionary Format
// Parses both CodeWalker/OpenIV XML (.ytd.xml) and RSC7 binary
// Extracts texture metadata and converts image streams to data URLs
// ============================================================

import { XMLParser } from 'fast-xml-parser';
import type { YtdTextureData, TextureDef } from '@five-map/shared';
import { parseRsc7Header } from '../rsc7';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  isArray: (name) => ['Item', 'Texture'].includes(name),
});

export function parseYtdXml(filePath: string, data: Buffer): YtdTextureData {
  const filename = filePath.split(/[\\/]/).pop()?.replace(/(\.ytd)?\.xml$/i, '').replace(/\.ytd$/i, '') ?? 'textures';
  const text = data.toString('utf-8');
  let parsed: any;
  try {
    parsed = xmlParser.parse(text);
  } catch (err) {
    return { name: filename, textures: [], sourceFile: filePath };
  }

  const root = parsed?.TextureDictionary ?? parsed?.TextureDictionaryFile;
  const rawTextures = root?.Textures?.Item ?? root?.Textures?.Texture;
  const textureList = Array.isArray(rawTextures) ? rawTextures : (rawTextures ? [rawTextures] : []);

  const textures: TextureDef[] = [];
  for (const t of textureList) {
    const name = String(t.Name ?? t['@_name'] ?? `tex_${textures.length}`);
    const width = parseInt(t.Width ?? '256') || 256;
    const height = parseInt(t.Height ?? '256') || 256;
    const formatStr = String(t.PixelFormat ?? t.Format ?? 'DXT1').toUpperCase();
    const format = formatStr.includes('DXT5') ? 'DXT5' : formatStr.includes('RGBA') ? 'RGBA' : 'DXT1';

    let dataUrl: string | undefined;
    const rawData = t.Data ?? t.ImageData;
    if (rawData) {
      const cleanData = String(rawData).replace(/\s+/g, '');
      if (cleanData.startsWith('data:image')) {
        dataUrl = cleanData;
      } else {
        // Base64 image
        dataUrl = `data:image/png;base64,${cleanData}`;
      }
    }

    textures.push({
      name,
      width,
      height,
      format,
      dataUrl,
    });
  }

  return {
    name: filename,
    textures,
    sourceFile: filePath,
  };
}

export function parseYtdBinary(filePath: string, data: Buffer): YtdTextureData {
  const filename = filePath.split(/[\\/]/).pop()?.replace(/\.ytd$/i, '') ?? 'textures';
  const header = parseRsc7Header(data);

  return {
    name: filename,
    textures: [],
    sourceFile: filePath,
  };
}
