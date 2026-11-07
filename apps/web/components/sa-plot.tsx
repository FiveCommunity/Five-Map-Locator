'use client';

import dynamic from 'next/dynamic';
import type { GtaMapMarker, GtaMapStyle } from '@/components/gtamap/leaflet-map';

const GtaLeafletMap = dynamic(() => import('@/components/gtamap/leaflet-map'), {
  ssr: false,
  loading: () => (
    <div className="contours flex h-[440px] w-full items-center justify-center rounded-md border border-border text-[13px] text-muted-foreground">
      Carregando mapa de San Andreas…
    </div>
  ),
});

export interface PlotPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  z?: number;
  region?: string;
  active?: boolean;
}

export function SanAndreasPlot({
  points,
  defaultStyle = 'atlas',
  heightClass = 'h-[440px]',
}: {
  points: PlotPoint[];
  defaultStyle?: GtaMapStyle;
  heightClass?: string;
}) {
  const markers: GtaMapMarker[] = points.map((p) => ({
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    z: p.z,
    region: p.region,
    active: p.active,
  }));

  return <GtaLeafletMap markers={markers} defaultStyle={defaultStyle} heightClass={heightClass} />;
}
