import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ResourceAnalysis } from '@five-map/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ElectronNativeAPI {
  isNative: boolean;
  openFile: () => Promise<string | null>;
  openFolder: () => Promise<string | null>;
  getPathForFile: (file: File) => string;
  getStats: () => Promise<{ total: number; confirmed: number; unidentified: number }>;
  listAnalyses: (limit?: number, offset?: number) => Promise<ResourceAnalysis[]>;
  getAnalysis: (id: string) => Promise<ResourceAnalysis | null>;
  deleteAnalysis: (id: string) => Promise<boolean>;
  clearAnalyses: () => Promise<boolean>;
  exportJson: (id: string) => Promise<{ saved: boolean; filePath?: string }>;
  analyze: (payload: { inputPath: string; inputType: 'file' | 'folder' | 'zip' }) => Promise<ResourceAnalysis>;
  onProgress: (cb: (data: { progress: number; currentFile: string; filesProcessed: number; totalFiles: number }) => void) => () => void;
  getAppInfo: () => Promise<{ version: string; dataDir: string; platform: string }>;
  openDataFolder: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
}

export function getNativeAPI(): ElectronNativeAPI | null {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.isNative) {
    return (window as any).electronAPI as ElectronNativeAPI;
  }
  return null;
}

/**
 * Unified data fetcher: routes directly through Electron IPC when running natively
 * (zero HTTP ports, zero external servers), with HTTP fallback for browser dev.
 */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const native = getNativeAPI();
  const normalizedPath = path.startsWith('/api/')
    ? path
    : path.startsWith('/')
    ? `/api${path}`
    : `/api/${path}`;

  if (native) {
    const [pathname, queryString] = normalizedPath.split('?');
    const params = new URLSearchParams(queryString || '');

    if (pathname === '/api/stats') {
      return (await native.getStats()) as unknown as T;
    }

    if (pathname === '/api/analyses') {
      const limit = parseInt(params.get('limit') ?? '50', 10);
      const offset = parseInt(params.get('offset') ?? '0', 10);
      return (await native.listAnalyses(limit, offset)) as unknown as T;
    }

    const detailMatch = pathname.match(/^\/api\/analyses\/([^/]+)$/);
    if (detailMatch) {
      const id = decodeURIComponent(detailMatch[1]);
      if (options?.method === 'DELETE') {
        return (await native.deleteAnalysis(id)) as unknown as T;
      }
      const item = await native.getAnalysis(id);
      if (!item) throw new Error('Análise não encontrada no armazenamento local.');
      return item as unknown as T;
    }
  }

  const r = await fetch(normalizedPath, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error ?? r.statusText);
  }
  return r.json() as Promise<T>;
}

export async function exportAnalysisJson(id: string, fallbackName = 'relatorio'): Promise<void> {
  const native = getNativeAPI();
  if (native) {
    await native.exportJson(id);
    return;
  }
  const data = await apiFetch<ResourceAnalysis>(`/api/analyses/${id}`);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fallbackName}-localizacao.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteAnalysisById(id: string): Promise<void> {
  const native = getNativeAPI();
  if (native) {
    await native.deleteAnalysis(id);
    return;
  }
  await fetch(`/api/analyses/${id}`, { method: 'DELETE' });
}

export function openExternalLink(url: string): void {
  const native = getNativeAPI();
  if (native) {
    native.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Format GTA V coordinates for display */
export function formatCoords(x: number, y: number, z: number): string {
  return `${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`;
}

export function confidenceBadgeClass(status: string): string {
  switch (status) {
    case 'CONFIRMED':            return 'bg-[#EAF8EE] text-[#1D7A39] border-[#CBEBD4]';
    case 'ESTIMATED_WITH_REFS':  return 'bg-[#FFF6E5] text-[#9A5B00] border-[#F7DFB2]';
    case 'MULTIPLE_CANDIDATES':  return 'bg-[#EBF4FF] text-[#005BB5] border-[#C7E0FF]';
    case 'UNIDENTIFIED':         return 'bg-[#FFECEB] text-[#C92A2A] border-[#FAD1CF]';
    default:                     return 'bg-[#F2F2F7] text-[#6E6E73] border-black/10';
  }
}

/** Human label (pt-BR) for a location status */
export function statusLabel(status: string): string {
  switch (status) {
    case 'CONFIRMED':            return 'Confirmado';
    case 'ESTIMATED_WITH_REFS':  return 'Estimado';
    case 'MULTIPLE_CANDIDATES':  return 'Várias posições';
    case 'UNIDENTIFIED':         return 'Não localizado';
    default:                     return status;
  }
}
