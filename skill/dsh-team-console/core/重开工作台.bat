@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 ( echo [ERROR] node.exe not found in PATH & pause & exit /b 1 )

echo [1/4] stopping old workbench on port 8787...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8787" ^| findstr LISTENING') do (
  echo     kill pid=%%p
  taskkill /f /pid %%p >nul 2>&1
)
timeout /t 1 >nul

echo [2/4] starting 流氏工作台 (canvas build)...
start "workbench-8787" /min node "%~dp0serve-workbench.mjs" "%~dp0.." --port=8787
timeout /t 2 >nul

echo [3/4] health check...
powershell -NoProfile -Command "try{$r=Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8787/api/health' -TimeoutSec 5; Write-Host ('  OK  ' + $r.Content)}catch{Write-Host '  FAILED: old server still holds 8787. Right-click this file -^> Run as administrator, or restart DSH once and run this file again.'}"

echo [4/4] opening http://127.0.0.1:8787/
start "" "http://127.0.0.1:8787/"
echo.
echo Done. Entry: http://127.0.0.1:8787/  (左侧菜单「流氏工作台」)
pause
