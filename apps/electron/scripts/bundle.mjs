import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const electronDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(electronDir, '../..');

function resolveEsbuild() {
  const candidates = [
    path.join(rootDir, 'node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild'),
    path.join(rootDir, 'node_modules/.pnpm/esbuild@0.21.5/node_modules/esbuild'),
    'esbuild',
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {}
  }
  throw new Error('Could not resolve esbuild in workspace');
}

/**
 * Generates a crisp 64x64 32-bit BGRA Windows .ico file natively (zero external deps)
 * featuring the Five Map Locator cartographic crosshair (#15232B + #EDF0EA + #B8336A).
 */
function generateAppIcon(outPath) {
  const W = 256;
  const H = 256;
  const pixelBytes = W * H * 4;
  const maskRowBytes = Math.ceil(W / 32) * 4;
  const maskBytes = maskRowBytes * H;
  const dibSize = 40 + pixelBytes + maskBytes;
  const totalSize = 6 + 16 + dibSize;

  const buf = Buffer.alloc(totalSize, 0);

  // ICONDIR header
  buf.writeUInt16LE(0, 0); // reserved
  buf.writeUInt16LE(1, 2); // type = 1 (ICO)
  buf.writeUInt16LE(1, 4); // count = 1

  // ICONDIRENTRY (0 means 256px per Windows ICO spec)
  buf.writeUInt8(0, 6);
  buf.writeUInt8(0, 7);
  buf.writeUInt8(0, 8); // palette
  buf.writeUInt8(0, 9); // reserved
  buf.writeUInt16LE(1, 10); // planes
  buf.writeUInt16LE(32, 12); // bpp
  buf.writeUInt32LE(dibSize, 14);
  buf.writeUInt32LE(22, 18); // offset

  // BITMAPINFOHEADER (40 bytes at offset 22)
  buf.writeUInt32LE(40, 22);
  buf.writeInt32LE(W, 26);
  buf.writeInt32LE(H * 2, 30); // height * 2 for XOR + AND masks
  buf.writeUInt16LE(1, 34); // planes
  buf.writeUInt16LE(32, 36); // bpp
  buf.writeUInt32LE(0, 38); // BI_RGB
  buf.writeUInt32LE(pixelBytes + maskBytes, 42);

  const pxOffset = 62;
  const cx = 127.5;
  const cy = 127.5;

  const setPixel = (x, y, r, g, b, a = 255) => {
    const row = H - 1 - y;
    const idx = pxOffset + (row * W + x) * 4;
    buf[idx] = b;
    buf[idx + 1] = g;
    buf[idx + 2] = r;
    buf[idx + 3] = a;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const min = 8;
      const max = 247;
      const rad = 44;
      if (x < min || x > max || y < min || y > max) {
        setPixel(x, y, 0, 0, 0, 0);
        continue;
      }
      let dx = 0;
      let dy = 0;
      if (x < min + rad) dx = min + rad - x;
      else if (x > max - rad) dx = x - (max - rad);
      if (y < min + rad) dy = min + rad - y;
      else if (y > max - rad) dy = y - (max - rad);
      const cornerDist = Math.hypot(dx, dy);
      if (cornerDist > rad + 0.5) {
        setPixel(x, y, 0, 0, 0, 0);
        continue;
      }

      // Apple Maps Blue vertical gradient (#0A84FF -> #0062CC)
      const t = (y - min) / (max - min);
      let r = Math.round(10 * (1 - t) + 0 * t);
      let g = Math.round(132 * (1 - t) + 98 * t);
      let b = Math.round(255 * (1 - t) + 204 * t);

      const distCenter = Math.hypot(x - cx, y - cy);

      // Pure white radar center dot & reticle (#FFFFFF)
      if (
        distCenter <= 18 ||
        Math.abs(distCenter - 46) <= 5.5 ||
        (Math.abs(x - cx) <= 5 && ((y >= 38 && y <= 70) || (y >= 185 && y <= 217))) ||
        (Math.abs(y - cy) <= 5 && ((x >= 38 && x <= 70) || (x >= 185 && x <= 217)))
      ) {
        r = 255;
        g = 255;
        b = 255;
      }

      const alpha = cornerDist > rad - 0.5 ? Math.max(0, Math.min(255, Math.round((rad + 0.5 - cornerDist) * 255))) : 255;
      setPixel(x, y, r, g, b, alpha);
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
}

async function run() {
  const esbuild = resolveEsbuild();
  const distDir = path.join(electronDir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });

  // 1. Generate custom .ico icons
  generateAppIcon(path.join(electronDir, 'assets/icon.ico'));
  generateAppIcon(path.join(rootDir, 'assets/icon.ico'));
  console.log('[Bundle] Generated native Windows icon.ico');

  // 2. Bundle Electron Main Process (including workspace parser, locator, shared)
  await esbuild.build({
    entryPoints: [path.join(electronDir, 'src/main.ts')],
    outfile: path.join(distDir, 'main.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: ['electron'],
    sourcemap: false,
    minify: false,
    logLevel: 'info',
  });

  // 3. Bundle Preload Script
  await esbuild.build({
    entryPoints: [path.join(electronDir, 'src/preload.ts')],
    outfile: path.join(distDir, 'preload.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: ['electron'],
    sourcemap: false,
    minify: false,
    logLevel: 'info',
  });

  // 4. Sync static Next.js export (apps/web/out -> apps/electron/web)
  const webOut = path.join(rootDir, 'apps/web/out');
  const electronWeb = path.join(electronDir, 'web');
  if (fs.existsSync(webOut)) {
    fs.rmSync(electronWeb, { recursive: true, force: true });
    fs.cpSync(webOut, electronWeb, { recursive: true });
    console.log('[Bundle] Synced static web assets -> apps/electron/web');
  } else {
    console.warn('[Bundle] Warning: apps/web/out not found yet. Run web build first.');
  }
}

run().catch((err) => {
  console.error('[Bundle] Failed:', err);
  process.exit(1);
});
