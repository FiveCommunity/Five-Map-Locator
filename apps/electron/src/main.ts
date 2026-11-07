// ============================================================
// Five Map Locator — 100% Native Electron Main Process
// Zero localhost servers, zero external processes, direct IPC engine
// ============================================================

import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { analyzeResource } from '@five-map/parser';
import { locateResource } from '@five-map/locator';
import type { ResourceAnalysis } from '@five-map/shared';
import {
  initNativeStore,
  getDataDir,
  getStats,
  listAnalyses,
  getAnalysis,
  saveAnalysis,
  deleteAnalysis,
  clearAllAnalyses,
} from './store';

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// Register custom privileged scheme before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

app.commandLine.appendSwitch('disable-features', 'Autofill,AutofillServerCommunication');
app.commandLine.appendSwitch('log-level', '3');

// Ensure single instance lock so multiple clicks focus existing window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let openedYoutubeOnBoot = false;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveWebRoot(): string {
  // When packaged via electron-builder extraResources: process.resourcesPath/web
  const packagedWeb = path.join(process.resourcesPath, 'web');
  if (app.isPackaged && fs.existsSync(packagedWeb)) {
    return packagedWeb;
  }
  // Local bundled directory: apps/electron/web or apps/web/out
  const localBundled = path.resolve(__dirname, '../web');
  if (fs.existsSync(localBundled)) {
    return localBundled;
  }
  return path.resolve(__dirname, '../../web/out');
}

