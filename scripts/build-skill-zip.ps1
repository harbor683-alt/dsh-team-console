# 构建技能包 zip：dist/dsh-team-console-skill.zip
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-skill-zip.ps1
param([string]$Root = (Split-Path $PSScriptRoot -Parent))

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$src = Join-Path $Root 'skill/dsh-team-console'
$out = Join-Path $Root 'dist/dsh-team-console-skill.zip'
if (-not (Test-Path $src)) { throw "missing skill dir: $src" }
New-Item -ItemType Directory -Force -Path (Split-Path $out -Parent) | Out-Null
if (Test-Path $out) { Remove-Item $out -Force }

$zip = [System.IO.Compression.ZipFile]::Open($out, 'Create')
try {
  $prefix = 'dsh-team-console/'
  Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip, $_.FullName, ($prefix + $rel),
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
} finally {
  $zip.Dispose()
}
Write-Host ("built {0} ({1} bytes)" -f $out, (Get-Item $out).Length)
