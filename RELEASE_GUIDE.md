# Guia de Publicação no GitHub (Código-Fonte + Executável `.exe`)

> **Por que separar Código-Fonte e `.exe` no GitHub?**  
> O GitHub bloqueia qualquer `git push` que contenha arquivos maiores que **100 MB** dentro do código-fonte. Como o `Five Map Locator.exe` tem **~138 MB** (pois traz todas as `.dll`s e o motor Chromium embutidos dentro de um único arquivo), a forma oficial usada por todos os grandes projetos (VS Code, CodeWalker, Discord, Obsidian) é:
> 1. **Subir o código-fonte limpo** via `git push` (o `.gitignore` já ignora a pasta `release/` automaticamente para nunca travar seu push).
> 2. **Anexar o `Five Map Locator.exe` e o `.sha256` na aba Releases do GitHub** (que aceita arquivos de até **2 GB** gratuitamente e gera o link direto de download!).

---

## Passo 1 — Subir o Código-Fonte para o GitHub

1. Crie um repositório vazio no GitHub (ex.: `five-map-locator`) **sem** marcar "Add README" (pois o projeto já tem um `README.md` completo).
2. Abra o PowerShell na pasta do projeto e rode:

```powershell
git init
git add .
git commit -m "feat: Five Map Locator v1.0.0 — app nativo Windows com DLLs embutidas e UI estilo Apple"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/five-map-locator.git
git push -u origin main
```

---

## Passo 2 — Publicar o Executável `.exe` na aba Releases

Você tem **duas formas** de publicar o `.exe`:

### Opção A: Manual pelo navegador (em 30 segundos)
1. No seu repositório do GitHub, clique em **Releases** (canto direito) → **Create a new release**.
2. Em **Choose a tag**, digite `v1.0.0` e clique em **Create new tag: v1.0.0 on publish**.
3. Título sugerido: `Five Map Locator v1.0.0 (Windows x64 — Portátil com DLLs Embutidas)`.
4. Na área **Attach binaries**, arraste os arquivos da pasta `release\`:
   - `release\Five Map Locator.exe` *(arquivo único com todas as DLLs embutidas — passe só ele para qualquer PC!)*
   - `release\Five Map Locator.exe.sha256` *(hash SHA-256 de verificação)*
   - `release\FiveCommunity-Certificado.cer` *(opcional: certificado público da assinatura)*
5. Clique em **Publish release**.

### Opção B: Automática na Nuvem (GitHub Actions já configurado!)
Já deixei configurado o workflow `.github/workflows/release.yml`. Sempre que você subir uma tag `v*` (por exemplo `v1.0.1`), os servidores Windows do próprio GitHub compilam o projeto, rodam os testes, embutem as DLLs, geram o `.sha256` e criam a Release sozinhos:

```powershell
git tag v1.0.0
git push origin v1.0.0
```
