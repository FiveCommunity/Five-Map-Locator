'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  FolderInput,
  Crosshair,
  Map as MapIcon,
  History,
  SlidersHorizontal,
  Youtube,
  MessageCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { openExternalLink } from '@/lib/utils';

const NAV = [
  { href: '/',         icon: LayoutGrid,        label: 'Visão geral' },
  { href: '/import',   icon: FolderInput,       label: 'Importar mapa' },
  { href: '/locator',  icon: Crosshair,         label: 'Localizador' },
  { href: '/gtamap',   icon: MapIcon,           label: 'Mapa San Andreas' },
  { href: '/reports',  icon: History,           label: 'Histórico' },
  { href: '/settings', icon: SlidersHorizontal, label: 'Configurações' },
];

/** Squircle estilo macOS com retículo Apple Maps */
function Mark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-8 w-8 shrink-0 drop-shadow-[0_2px_4px_rgba(0,113,227,0.22)] transition-transform duration-300 [transition-timing-function:var(--ease-apple)] group-hover/brand:scale-[1.04]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="appleMarkBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A84FF" />
          <stop offset="100%" stopColor="#0062CC" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="7.5" fill="url(#appleMarkBg)" />
      <g className="origin-center transition-transform duration-300 [transition-timing-function:var(--ease-apple)] group-hover/brand:rotate-45">
        <path d="M16 6.5v4.2M16 21.3v4.2M6.5 16h4.2M21.3 16h4.2" stroke="#FFFFFF" strokeWidth="1.65" strokeLinecap="round" />
        <circle cx="16" cy="16" r="5.1" fill="none" stroke="#FFFFFF" strokeWidth="1.65" />
      </g>
      <circle cx="16" cy="16" r="2.1" fill="#FFFFFF" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  const activeIndex = Math.max(
    0,
    NAV.findIndex(({ href }) => cleanPath === href || (href !== '/' && cleanPath.startsWith(href)))
  );

  return (
    <aside className="flex w-16 shrink-0 select-none flex-col border-r border-black/[0.06] bg-[#EBEBF0]/80 backdrop-blur-2xl lg:w-[232px]">
      <div
        className="group/brand flex h-[60px] items-center gap-3 px-4 pt-1"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <Mark />
        <div className="hidden leading-none lg:block">
          <p className="text-[15.5px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">
            Five Map
          </p>
          <p className="mt-1 text-[11.5px] text-[#6E6E73]">Localizador de MLO</p>
        </div>
      </div>

      <nav className="relative mt-2 flex flex-1 flex-col gap-1 px-2.5" aria-label="Navegação principal">
        {/* Pílula flutuante branca estilo Finder / Apple Music */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 right-2.5 top-0 h-9 rounded-[9px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0.5px_1px_rgba(0,0,0,0.05)] transition-transform duration-[260ms] [transition-timing-function:var(--ease-apple)]"
          style={{ transform: `translate3d(0, ${activeIndex * 40}px, 0)` }}
        />

        {NAV.map(({ href, icon: Icon, label }) => {
          const active = cleanPath === href || (href !== '/' && cleanPath.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'group relative z-10 flex h-9 items-center gap-2.5 rounded-[9px] px-3 text-[13.5px] transition-[color,transform,background-color] duration-150 [transition-timing-function:var(--ease-apple)] active:scale-[0.98]',
                active
                  ? 'font-medium text-[#1D1D1F]'
                  : 'text-[#515154] hover:bg-black/[0.04] hover:text-[#1D1D1F]'
              )}
            >
              <Icon
                className={clsx(
                  'h-[17px] w-[17px] shrink-0 transition-[color,transform] duration-150 [transition-timing-function:var(--ease-apple)]',
                  active ? 'text-[#0071E3]' : 'text-[#6E6E73] group-hover:scale-105 group-hover:text-[#1D1D1F]'
                )}
                strokeWidth={active ? 2 : 1.75}
              />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-black/[0.06] px-2.5 py-3">
        <button
          type="button"
          onClick={() => openExternalLink('https://www.youtube.com/@bkviniofc')}
          className="group flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-[13px] text-[#515154] transition-[background-color,color,transform] duration-150 [transition-timing-function:var(--ease-apple)] hover:bg-black/[0.045] hover:text-[#1D1D1F] active:scale-[0.98]"
        >
          <Youtube className="h-[17px] w-[17px] shrink-0 text-[#FF3B30] transition-transform duration-150 group-hover:scale-105" strokeWidth={1.8} />
          <span className="hidden lg:inline">Canal no YouTube</span>
        </button>
        <button
          type="button"
          onClick={() => openExternalLink('https://discord.gg/fivecommunity')}
          className="group flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-[13px] text-[#515154] transition-[background-color,color,transform] duration-150 [transition-timing-function:var(--ease-apple)] hover:bg-black/[0.045] hover:text-[#1D1D1F] active:scale-[0.98]"
        >
          <MessageCircle className="h-[17px] w-[17px] shrink-0 text-[#5856D6] transition-transform duration-150 group-hover:scale-105" strokeWidth={1.8} />
          <span className="hidden lg:inline">Discord FiveCommunity</span>
        </button>
        <p className="hidden px-3 pt-2 text-[11px] text-[#8E8E93] lg:block">Versão 1.0 · Assinado SHA-256</p>
      </div>
    </aside>
  );
}
