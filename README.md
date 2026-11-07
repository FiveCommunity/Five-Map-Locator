# Five Map Locator

Aplicativo desktop **100% nativo para Windows** que localiza automaticamente mapas, MLOs e recursos `stream` de **GTA V / FiveM**, extraindo as coordenadas exatas (`vector3` e `/tp`) diretamente dos binários RSC7/XML (`.ymap`, `.ytyp`, `.ymf`) e marcando o ponto no mapa interativo de San Andreas.

[![YouTube](https://img.shields.io/badge/YouTube-@bkviniofc-FF3B30?style=flat-square&logo=youtube&logoColor=white)](https://www.youtube.com/@bkviniofc)
[![Discord](https://img.shields.io/badge/Discord-FiveCommunity-5856D6?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/fivecommunity)
[![Platform](https://img.shields.io/badge/Windows-x64%20Nativo-0071E3?style=flat-square&logo=windows&logoColor=white)](#download-executável-pronto)
[![License](https://img.shields.io/badge/Licença-MIT-34C759?style=flat-square)](./LICENSE)

---

## Destaques

- **100% Nativo & Autossuficiente (Zero Servidores Externos):** Roda inteiramente via IPC dentro do Electron com protocolo interno `app://`. Não abre terminais pretos, não usa portas locais e funciona offline.
- **Executável Único com DLLs Embutidas:** O binário `Five Map Locator.exe` traz todas as bibliotecas do Chromium e do Microsoft Visual C++ Runtime (`vcruntime140.dll`, `msvcp140.dll`, `concrt140.dll`) integradas dentro de um único arquivo `.exe` — basta copiar para qualquer PC e abrir.
- **Assinatura Digital SHA-256 & Checksum:** Assinado via Authenticode (`SHA-256`) acompanhado de arquivo `.sha256` para verificação de integridade.
- **Interface & Animações Estilo Apple (macOS):** Superfícies translúcidas com vibrância, tipografia óptica variável (`SF Pro` / `Inter` + `JetBrains Mono`), controles segmentados deslizantes acelerados por GPU e curvas de mola suaves (`cubic-bezier(0.32, 0.72, 0, 1)`).
- **Mapa Interativo de San Andreas (`gta-v-map-leaflet`):** Calibração cartesiana exata do GTA V com alternância instantânea entre **Atlas**, **Satélite** e **Grade**, beacon pulsante no MLO localizado e leitura de `vector3` ao clicar em qualquer rua.

---

## Download (Executável Pronto)

Baixe a versão pronta na aba [**Releases**](../../releases):

1. Baixe o arquivo **`Five Map Locator.exe`** (executável único portátil — todas as DLLs já estão embutidas).
2. Clique duas vezes para abrir — não precisa instalar Node.js, Visual C++ nem dependências extras.

### Verificando o Hash SHA-256 no PowerShell (Opcional)

```powershell
Get-FileHash ".\Five Map Locator.exe" -Algorithm SHA256
Get-AuthenticodeSignature ".\Five Map Locator.exe"
```

---

## Arquitetura do Projeto

```text
five-map-locator/
├── apps/
│   ├── electron/        # Processo Principal Nativo (IPC, protocolo app://, store atômico, scripts de assinatura/DLL)
│   ├── web/             # Interface estática (Next.js 14 Static Export, Tailwind CSS, Leaflet GTA V CRS)
│   └── api/             # Motor HTTP opcional apenas para desenvolvimento em navegador
├── packages/
│   ├── shared/          # Tipos globais, limites geográficos e regiões de San Andreas
│   ├── parser/          # Leitor binário RSC7 / XML (.ymap, .ytyp, .ymf, .zip)
│   └── locator/         # Motor de cálculo de centroide, score de confiança e matching de regiões
├── assets/              # Ícone nativo Windows (.ico 256x256)
└── electron-builder.yml # Configuração do executável único Windows x64
```

---

## Compilando a partir do Código-Fonte

### Pré-requisitos
- **Node.js** 20+
- **pnpm** 9+

### Comandos

```bash
# 1. Instalar dependências do workspace
pnpm install

# 2. Rodar suíte de testes automatizados (Parser + Locator)
pnpm test

# 3. Compilar interface estática + bundle nativo Electron
pnpm build

# 4. Gerar o executável único Windows (.exe com DLLs embutidas + assinatura SHA-256)
pnpm --filter @five-map/electron dist
```

O executável final assinado será gerado em:
- `release/Five Map Locator.exe`
- `release/Five Map Locator.exe.sha256`
- `release/FiveCommunity-Certificado.cer`

---

## Comunidade & Suporte

- **YouTube Oficial:** [youtube.com/@bkviniofc](https://www.youtube.com/@bkviniofc)
- **Discord FiveCommunity:** [discord.gg/fivecommunity](https://discord.gg/fivecommunity)
