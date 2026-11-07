'use client';

import { useState, useEffect } from 'react';
import { FolderOpen, Trash2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getNativeAPI } from '@/lib/utils';

export default function SettingsPage() {
  const [info, setInfo] = useState<{ version: string; dataDir: string; platform: string }>({
    version: '1.0.0',
    dataDir: '~/.five-map-locator',
    platform: 'Windows x64',
  });
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const native = getNativeAPI();
    if (native) {
      native.getAppInfo().then(setInfo).catch(() => {});
    }
  }, []);

  const handleOpenDataDir = async () => {
    const native = getNativeAPI();
    if (native) {
      await native.openDataFolder();
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm('Apagar todo o histórico de análises salvo neste computador?')) return;
    const native = getNativeAPI();
    if (native) {
      await native.clearAnalyses();
    }
    setCleared(true);
    setTimeout(() => setCleared(false), 1800);
  };

  return (
    <div className="mx-auto max-w-[740px]">
      <header className="pb-6">
        <h1 className="page-title">Configurações</h1>
        <p className="page-lede">Informações do aplicativo nativo e armazenamento local.</p>
      </header>

      <section className="sheet overflow-hidden">
        <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4">
          <div className="flex items-center gap-3.5 text-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF8EE] text-[#1D7A39]">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.85} />
            </span>
            <div>
              <p className="font-semibold text-[#1D1D1F]">Motor nativo autossuficiente</p>
              <p className="text-[13px] text-[#6E6E73]">
                DLLs integradas · Assinatura digital SHA-256 · Execução 100% local via IPC
              </p>
            </div>
          </div>
          <span className="coord rounded-full bg-[#F5F5F7] px-2.5 py-1 text-[11.5px] font-medium text-[#6E6E73]">
            v{info.version}
          </span>
        </div>

        <div className="divide-y divide-black/[0.06] px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <p className="text-[14px] font-medium text-[#1D1D1F]">Pasta de dados locais</p>
              <p className="coord mt-0.5 text-[12px] text-[#6E6E73]">{info.dataDir}</p>
            </div>
            <button type="button" onClick={handleOpenDataDir} className="btn-quiet py-1.5">
              <FolderOpen className="h-4 w-4 text-[#0071E3]" strokeWidth={1.8} /> Abrir no Explorer
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <p className="text-[14px] font-medium text-[#1D1D1F]">Arquitetura & Sistema</p>
              <p className="coord mt-0.5 text-[12px] text-[#6E6E73]">{info.platform}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <p className="text-[14px] font-medium text-[#1D1D1F]">Limpar histórico de mapas</p>
              <p className="mt-0.5 text-[13px] text-[#6E6E73]">
                Remove apenas os registros salvos no painel (não apaga seus recursos FiveM).
              </p>
            </div>
            <button type="button" onClick={handleClearCache} className="btn-quiet py-1.5 text-[#C92A2A] hover:bg-[#FFECEB]">
              {cleared ? <CheckCircle2 className="animate-icon-pop h-4 w-4 text-[#1D7A39]" /> : <Trash2 className="h-4 w-4" strokeWidth={1.8} />}
              {cleared ? 'Histórico limpo' : 'Limpar histórico'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
