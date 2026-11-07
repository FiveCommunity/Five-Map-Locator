'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { FolderInput, ChevronRight, Copy, Check, Map as MapIcon } from 'lucide-react';
import { apiFetch, confidenceBadgeClass, statusLabel } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/animated-number';
import type { ResourceAnalysis } from '@five-map/shared';

type Stats = { total: number; confirmed: number; unidentified: number };

export default function DashboardPage() {
  const { data: stats } = useSWR('/api/stats', (url: string) => apiFetch<Stats>(url), { refreshInterval: 3000 });
  const { data: analyses } = useSWR('/api/analyses?limit=12', (url: string) => apiFetch<ResourceAnalysis[]>(url), { refreshInterval: 3000 });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyVector = (e: React.MouseEvent, id: string, vecText: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(vecText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1400);
  };

  return (
    <div className="mx-auto max-w-[960px]">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <h1 className="page-title">Seus mapas</h1>
          <p className="page-lede">
            Leitura direta de recursos FiveM (<span className="coord text-[#1D1D1F]">.ymap</span>, <span className="coord text-[#1D1D1F]">.ytyp</span> e <span className="coord text-[#1D1D1F]">.ymf</span>) no seu computador, com precisão nativa.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/gtamap" className="btn-quiet">
            <MapIcon className="h-4 w-4 text-[#0071E3]" strokeWidth={1.8} />
            Mapa San Andreas
          </Link>
          <Link href="/import" className="btn-primary">
            <FolderInput className="h-4 w-4" strokeWidth={1.8} />
            Importar mapa
          </Link>
        </div>
      </header>

      {/* Painel de resumo agrupado estilo Apple */}
      <section
        aria-label="Resumo local"
        className="sheet stagger-item mb-8 grid grid-cols-3 divide-x divide-black/[0.06] overflow-hidden"
        style={{ '--i': 0 } as React.CSSProperties}
      >
        <div className="px-6 py-4 transition-colors duration-150 hover:bg-[#FAFAFC]">
          <p className="text-[12.5px] font-medium text-[#6E6E73]">Recursos analisados</p>
          <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.03em] text-[#1D1D1F] tabular-nums">
            <AnimatedNumber value={stats?.total ?? 0} />
          </p>
        </div>
        <div className="px-6 py-4 transition-colors duration-150 hover:bg-[#FAFAFC]">
          <p className="text-[12.5px] font-medium text-[#6E6E73]">Posição confirmada</p>
          <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.03em] text-[#1D7A39] tabular-nums">
            <AnimatedNumber value={stats?.confirmed ?? 0} />
          </p>
        </div>
        <div className="px-6 py-4 transition-colors duration-150 hover:bg-[#FAFAFC]">
          <p className="text-[12.5px] font-medium text-[#6E6E73]">Sem coordenada explícita</p>
          <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.03em] text-[#1D1D1F] tabular-nums">
            <AnimatedNumber value={stats?.unidentified ?? 0} />
          </p>
        </div>
      </section>

      <section aria-labelledby="recentes" className="stagger-item" style={{ '--i': 1 } as React.CSSProperties}>
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 id="recentes" className="text-[15px] font-semibold tracking-[-0.015em] text-[#1D1D1F]">
            Analisados recentemente
          </h2>
          <Link href="/reports" className="text-[13px] font-medium text-[#0071E3] transition-opacity hover:opacity-80">
            Ver histórico completo
          </Link>
        </div>

        {!analyses ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-[14px] bg-white/70" />
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <div className="sheet stagger-item px-7 py-11" style={{ '--i': 2 } as React.CSSProperties}>
            <p className="text-[16px] font-semibold tracking-[-0.015em] text-[#1D1D1F]">Nenhum mapa importado ainda</p>
            <p className="mt-1.5 max-w-[54ch] text-[14px] leading-relaxed text-[#6E6E73]">
              Selecione a pasta <span className="coord text-[#1D1D1F]">stream</span> de qualquer MLO ou recurso FiveM.
              O aplicativo extrai a coordenada exata (<span className="coord text-[#1D1D1F]">vector3</span>) e marca o ponto direto no mapa de San Andreas.
            </p>
            <div className="mt-5">
              <Link href="/import" className="btn-primary">
                <FolderInput className="h-4 w-4" strokeWidth={1.8} />
                Escolher pasta stream
              </Link>
            </div>
          </div>
        ) : (
          <div className="sheet overflow-hidden">
            <ul className="divide-y divide-black/[0.06]">
              {analyses.map((a, idx) => {
                const loc = a.locationResult;
                const c = loc?.primaryCoordinates;
                const luaVec = c ? `vector3(${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)})` : null;

                return (
                  <li
                    key={a.id}
                    className="stagger-item"
                    style={{ '--i': Math.min(idx + 2, 10) } as React.CSSProperties}
                  >
                    <Link
                      href={`/locator/view?id=${encodeURIComponent(a.id)}`}
                      className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-3.5 transition-[background-color,transform] duration-150 [transition-timing-function:var(--ease-apple)] hover:bg-[#F5F5F7]/75 active:scale-[0.996]"
                    >
                      <div className="min-w-0 transition-transform duration-150 [transition-timing-function:var(--ease-apple)] group-hover:translate-x-0.5">
                        <p className="truncate text-[14.5px] font-medium text-[#1D1D1F]">
                          {a.name}
                          {loc?.primaryRegion && (
                            <span className="ml-2 text-[13px] font-normal text-[#6E6E73]">
                              · {loc.primaryRegion.name}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-[#8E8E93]">
                          {a.totalFiles} arquivos lidos · {a.totalEntities} entidades
                        </p>
                      </div>

                      <div className="hidden items-center gap-2 sm:flex">
                        <span className="coord text-[12.5px] text-[#1D1D1F]">
                          {c ? `${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}` : '—'}
                        </span>
                        {luaVec && (
                          <button
                            type="button"
                            onClick={(e) => handleCopyVector(e, a.id, luaVec)}
                            title="Copiar vector3"
                            className="rounded-lg p-1.5 text-[#6E6E73] transition-[background-color,color,transform] duration-150 [transition-timing-function:var(--ease-apple)] hover:bg-black/[0.06] hover:text-[#1D1D1F] active:scale-90"
                          >
                            {copiedId === a.id ? (
                              <Check key="check" className="animate-icon-pop h-3.5 w-3.5 text-[#1D7A39]" />
                            ) : (
                              <Copy key="copy" className="animate-icon-pop h-3.5 w-3.5" strokeWidth={1.8} />
                            )}
                          </button>
                        )}
                      </div>

                      <span className="flex items-center gap-2.5">
                        {loc && (
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${confidenceBadgeClass(loc.status)}`}>
                            {statusLabel(loc.status)}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-[#C7C7CC] transition-transform duration-150 [transition-timing-function:var(--ease-apple)] group-hover:translate-x-0.5 group-hover:text-[#6E6E73]" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
