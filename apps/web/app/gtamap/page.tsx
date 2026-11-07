'use client';

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Copy, Search, Check } from 'lucide-react';
import { apiFetch } from '@/lib/utils';
import type { ResourceAnalysis } from '@five-map/shared';
import type { GtaMapMarker } from '@/components/gtamap/leaflet-map';

const GtaLeafletMap = dynamic(() => import('@/components/gtamap/leaflet-map'), {
  ssr: false,
  loading: () => (
    <div className="contours flex flex-1 items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
      Carregando mapa de San Andreas…
    </div>
  ),
});

function GtaMapContent() {
  const params = useSearchParams();
  const focusId = params.get('focus') ?? '';
  const xParam = params.get('x');
  const yParam = params.get('y');
  const zParam = params.get('z');
  const label = params.get('label') ?? '';

  const { data: analyses } = useSWR('/api/analyses', (url: string) => apiFetch<ResourceAnalysis[]>(url));

  const initX = xParam !== null ? parseFloat(xParam) : NaN;
  const initY = yParam !== null ? parseFloat(yParam) : NaN;
  const initZ = zParam !== null ? parseFloat(zParam) : 30;

  const [searchX, setSearchX] = useState(xParam ?? '');
  const [searchY, setSearchY] = useState(yParam ?? '');
  const [pinX, setPinX] = useState<number | null>(isNaN(initX) ? null : initX);
  const [pinY, setPinY] = useState<number | null>(isNaN(initY) ? null : initY);
  const [pinLabel, setPinLabel] = useState(label);
  const [copied, setCopied] = useState(false);

  const markers: GtaMapMarker[] = (analyses ?? [])
    .filter((a) => a.locationResult?.primaryCoordinates)
    .map((a) => ({
      id: a.id,
      name: a.name,
      x: a.locationResult!.primaryCoordinates!.x,
      y: a.locationResult!.primaryCoordinates!.y,
      z: a.locationResult!.primaryCoordinates!.z,
      region: a.locationResult?.primaryRegion?.name,
      active: a.id === focusId,
    }));

  const handleSearch = () => {
    const nx = parseFloat(searchX);
    const ny = parseFloat(searchY);
    if (!isNaN(nx) && !isNaN(ny)) {
      setPinX(nx);
      setPinY(ny);
      setPinLabel(`${nx.toFixed(1)}, ${ny.toFixed(1)}`);
    }
  };

  const handleCopy = () => {
    if (pinX !== null && pinY !== null) {
      navigator.clipboard.writeText(`vector3(${pinX.toFixed(2)}, ${pinY.toFixed(2)}, ${initZ.toFixed(2)})`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Mapa de San Andreas</h1>
          <p className="page-lede">Alternar entre Atlas, Satélite e Grade · Clique em qualquer ponto para ler o vector3</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={searchX}
            onChange={(e) => setSearchX(e.target.value)}
            placeholder="X"
            className="field coord w-28"
          />
          <input
            value={searchY}
            onChange={(e) => setSearchY(e.target.value)}
            placeholder="Y"
            className="field coord w-28"
          />
          <button onClick={handleSearch} className="btn-primary">
            <Search className="h-4 w-4" strokeWidth={1.75} /> Ir
          </button>
          {pinX !== null && (
            <button onClick={handleCopy} className="btn-quiet">
              {copied ? <Check key="c" className="animate-icon-pop h-4 w-4 text-[#1D7A39]" /> : <Copy key="p" className="animate-icon-pop h-4 w-4" strokeWidth={1.8} />}
              {copied ? 'Copiado' : 'Copiar vector3'}
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <GtaLeafletMap
          markers={markers}
          pinX={pinX}
          pinY={pinY}
          pinLabel={pinLabel}
          defaultStyle="satellite"
          heightClass="h-full min-h-[520px]"
          onMapClick={(gx, gy) => {
            setPinX(gx);
            setPinY(gy);
            setSearchX(gx.toFixed(2));
            setSearchY(gy.toFixed(2));
            setPinLabel('Ponto marcado');
          }}
        />
      </div>
    </div>
  );
}

export default function GtaMapPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando mapa…</div>}>
      <GtaMapContent />
    </Suspense>
  );
}
