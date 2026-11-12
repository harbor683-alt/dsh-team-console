@echo off
rem dsh-team-console launcher (Windows)
rem Usage: start-workbench.bat [workspace] [port]
rem The skill ships its own core\; no external team-view folder is required.
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
if not defined WS set "WS=%CD%"

set "SKILL_DIR=%~dp0.."
for %%I in ("%SKILL_DIR%") do set "SKILL_DIR=%%~fI"
set "CONSOLE_HOME=%SKILL_DIR%\core"

if not exist "%CONSOLE_HOME%\serve-workbench.mjs" (
  if defined DSH_TEAM_CONSOLE_HOME if exist "%DSH_TEAM_CONSOLE_HOME%\serve-workbench.mjs" set "CONSOLE_HOME=%DSH_TEAM_CONSOLE_HOME%"
)
if not exist "%CONSOLE_HOME%\serve-workbench.mjs" (
  if exist "%WS%\team-view\serve-workbench.mjs" for %%I in ("%WS%\team-view") do set "CONSOLE_HOME=%%~fI"
)
if not exist "%CONSOLE_HOME%\serve-workbench.mjs" (
  echo [error] serve-workbench.mjs not found. Reinstall the skill package.
  exit /b 1
)

if not exist "%WS%\." (
  echo [error] workspace not found: %WS%
  exit /b 1
)

if not defined WORKBENCH_BOARD (
  if defined DSH_HOME (
    set "WORKBENCH_BOARD=%DSH_HOME%\team-console\board.json"
  ) else (
    set "WORKBENCH_BOARD=%USERPROFILE%\.dsh\team-console\board.json"
  )
)
for %%B in ("%WORKBENCH_BOARD%") do set "BOARD_DIR=%%~dpB"
if not exist "%BOARD_DIR%" mkdir "%BOARD_DIR%" >nul 2>nul

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
echo Board     : %WORKBENCH_BOARD%
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
