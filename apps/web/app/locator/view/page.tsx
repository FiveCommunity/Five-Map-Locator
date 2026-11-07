'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { Copy, Check, ChevronDown, ArrowLeft, Download, Maximize2 } from 'lucide-react';
import { apiFetch, confidenceBadgeClass, exportAnalysisJson, statusLabel } from '@/lib/utils';
import type { ResourceAnalysis } from '@five-map/shared';
import { SanAndreasPlot } from '@/components/sa-plot';

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };
  return { copied, copy };
}

const EVIDENCE_LABEL: Record<string, string> = {
  YMAP_EXTENTS: 'Limites do .ymap',
  ENTITY_POSITIONS: 'Posição das entidades',
  YMF_MANIFEST: 'Manifesto .ymf',
  YTYP_BOUNDS: 'Limites de arquétipo',
  FILENAME: 'Setor pelo arquivo',
  ARCHETYPE_MATCH: 'Arquétipo vanilla',
};

function LocatorViewContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';

  const { data, error } = useSWR(
    id ? `/api/analyses/${id}` : null,
    (url: string) => apiFetch<ResourceAnalysis>(url)
  );
  const [showFiles, setShowFiles] = useState(false);
  const { copied, copy } = useCopy();

  if (!id) {
    return (
      <div className="sheet mx-auto max-w-[720px] px-6 py-6 text-sm text-[#6E6E73]">
        Nenhum mapa selecionado. <Link href="/locator" className="font-medium text-[#0071E3] hover:underline">Voltar para a lista</Link>.
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[720px] rounded-[14px] border border-[#FAD1CF] bg-[#FFECEB] px-5 py-4 text-sm text-[#C92A2A]" role="alert">
        Essa análise não existe mais no banco local. Ela pode ter sido apagada no histórico.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-[1160px] space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-xl bg-white/80" />
        <div className="h-52 animate-pulse rounded-[14px] bg-white/80" />
      </div>
    );
  }

  const loc = data.locationResult;
  const c = loc?.primaryCoordinates;
  const lua = c ? `vector3(${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)})` : '';
  const tpCmd = c ? `/tp ${c.x.toFixed(2)} ${c.y.toFixed(2)} ${c.z.toFixed(2)}` : '';
  const raw = c ? `${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}` : '';
  const confidence = Math.round((loc?.confidence ?? 0) * 100);

  return (
    <div className="mx-auto max-w-[1160px]">
      <Link href="/locator" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0071E3] transition-opacity hover:opacity-80">
        <ArrowLeft className="h-3.5 w-3.5" /> Todos os mapas
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-2">
        <div className="min-w-0">
          <h1 className="page-title truncate">{data.name}</h1>
          <p className="page-lede">
            {loc?.primaryRegion?.name ?? 'Região não identificada'} — {data.totalFiles} arquivos, {data.totalEntities} entidades · {new Date(data.timestamp).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {c && (
            <Link
              href={`/gtamap?focus=${encodeURIComponent(id)}&x=${c.x.toFixed(2)}&y=${c.y.toFixed(2)}&z=${c.z.toFixed(2)}&label=${encodeURIComponent(data.name)}`}
              className="btn-quiet"
            >
              <Maximize2 className="h-4 w-4 text-[#0071E3]" strokeWidth={1.8} /> Abrir em tela cheia
            </Link>
          )}
          <button type="button" onClick={() => exportAnalysisJson(id, data.name)} className="btn-quiet">
            <Download className="h-4 w-4" strokeWidth={1.8} /> Exportar JSON
          </button>
        </div>
      </header>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_450px]">
        <div className="space-y-6">
          {/* Coordenada exata */}
          <section className="sheet overflow-hidden" aria-labelledby="coord-title">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-3.5">
              <h2 id="coord-title" className="text-[14.5px] font-semibold text-[#1D1D1F]">Posição no mundo</h2>
              {loc && (
                <span className="flex items-center gap-2.5 text-[12.5px] text-[#6E6E73]">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${confidenceBadgeClass(loc.status)}`}>
                    {statusLabel(loc.status)}
                  </span>
                  {confidence}% de confiança
                </span>
              )}
            </div>

            {c ? (
              <>
                <dl className="grid grid-cols-3 divide-x divide-black/[0.06]">
                  {([
                    ['X', c.x, 'leste / oeste'],
                    ['Y', c.y, 'norte / sul'],
                    ['Z', c.z, 'altura'],
                  ] as const).map(([k, v, hint]) => (
                    <div key={k} className="px-6 py-5">
                      <dt className="text-[12.5px] text-[#6E6E73]">
                        <span className="font-semibold text-[#1D1D1F]">{k}</span> · {hint}
                      </dt>
                      <dd className="coord mt-1.5 text-[27px] font-semibold leading-none tracking-[-0.025em] text-[#1D1D1F]">
                        {v.toFixed(2)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap items-center gap-2 border-t border-black/[0.06] bg-[#FAFAFC] px-6 py-3.5">
                  <button type="button" onClick={() => copy('lua', lua)} className="btn-primary py-1.5">
                    {copied === 'lua' ? <Check key="c1" className="animate-icon-pop h-4 w-4" /> : <Copy key="p1" className="animate-icon-pop h-4 w-4" strokeWidth={1.8} />}
                    {copied === 'lua' ? 'Copiado' : 'Copiar vector3'}
                  </button>
                  <button type="button" onClick={() => copy('tp', tpCmd)} className="btn-quiet py-1.5">
                    {copied === 'tp' ? <Check key="c2" className="animate-icon-pop h-4 w-4 text-[#1D7A39]" /> : <Copy key="p2" className="animate-icon-pop h-4 w-4" strokeWidth={1.8} />}
                    {copied === 'tp' ? 'Copiado' : 'Copiar /tp'}
                  </button>
                  <button type="button" onClick={() => copy('raw', raw)} className="btn-quiet py-1.5">
                    {copied === 'raw' ? <Check key="c3" className="animate-icon-pop h-4 w-4 text-[#1D7A39]" /> : <Copy key="p3" className="animate-icon-pop h-4 w-4" strokeWidth={1.8} />}
                    {copied === 'raw' ? 'Copiado' : 'x, y, z'}
                  </button>
                </div>
              </>
            ) : (
              <p className="px-6 py-6 text-[14px] text-[#6E6E73]">
                Nenhum arquivo trouxe coordenada explícita. Inclua os arquivos <span className="coord text-[#1D1D1F]">.ymap</span> ou o manifesto <span className="coord text-[#1D1D1F]">.ymf</span> do recurso e importe novamente.
              </p>
            )}
          </section>

          {/* Evidências */}
          <section className="sheet overflow-hidden" aria-labelledby="ev-title">
            <div className="border-b border-black/[0.06] px-6 py-3.5">
              <h2 id="ev-title" className="text-[14.5px] font-semibold text-[#1D1D1F]">
                Como chegamos nessa posição
              </h2>
            </div>
            {!loc?.evidence?.length ? (
              <p className="px-6 py-4 text-sm text-[#6E6E73]">Nenhuma evidência registrada.</p>
            ) : (
              <ul className="divide-y divide-black/[0.06] px-6">
                {loc.evidence.map((ev, i) => (
                  <li key={i} className="grid grid-cols-[150px_minmax(0,1fr)_auto] items-baseline gap-4 py-3 text-[13.5px]">
                    <span className="font-medium text-[#1D1D1F]">{EVIDENCE_LABEL[ev.type] ?? ev.type}</span>
                    <span className="text-[#6E6E73]">{ev.description}</span>
                    <span className="coord text-[12.5px] font-medium text-[#0071E3]">+{Math.round((ev.weight || 0) * 100)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Arquivos lidos com acordeão fluido em CSS Grid */}
          <section className="sheet overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFiles((v) => !v)}
              aria-expanded={showFiles}
              className="group flex w-full items-center justify-between px-6 py-3.5 text-left text-[14.5px] font-semibold text-[#1D1D1F] transition-colors hover:bg-[#FAFAFC]"
            >
              <span>Arquivos lidos ({data.files.length})</span>
              <ChevronDown className={`h-4 w-4 text-[#8E8E93] transition-transform duration-200 [transition-timing-function:var(--ease-apple)] ${showFiles ? 'rotate-180 text-[#1D1D1F]' : 'group-hover:text-[#1D1D1F]'}`} />
            </button>
            <div className="accordion-shell" data-open={showFiles}>
              <div className="accordion-inner">
                <ul className="max-h-80 divide-y divide-black/[0.06] overflow-y-auto border-t border-black/[0.06] px-6">
                  {data.files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
                      <span className="coord min-w-0 truncate text-[#1D1D1F]">{f.filename}</span>
                      <span className="flex shrink-0 items-center gap-4 text-[#6E6E73]">
                        {f.hasCoordinates && <span className="font-medium text-[#1D7A39]">tem posição</span>}
                        <span className="coord">{(f.size / 1024).toFixed(1)} KB</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        {/* Mapa interativo estilo Apple Maps + motor RiceaRaul */}
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <SanAndreasPlot
            points={
              c
                ? [{ id, name: data.name, x: c.x, y: c.y, z: c.z, region: loc?.primaryRegion?.name, active: true }]
                : []
            }
            defaultStyle="satellite"
            heightClass="h-[490px]"
          />
        </aside>
      </div>
    </div>
  );
}

export default function LocatorViewPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#6E6E73]">Carregando localização…</div>}>
      <LocatorViewContent />
    </Suspense>
  );
}
