'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Folder,
  FileArchive,
  FolderSearch,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Layers,
} from 'lucide-react';
import { clsx } from 'clsx';
import { getNativeAPI } from '@/lib/utils';

type InputType = 'file' | 'folder' | 'zip';

interface ImportState {
  status: 'idle' | 'analyzing' | 'done' | 'error';
  progress: number;
  currentFile: string;
  error: string | null;
}

const MODES: { id: InputType; label: string; hint: string; icon: typeof Folder }[] = [
  { id: 'folder', label: 'Pasta stream', hint: 'Lê todos os arquivos juntos', icon: Folder },
  { id: 'file',   label: 'Um arquivo',   hint: '.ymap, .ytyp ou .ymf',        icon: Layers },
  { id: 'zip',    label: 'Arquivo .zip', hint: 'Pacote compactado',           icon: FileArchive },
];

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [inputType, setInputType] = useState<InputType>('folder');
  const [selectedPath, setSelectedPath] = useState('');
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<ImportState>({
    status: 'idle',
    progress: 0,
    currentFile: '',
    error: null,
  });

  useEffect(() => {
    const native = getNativeAPI();
    if (!native) return;
    const unsubscribe = native.onProgress((data) => {
      setState((s) => ({
        ...s,
        progress: data.progress ?? s.progress,
        currentFile: data.currentFile ?? s.currentFile,
      }));
    });
    return unsubscribe;
  }, []);

  const handleNativeBrowse = async () => {
    const native = getNativeAPI();
    if (native) {
      if (inputType === 'folder') {
        const folder = await native.openFolder();
        if (folder) {
          setSelectedPath(folder);
          setState((s) => ({ ...s, error: null }));
        }
      } else {
        const file = await native.openFile();
        if (file) {
          setSelectedPath(file);
          if (file.toLowerCase().endsWith('.zip')) setInputType('zip');
          else setInputType('file');
          setState((s) => ({ ...s, error: null }));
        }
      }
      return;
    }

    if (inputType === 'folder') {
      folderInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const native = getNativeAPI();
      const realPath = native ? native.getPathForFile(files[0]) : (files[0] as any).path;

      if (realPath) {
        setSelectedPath(realPath);
        setState((s) => ({ ...s, error: null }));
        if (realPath.toLowerCase().endsWith('.zip')) setInputType('zip');
        else if (files.length > 1) setInputType('folder');
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const native = getNativeAPI();
    const realPath = native ? native.getPathForFile(files[0]) : (files[0] as any).path;
    if (realPath) {
      setSelectedPath(realPath);
      if (realPath.toLowerCase().endsWith('.zip')) setInputType('zip');
    }
  };

  const handleAnalyze = async () => {
    const targetPath = selectedPath.trim();
    if (!targetPath) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: 'Selecione ou cole o caminho de uma pasta stream ou arquivo válido no seu computador.',
      }));
      return;
    }

    setState({
      status: 'analyzing',
      progress: 8,
      currentFile: 'Lendo cabeçalhos RSC7 / XML do recurso…',
      error: null,
    });

    try {
      const native = getNativeAPI();
      if (native) {
        const result = await native.analyze({
          inputPath: targetPath,
          inputType,
        });
        setState({
          status: 'done',
          progress: 100,
          currentFile: 'Localização concluída!',
          error: null,
        });
        setTimeout(() => {
          router.push(`/locator/view?id=${encodeURIComponent(result.id)}`);
        }, 260);
        return;
      }

      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputPath: targetPath, inputType }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? 'Falha ao analisar recurso.');
      }
      const { jobId } = await r.json();
      router.push(`/locator/view?id=${encodeURIComponent(jobId)}`);
    } catch (e) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: (e as Error).message || 'Não foi possível analisar os arquivos selecionados.',
      }));
    }
  };

  const isBusy = state.status === 'analyzing';
  const canRun = Boolean(selectedPath.trim()) && !isBusy;
  const activeModeIndex = MODES.findIndex((m) => m.id === inputType);

  return (
    <div className="mx-auto max-w-[780px]">
      <header className="pb-6">
        <h1 className="page-title">Importar mapa</h1>
        <p className="page-lede">
          Escolha a pasta <span className="coord text-[#1D1D1F]">stream</span> do recurso FiveM no seu PC. O aplicativo lê os arquivos localmente e aponta a posição exata.
        </p>
      </header>

      {/* Controle Segmentado Deslizante estilo macOS */}
      <div role="radiogroup" aria-label="Tipo de entrada" className="apple-segment grid grid-cols-3">
        <span
          aria-hidden="true"
          className="apple-segment-thumb w-[calc((100%-6px)/3)]"
          style={{ transform: `translate3d(${activeModeIndex * 100}%, 0, 0)` }}
        />
        {MODES.map(({ id, label, hint, icon: Icon }) => {
          const on = inputType === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setInputType(id);
                setState((s) => ({ ...s, error: null }));
              }}
              className={clsx(
                'relative z-10 flex items-center justify-center gap-2.5 rounded-[7.5px] px-3 py-2.5 text-left transition-[color,transform] duration-150 [transition-timing-function:var(--ease-apple)] active:scale-[0.98]',
                on ? 'text-[#1D1D1F]' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              )}
            >
              <Icon className={clsx('h-4 w-4 shrink-0', on ? 'text-[#0071E3]' : 'text-[#8E8E93]')} strokeWidth={1.85} />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium leading-tight">{label}</span>
                <span className="hidden truncate text-[11px] text-[#8E8E93] sm:block">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept={inputType === 'zip' ? '.zip' : '.ymap,.ytyp,.ymf,.meta,.xml,.ydr,.ybn,.ytd'}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        {...({ webkitdirectory: '', directory: '' } as any)}
        multiple
      />

      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onClick={handleNativeBrowse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleNativeBrowse();
          }
        }}
        className={clsx(
          'sheet group mt-4 cursor-pointer border-2 border-dashed px-6 py-12 text-center transition-[background-color,border-color,transform,box-shadow] duration-200 [transition-timing-function:var(--ease-apple)] active:scale-[0.992]',
          dragging
            ? 'scale-[1.01] border-[#0071E3] bg-[#0071E3]/[0.05]'
            : 'border-black/[0.11] hover:border-[#0071E3]/50 hover:bg-[#FAFAFC]'
        )}
      >
        <div
          className={clsx(
            'mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0071E3]/10 text-[#0071E3] transition-transform duration-200 [transition-timing-function:var(--ease-apple)]',
            dragging ? '-translate-y-1 scale-110' : 'group-hover:-translate-y-0.5 group-hover:scale-105'
          )}
        >
          <FolderSearch className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <p className="mt-3.5 text-[15px] font-medium text-[#1D1D1F]">
          {selectedPath ? (
            <span className="coord break-all">{selectedPath}</span>
          ) : inputType === 'folder' ? (
            'Clique para selecionar a pasta no Explorer ou arraste aqui'
          ) : inputType === 'zip' ? (
            'Clique para selecionar um arquivo .zip ou arraste aqui'
          ) : (
            'Clique para selecionar o arquivo de mapa ou arraste aqui'
          )}
        </p>
        <p className="mt-1 text-[13px] text-[#6E6E73]">
          Leitura 100% nativa do disco — nenhum arquivo sai do seu computador
        </p>
      </div>

      <div className="sheet mt-4 p-4">
        <label htmlFor="manual-path" className="block text-[12.5px] font-medium text-[#6E6E73]">
          Caminho local no Windows
        </label>
        <div className="mt-1.5 flex flex-col gap-2.5 sm:flex-row">
          <input
            id="manual-path"
            type="text"
            value={selectedPath}
            onChange={(e) => setSelectedPath(e.target.value)}
            placeholder="Ex.: C:\server\resources\[mlo]\meu_mapa\stream"
            disabled={isBusy}
            className="field coord flex-1"
          />
          <button type="button" onClick={handleAnalyze} disabled={!canRun} className="btn-primary px-5">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isBusy ? 'Analisando…' : 'Analisar e localizar'}
          </button>
        </div>
      </div>

      {(isBusy || state.status === 'done') && (
        <div className="sheet animate-page-enter mt-5 px-5 py-4" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-[13.5px]">
            <span className="flex min-w-0 items-center gap-2 font-medium text-[#1D1D1F]">
              {state.status === 'done' ? (
                <CheckCircle className="animate-icon-pop h-4 w-4 shrink-0 text-[#34C759]" />
              ) : (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0071E3]" />
              )}
              <span className="truncate">{state.currentFile || 'Processando…'}</span>
            </span>
            <span className="coord text-[#6E6E73]">{state.progress}%</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
            <div
              className={clsx(
                'relative h-full overflow-hidden rounded-full bg-[#0071E3] transition-[width] duration-200 [transition-timing-function:var(--ease-apple)]',
                isBusy && 'progress-shimmer'
              )}
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      )}

      {state.status === 'error' && state.error && (
        <div
          className="animate-page-enter mt-5 flex items-start gap-3 rounded-[14px] border border-[#FAD1CF] bg-[#FFECEB] px-4 py-3.5 text-[13.5px] text-[#C92A2A]"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
    </div>
  );
}
