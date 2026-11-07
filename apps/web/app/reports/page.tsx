'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { Download, Trash2, ChevronRight } from 'lucide-react';
import {
  apiFetch,
  confidenceBadgeClass,
  deleteAnalysisById,
  exportAnalysisJson,
  statusLabel,
} from '@/lib/utils';
import type { ResourceAnalysis } from '@five-map/shared';

export default function ReportsPage() {
  const { data, mutate } = useSWR('/api/analyses', (url: string) => apiFetch<ResourceAnalysis[]>(url), { refreshInterval: 4000 });

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Apagar a análise "${name}" do histórico? Os arquivos originais do seu mapa não são alterados.`)) return;
    await deleteAnalysisById(id);
    mutate();
  };

  return (
    <div className="mx-auto max-w-[960px]">
      <header className="pb-6">
        <h1 className="page-title">Histórico</h1>
        <p className="page-lede">Todas as análises salvas localmente neste computador. Exporte em JSON ou remova itens antigos.</p>
      </header>

      {!data || data.length === 0 ? (
        <div className="sheet px-7 py-11 text-[14px] text-[#6E6E73]">Nenhuma análise salva ainda.</div>
      ) : (
        <div className="sheet overflow-hidden">
          <table className="w-full text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#FAFAFC] text-[12px] font-medium text-[#6E6E73]">
                <th className="py-3 pl-5 font-medium">Mapa</th>
                <th className="hidden py-3 font-medium md:table-cell">Região</th>
                <th className="hidden py-3 font-medium sm:table-cell">Data</th>
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 pr-4"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {data.map((a, idx) => {
                const loc = a.locationResult;
                return (
                  <tr
                    key={a.id}
                    className="stagger-item transition-colors duration-150 hover:bg-[#F5F5F7]/75"
                    style={{ '--i': Math.min(idx, 10) } as React.CSSProperties}
                  >
                    <td className="max-w-[260px] truncate py-3.5 pl-5 font-medium text-[#1D1D1F]">{a.name}</td>
                    <td className="hidden py-3.5 text-[#6E6E73] md:table-cell">{loc?.primaryRegion?.name ?? '—'}</td>
                    <td className="coord hidden py-3.5 text-[12.5px] text-[#8E8E93] sm:table-cell">
                      {new Date(a.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3.5">
                      {loc && (
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${confidenceBadgeClass(loc.status)}`}>
                          {statusLabel(loc.status)}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => exportAnalysisJson(a.id, a.name)}
                          className="rounded-lg p-2 text-[#6E6E73] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.06] hover:text-[#1D1D1F] active:scale-95"
                          title="Exportar JSON"
                          aria-label={`Exportar ${a.name} em JSON`}
                        >
                          <Download className="h-4 w-4" strokeWidth={1.8} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id, a.name)}
                          className="rounded-lg p-2 text-[#6E6E73] transition-[background-color,color,transform] duration-150 hover:bg-[#FFECEB] hover:text-[#C92A2A] active:scale-95"
                          title="Apagar"
                          aria-label={`Apagar ${a.name}`}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                        </button>
                        <Link
                          href={`/locator/view?id=${encodeURIComponent(a.id)}`}
                          className="rounded-lg p-2 text-[#6E6E73] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.06] hover:text-[#1D1D1F] active:scale-95"
                          title="Abrir"
                          aria-label={`Abrir ${a.name}`}
                        >
                          <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
