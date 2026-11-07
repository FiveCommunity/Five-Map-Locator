@echo off
cd /d "%~dp0"
if exist "release\Five Map Locator.exe" (
    start "" "release\Five Map Locator.exe"
    exit /b 0
)
if exist "release\win-unpacked\Five Map Locator.exe" (
    start "" "release\win-unpacked\Five Map Locator.exe"
    exit /b 0
)
cd apps\electron
start "" npx electron .
