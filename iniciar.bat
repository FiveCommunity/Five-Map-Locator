@echo off
title Five Map Locator — Inicializador
cd /d "%~dp0"

echo ===================================================
echo           FIVE MAP LOCATOR — GTA V / FiveM
echo ===================================================
echo.

:: Se houver resquicio de build standalone com travas do Windows, limpa suave
if exist "apps\web\.next\standalone" (
    echo Limpando cache antigo...
    rd /s /q "apps\web\.next" >nul 2>&1
)

echo Iniciando servicos locais...
echo Backend API : http://127.0.0.1:3847
echo Frontend Web: http://localhost:3000
echo.

start "Five Map Locator - API" cmd /k "pnpm --filter @five-map/api dev"
timeout /t 2 /nobreak >nul

start "Five Map Locator - Web" cmd /k "pnpm --filter @five-map/web dev"
timeout /t 3 /nobreak >nul

echo Abrindo navegador...
start http://localhost:3000

echo.
echo [OK] Servicos iniciados com sucesso!
echo Para encerrar, basta fechar as janelas dos servicos.
pause
