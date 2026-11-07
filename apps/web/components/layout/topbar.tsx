'use client';

import { usePathname } from 'next/navigation';

const TITLES: Record<string, string> = {
  '/': 'Visão geral',
  '/import': 'Importar mapa',
  '/locator': 'Localizador',
  '/gtamap': 'Mapa de San Andreas',
  '/reports': 'Histórico',
  '/settings': 'Configurações',
};

export function TopBar() {
  const pathname = usePathname();
  const base = '/' + (pathname.split('/')[1] ?? '');
  const crumb = TITLES[base] ?? 'Five Map';

  return (
    <header
      className="flex h-[38px] shrink-0 select-none items-center justify-between border-b border-black/[0.06] bg-[#F5F5F7]/85 pl-8 pr-40 backdrop-blur-xl"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="text-[13px] font-medium text-[#6E6E73]">{crumb}</span>

      <span className="flex items-center gap-1.5 text-[11.5px] text-[#8E8E93]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
        Execução local
      </span>
    </header>
  );
}
