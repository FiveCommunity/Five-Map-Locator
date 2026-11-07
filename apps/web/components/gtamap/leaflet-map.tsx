'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRouter } from 'next/navigation';

/**
 * Motor cartográfico baseado em RiceaRaul/gta-v-map-leaflet
 * Calibração exata de coordenadas GTA V -> Leaflet CRS.Simple
 */
export const GTA_CRS_CONFIG = {
  centerX: 117.3,
  centerY: 172.8,
  scaleX: 0.02072,
  scaleY: 0.0205,
  ln2: Math.LN2,
} as const;

export type GtaMapStyle = 'atlas' | 'satellite' | 'grid';

const TILE_BASE_URL = 'https://raw.githubusercontent.com/Trusted-Studios/mapStyles/main';

const STYLE_META: Record<GtaMapStyle, { label: string; folder: string; ext: string; water: string }> = {
  atlas:     { label: 'Atlas',    folder: 'styleAtlas',    ext: 'jpg', water: '#0fa8d2' },
  satellite: { label: 'Satélite', folder: 'styleSatelite', ext: 'jpg', water: '#143d6b' },
  grid:      { label: 'Grade',    folder: 'styleGrid',     ext: 'png', water: '#384950' },
};

const WATER_FALLBACK_SVG = (color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${color}"/></svg>`)}`;

export function createGtaCRS(): L.CRS {
  const { centerX, centerY, scaleX, scaleY, ln2 } = GTA_CRS_CONFIG;
  return Object.assign({}, L.CRS.Simple, {
    projection: L.Projection.LonLat,
    scale(zoom: number): number {
      return Math.pow(2, zoom);
    },
    zoom(sc: number): number {
      return Math.log(sc) / ln2;
    },
    distance(pos1: L.LatLng, pos2: L.LatLng): number {
      return Math.hypot(pos2.lng - pos1.lng, pos2.lat - pos1.lat);
    },
    transformation: new L.Transformation(scaleX, centerX, -scaleY, centerY),
    infinite: true,
  });
}

export interface GtaMapMarker {
  id: string;
  name: string;
  x: number;
  y: number;
  z?: number;
  region?: string;
  active?: boolean;
}

interface GtaLeafletMapProps {
  markers?: GtaMapMarker[];
  pinX?: number | null;
  pinY?: number | null;
  pinLabel?: string;
  defaultStyle?: GtaMapStyle;
  initialZoom?: number;
  heightClass?: string;
  interactiveClick?: boolean;
  onMapClick?: (x: number, y: number) => void;
}

export default function GtaLeafletMap({
  markers = [],
  pinX = null,
  pinY = null,
  pinLabel,
  defaultStyle = 'atlas',
  initialZoom = 3,
  heightClass = 'h-[460px]',
  interactiveClick = true,
  onMapClick,
}: GtaLeafletMapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const [style, setStyle] = useState<GtaMapStyle>(defaultStyle);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);

  // Initialize Leaflet Map with RiceaRaul GTA CRS
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const crs = createGtaCRS();
    const meta = STYLE_META[style];

    const layer = L.tileLayer(`${TILE_BASE_URL}/${meta.folder}/{z}/{x}/{y}.${meta.ext}`, {
      minZoom: 0,
      maxZoom: 5,
      noWrap: true,
      errorTileUrl: WATER_FALLBACK_SVG(meta.water),
    });

    layer.on('tileerror', (e: L.TileErrorEvent) => {
      const img = e.tile as HTMLImageElement;
      img.src = WATER_FALLBACK_SVG(STYLE_META[style].water);
    });

    const map = L.map(containerRef.current, {
      crs,
      minZoom: 1,
      maxZoom: 5,
      zoom: initialZoom,
      center: [0, 0],
      preferCanvas: true,
      attributionControl: false,
      zoomControl: false,
      layers: [layer],
      maxBounds: L.latLngBounds(L.latLng(-4200, -5800), L.latLng(8200, 6200)),
      maxBoundsViscosity: 0.9,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    containerRef.current.style.background = meta.water;
    const group = L.layerGroup().addTo(map);

    mapRef.current = map;
    tileLayerRef.current = layer;
    markersGroupRef.current = group;

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorCoords({ x: e.latlng.lng, y: e.latlng.lat });
    });

    map.on('mouseout', () => {
      setCursorCoords(null);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const gx = e.latlng.lng;
      const gy = e.latlng.lat;
      onMapClick?.(gx, gy);

      if (interactiveClick) {
        const vec = `vector3(${gx.toFixed(2)}, ${gy.toFixed(2)}, 30.00)`;
        L.popup({ closeButton: true, className: 'gta-clean-popup' })
          .setLatLng(e.latlng)
          .setContent(`
            <div style="font-family: var(--font-sans), sans-serif; color: #15232B; min-width: 170px;">
              <div style="font-size: 11px; color: #52626A; margin-bottom: 2px;">Coordenada clicada</div>
              <div style="font-family: var(--font-mono), monospace; font-size: 13px; font-weight: 600;">
                ${gx.toFixed(2)}, ${gy.toFixed(2)}
              </div>
              <div style="font-family: var(--font-mono), monospace; font-size: 11px; color: #52626A; margin-top: 3px;">
                ${vec}
              </div>
            </div>
          `)
          .openOn(map);
      }
    });

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch map style (Atlas / Satellite / Grid)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !containerRef.current) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const meta = STYLE_META[style];
    containerRef.current.style.background = meta.water;

    const nextLayer = L.tileLayer(`${TILE_BASE_URL}/${meta.folder}/{z}/{x}/{y}.${meta.ext}`, {
      minZoom: 0,
      maxZoom: 5,
      noWrap: true,
      errorTileUrl: WATER_FALLBACK_SVG(meta.water),
    });

    nextLayer.on('tileerror', (e: L.TileErrorEvent) => {
      const img = e.tile as HTMLImageElement;
      img.src = WATER_FALLBACK_SVG(meta.water);
    });

    nextLayer.addTo(map);
    tileLayerRef.current = nextLayer;
  }, [style]);

  // Sync markers & single pin
  useEffect(() => {
    const map = mapRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const allPoints: GtaMapMarker[] = [...markers];
    if (pinX !== null && pinY !== null && !allPoints.some((m) => Math.abs(m.x - pinX) < 0.01 && Math.abs(m.y - pinY) < 0.01)) {
      allPoints.push({
        id: '__pin__',
        name: pinLabel || 'Posição selecionada',
        x: pinX,
        y: pinY,
        active: true,
      });
    }

    allPoints.forEach((m) => {
      const isFocused = m.active || allPoints.length === 1;
      const size = isFocused ? 22 : 16;
      const icon = L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2 - 4],
        html: `
          <div class="gta-pin-enter" style="
            position: relative;
            width: ${size}px;
            height: ${size}px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${isFocused ? `<span class="gta-pin-sonar" style="
              position: absolute;
              inset: -5px;
              border-radius: 9999px;
              background: rgba(0, 122, 255, 0.34);
              border: 1.5px solid rgba(0, 122, 255, 0.65);
            "></span>` : ''}
            <span style="
              position: relative;
              width: ${isFocused ? 15 : 12}px;
              height: ${isFocused ? 15 : 12}px;
              border-radius: 9999px;
              background: #007AFF;
              border: 2.5px solid #FFFFFF;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
            "></span>
          </div>
        `,
      });

      // Note: RiceaRaul GTA CRS expects [Y, X] in L.marker!
      const leafletMarker = L.marker([m.y, m.x], { icon }).addTo(group);

      const coordText = m.z !== undefined
        ? `${m.x.toFixed(2)}, ${m.y.toFixed(2)}, ${m.z.toFixed(2)}`
        : `${m.x.toFixed(2)}, ${m.y.toFixed(2)}`;

      leafletMarker.bindPopup(`
        <div style="font-family: var(--font-sans), sans-serif; color: #15232B; min-width: 185px;">
          <div style="font-weight: 600; font-size: 13px;">${m.name}</div>
          ${m.region ? `<div style="font-size: 11px; color: #52626A; margin-top: 1px;">${m.region}</div>` : ''}
          <div style="font-family: var(--font-mono), monospace; font-size: 12px; margin-top: 5px; background: #EDF0EA; padding: 3px 6px; border-radius: 4px;">
            ${coordText}
          </div>
        </div>
      `);

      if (m.id !== '__pin__' && markers.length > 1) {
        leafletMarker.on('dblclick', () => {
          router.push(`/locator/view?id=${encodeURIComponent(m.id)}`);
        });
      }

      if (isFocused && allPoints.length === 1) {
        map.flyTo([m.y, m.x], 4, { duration: 0.65, easeLinearity: 0.25 });
        leafletMarker.openPopup();
      }
    });

    if (allPoints.length > 1) {
      const focused = allPoints.find((p) => p.active);
      if (focused) {
        map.flyTo([focused.y, focused.x], 4, { duration: 0.65, easeLinearity: 0.25 });
      } else {
        const bounds = L.latLngBounds(allPoints.map((p) => L.latLng(p.y, p.x)));
        map.fitBounds(bounds.pad(0.28), { maxZoom: 4, animate: true });
      }
    }
  }, [markers, pinX, pinY, pinLabel, router]);

  return (
    <div className={`sheet relative w-full ${heightClass} overflow-hidden bg-[#0fa8d2]`}>
      <div ref={containerRef} className="h-full w-full" />

      {/* Controle Segmentado estilo Apple Maps (Atlas / Satélite / Grade) */}
      <div className="absolute left-3.5 top-3.5 z-[500] grid w-[222px] grid-cols-3 rounded-[10px] border border-black/[0.08] bg-[#EBEBF0]/88 p-[3px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[3px] left-[3px] top-[3px] w-[calc((100%-6px)/3)] rounded-[7.5px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0.5px_1px_rgba(0,0,0,0.08)] transition-transform duration-[260ms] [transition-timing-function:var(--ease-apple)]"
          style={{
            transform: `translate3d(${(['atlas', 'satellite', 'grid'] as GtaMapStyle[]).indexOf(style) * 100}%, 0, 0)`,
          }}
        />
        {(['atlas', 'satellite', 'grid'] as GtaMapStyle[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStyle(s)}
            className={`relative z-10 rounded-[7.5px] py-1 text-center text-[12px] font-medium transition-[color,transform] duration-150 [transition-timing-function:var(--ease-apple)] active:scale-95 ${
              style === s
                ? 'text-[#1D1D1F]'
                : 'text-[#515154] hover:text-[#1D1D1F]'
            }`}
          >
            {STYLE_META[s].label}
          </button>
        ))}
      </div>

      {/* Cápsula translúcida de coordenada estilo Apple Maps */}
      <div className="pointer-events-none absolute bottom-3.5 left-3.5 z-[500] rounded-[9px] border border-black/[0.08] bg-white/88 px-3 py-1.5 text-[12px] text-[#1D1D1F] shadow-[0_2px_10px_rgba(0,0,0,0.1)] backdrop-blur-xl">
        {cursorCoords ? (
          <span className="coord font-medium">
            X {cursorCoords.x.toFixed(1)} · Y {cursorCoords.y.toFixed(1)}
          </span>
        ) : (
          <span className="text-[#6E6E73]">Passe o mouse ou clique para ler X, Y</span>
        )}
      </div>
    </div>
  );
}
