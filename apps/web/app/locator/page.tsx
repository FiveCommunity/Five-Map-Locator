'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { ChevronRight, FolderInput } from 'lucide-react';
import { apiFetch, confidenceBadgeClass, statusLabel } from '@/lib/utils';
import type { ResourceAnalysis } from '@five-map/shared';

export default function LocatorIndexPage() {
  const { data: analyses } = useSWR('/api/analyses', (url: string) => apiFetch<ResourceAnalysis[]>(url), { refreshInterval: 3000 });

  return (
    <div className="mx-auto max-w-[960px]">
      <header className="pb-6">
        <h1 className="page-title">Localizador</h1>
        <p className="page-lede">Escolha um mapa importado para ver sua posição exata em San Andreas e copiar o vector3.</p>
      </header>

      {!analyses ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[14px] bg-white/70" />
          ))}
        </div>
      ) : analyses.length === 0 ? (
        <div className="sheet px-7 py-11">
          <p className="text-[16px] font-semibold text-[#1D1D1F]">Nenhum mapa importado ainda</p>
          <p className="mt-1.5 text-[14px] text-[#6E6E73]">Importe a pasta stream de um recurso para descobrir onde ele fica.</p>
          <Link href="/import" className="btn-primary mt-5">
            <FolderInput className="h-4 w-4" strokeWidth={1.8} /> Importar mapa
          </Link>
        </div>
      ) : (
        <div className="sheet overflow-hidden">
          <ul className="divide-y divide-black/[0.06]">
            {analyses.map((a, idx) => {
              const loc = a.locationResult;
              const c = loc?.primaryCoordinates;
              return (
                <li
                  key={a.id}
                  className="stagger-item"
                  style={{ '--i': Math.min(idx, 10) } as React.CSSProperties}
                >
                  <Link
                    href={`/locator/view?id=${encodeURIComponent(a.id)}`}
                    className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-3.5 transition-[background-color,transform] duration-150 [transition-timing-function:var(--ease-apple)] hover:bg-[#F5F5F7]/75 active:scale-[0.996]"
                  >
                    <div className="min-w-0 transition-transform duration-150 [transition-timing-function:var(--ease-apple)] group-hover:translate-x-0.5">
                      <p className="truncate text-[14.5px] font-medium text-[#1D1D1F]">{a.name}</p>
                      <p className="mt-0.5 text-[12.5px] text-[#8E8E93]">
                        {loc?.primaryRegion?.name ?? 'Região não identificada'} · {new Date(a.timestamp).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className="coord hidden text-[12.5px] text-[#1D1D1F] sm:block">
                      {c ? `${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}` : '—'}
                    </span>
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
    </div>
  );
}
