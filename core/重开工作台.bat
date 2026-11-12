@echo off
setlocal EnableExtensions
rem Start the DSH team console from this folder.
rem Usage: 重开工作台.bat [workspace] [port]
rem Default workspace: %USERPROFILE%; default port: 8787

set "HERE=%~dp0"
set "WS=%~1"
if "%WS%"=="" set "WS=%USERPROFILE%"
set "PORT=%~2"
if "%PORT%"=="" set "PORT=8787"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 20 or newer first.
  exit /b 1
)

if not exist "%HERE%serve-workbench.mjs" (
  echo [ERROR] serve-workbench.mjs not found next to this script.
  exit /b 1
)

if not exist "%WS%\" (
  echo [ERROR] workspace not found: %WS%
  exit /b 1
)

echo [1/3] freeing port %PORT% ...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
  echo       stopping pid %%P
  taskkill /pid %%P /f >nul 2>nul
)

echo [2/3] starting console at http://127.0.0.1:%PORT%
start "dsh-team-console" /min node "%HERE%serve-workbench.mjs" "%WS%" --port=%PORT%

echo [3/3] waiting for health check ...
set "OK="
for /l %%I in (1,1,30) do (
  if not defined OK (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:%PORT%/api/health; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
    if not errorlevel 1 set "OK=1"
    if not defined OK timeout /t 1 /nobreak >nul
  )
)

if not defined OK (
  echo [ERROR] console did not answer on port %PORT%.
  echo         Run: node "%HERE%serve-workbench.mjs" "%WS%" --port=%PORT%
  exit /b 1
)

echo [OK] http://127.0.0.1:%PORT%/
start "" "http://127.0.0.1:%PORT%/"
exit /b 0