function registerAppProtocol(): void {
  const webRoot = resolveWebRoot();

  protocol.handle('app', async (request) => {
    try {
      const reqUrl = new URL(request.url);
      let relPath = decodeURIComponent(reqUrl.pathname);
      if (relPath.startsWith('/')) relPath = relPath.slice(1);

      if (!relPath || relPath.endsWith('/')) {
        relPath = path.posix.join(relPath, 'index.html');
      }

      // Prevent path traversal outside webRoot
      const safeRel = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
      let targetPath = path.join(webRoot, safeRel);

      if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
        const asIndex = path.join(webRoot, safeRel, 'index.html');
        const asHtml = `${targetPath}.html`;
        if (fs.existsSync(asIndex) && fs.statSync(asIndex).isFile()) {
          targetPath = asIndex;
        } else if (fs.existsSync(asHtml) && fs.statSync(asHtml).isFile()) {
          targetPath = asHtml;
        } else {
          targetPath = path.join(webRoot, 'index.html');
        }
      }

      const ext = path.extname(targetPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const data = await fs.promises.readFile(targetPath);

      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        },
      });
    } catch (err) {
      return new Response(`Erro ao carregar arquivo interno: ${(err as Error).message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  });
}

function resolveWindowIcon(): string | undefined {
  const candidates = [
    path.join(process.resourcesPath, 'icon.ico'),
    path.resolve(__dirname, '../assets/icon.ico'),
    path.resolve(__dirname, '../../../assets/icon.ico'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 940,
    minHeight: 620,
    show: false,
    backgroundColor: '#F5F5F7',
    icon: resolveWindowIcon(),
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#F5F5F7',
      symbolColor: '#1D1D1F',
      height: 38,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    title: 'Five Map Locator',
  });

  // Open external http/https links in the user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  // Open official YouTube channel once on app startup
  if (!openedYoutubeOnBoot) {
    openedYoutubeOnBoot = true;
    shell.openExternal('https://www.youtube.com/@bkviniofc').catch(() => {});
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.loadURL('app://-/index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---- Native IPC Handlers ----

ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar arquivo de mapa (.ymap, .ytyp, .ymf, .zip)',
    filters: [
      {
        name: 'Arquivos GTA V / FiveM (*.ymap, *.ytyp, *.ymf, *.zip)',
        extensions: ['ymap', 'ytyp', 'ymf', 'zip', 'meta', 'xml', 'ydr', 'ybn', 'ytd'],
      },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar pasta stream ou recurso do FiveM',
    properties: ['openDirectory'],
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('app:getStats', async () => {
  return getStats();
});

ipcMain.handle('app:listAnalyses', async (_e, limit = 50, offset = 0) => {
  return listAnalyses(limit, offset);
});

ipcMain.handle('app:getAnalysis', async (_e, id: string) => {
  return getAnalysis(id);
});

ipcMain.handle('app:deleteAnalysis', async (_e, id: string) => {
  return deleteAnalysis(id);
});

ipcMain.handle('app:clearAnalyses', async () => {
  clearAllAnalyses();
  return true;
});

ipcMain.handle('app:exportJson', async (_e, id: string) => {
  const analysis = getAnalysis(id);
  if (!analysis || !mainWindow) return { saved: false };

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar relatório de localização (JSON)',
    defaultPath: `${analysis.name}-localizacao.json`,
    filters: [{ name: 'Arquivo JSON (*.json)', extensions: ['json'] }],
  });

  if (canceled || !filePath) return { saved: false };

  await fs.promises.writeFile(filePath, JSON.stringify(analysis, null, 2), 'utf-8');
  return { saved: true, filePath };
});

ipcMain.handle(
  'app:analyze',
  async (event, payload: { inputPath: string; inputType: 'file' | 'folder' | 'zip' }) => {
    const rawPath = payload?.inputPath?.trim();
    if (!rawPath) {
      throw new Error('Selecione uma pasta stream ou arquivo válido no computador.');
    }
    if (!fs.existsSync(rawPath)) {
      throw new Error(`O caminho selecionado não existe no disco: ${rawPath}`);
    }

    // Auto-detect real filesystem type so user never gets mismatched mode errors
    const stat = fs.statSync(rawPath);
    let effectiveType: 'file' | 'folder' | 'zip' = payload.inputType;
    if (stat.isDirectory()) {
      effectiveType = 'folder';
    } else if (rawPath.toLowerCase().endsWith('.zip')) {
      effectiveType = 'zip';
    } else {
      effectiveType = 'file';
    }

    const sendProgress = (progress: number, currentFile: string, filesProcessed: number, totalFiles: number) => {
      try {
        event.sender.send('analysis:progress', {
          progress,
          currentFile,
          filesProcessed,
          totalFiles,
        });
      } catch {}
    };

    sendProgress(8, 'Varrendo arquivos do recurso…', 0, 0);

    // Yield briefly so renderer paints progress bar immediately
    await new Promise((r) => setImmediate(r));

    let lastSent = 0;
    const partial = await analyzeResource(
      rawPath,
      effectiveType,
      (processed, total, currentFile) => {
        const now = Date.now();
        if (now - lastSent > 35 || processed === total) {
          lastSent = now;
          const pct = total > 0 ? Math.min(88, Math.max(10, Math.round((processed / total) * 88))) : 15;
          sendProgress(pct, currentFile, processed, total);
        }
      },
      undefined,
      { skipGeometry: true }
    );

    sendProgress(94, 'Calculando coordenadas e região em San Andreas…', partial.totalFiles, partial.totalFiles);
    await new Promise((r) => setImmediate(r));

    const locationResult = locateResource(partial);
    const id = `map_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;

    const fullResult: ResourceAnalysis = {
      ...partial,
      id,
      timestamp: Date.now(),
      locationResult,
      status: 'done',
      progress: 100,
    };

    const saved = saveAnalysis(fullResult);
    sendProgress(100, 'Localização concluída!', partial.totalFiles, partial.totalFiles);

    return saved;
  }
);

ipcMain.handle('app:getInfo', async () => {
  return {
    version: app.getVersion(),
    dataDir: getDataDir(),
    platform: `${process.platform} (${process.arch})`,
  };
});

ipcMain.handle('app:openDataFolder', async () => {
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
});

ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
  }
});

// ---- App Lifecycle ----

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  initNativeStore();
  registerAppProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
