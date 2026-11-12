@echo off
rem dsh-team-console launcher (Windows)
rem Usage: start-workbench.bat [workspace] [port]
setlocal EnableExtensions
chcp 65001 >nul

set "PORT=%~2"
if not defined PORT set "PORT=8787"
powershell -NoProfile -Command "$p=$env:PORT; if ($p -notmatch '^[1-9][0-9]*$' -or [int]$p -gt 65535) { exit 1 }"
if errorlevel 1 (
  echo [error] port must be a number between 1 and 65535: %PORT%
  exit /b 1
)

set "WS=%~1"

set "CONSOLE_HOME=%DSH_TEAM_CONSOLE_HOME%"
if not defined CONSOLE_HOME if defined WS if exist "%WS%\team-view\serve-workbench.mjs" for %%I in ("%WS%\team-view") do set "CONSOLE_HOME=%%~fI"
if not defined CONSOLE_HOME for %%I in ("%~dp0..\..\..\..") do set "CONSOLE_HOME=%%~fI"

if not exist "%CONSOLE_HOME%\serve-workbench.mjs" (
  echo [error] serve-workbench.mjs not found under:
  echo         %CONSOLE_HOME%
  echo         Set DSH_TEAM_CONSOLE_HOME to the folder containing it.
  exit /b 1
)

if not defined WS for %%I in ("%CONSOLE_HOME%\..") do set "WS=%%~fI"
if not exist "%WS%\." (
  echo [error] workspace not found: %WS%
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [error] Node.js 20 or newer is required.
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 (
  echo [error] Node.js 20 or newer is required. Current: 
  node --version
  exit /b 1
)

echo Workspace : %WS%
echo Console   : %CONSOLE_HOME%\serve-workbench.mjs
echo URL       : http://127.0.0.1:%PORT%/

start "dsh-team-console" /min node "%CONSOLE_HOME%\serve-workbench.mjs" "%WS%" --port=%PORT%

powershell -NoProfile -ExecutionPolicy Bypass -Command "for ($i = 0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:%PORT%/api/health'; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 300 }; exit 1"

if errorlevel 1 (
  echo [warn] Health check timed out. Check the minimized console window for errors.
  exit /b 1
) else (
  echo [ok] Workbench is up.
  start "" "http://127.0.0.1:%PORT%/"
)

endlocal
