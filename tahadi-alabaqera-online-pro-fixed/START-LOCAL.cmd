@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 and try again.
  pause
  exit /b 1
)
start "" "http://localhost:4173"
node scripts/play-local.mjs
pause
