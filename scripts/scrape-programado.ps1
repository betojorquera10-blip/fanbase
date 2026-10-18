# Lo ejecuta la tarea programada de Windows "FanBase - Scraper diario".
# 1. Corre `npm run scrape` contra la base de PRODUCCION (PRODUCCION_DATABASE_URL del .env).
# 2. Si termina bien, copia produccion a staging (`npm run copiar-a-staging`).
# Guarda la salida en logs\scrape-AAAA-MM-DD_HHmmss.log.
#
# Para correrlo a mano igual que la tarea:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\scrape-programado.ps1
#
# Sin tildes en este archivo: PowerShell 5.1 lo lee como ANSI.

$ErrorActionPreference = 'Continue'
# Node escribe en UTF-8; sin esto, en la tarea programada PowerShell lo lee
# con la codificacion antigua de la consola y las tildes salen mal en el log.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$proyecto = Split-Path $PSScriptRoot -Parent
Set-Location $proyecto

$carpetaLogs = Join-Path $proyecto 'logs'
New-Item -ItemType Directory -Force $carpetaLogs | Out-Null
$log = Join-Path $carpetaLogs ("scrape-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd_HHmmss'))
"=== FanBase scraper - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File $log -Encoding utf8

# El .env apunta a staging para desarrollar; los scrapers programados escriben en
# produccion. dotenv no pisa variables que ya existen, asi que basta con fijarla aqui.
$lineaProd = Get-Content (Join-Path $proyecto '.env') | Where-Object { $_ -match '^PRODUCCION_DATABASE_URL=' } | Select-Object -First 1
if (-not $lineaProd) {
  "ERROR: falta PRODUCCION_DATABASE_URL en el .env; no se corre nada." | Out-File $log -Append -Encoding utf8
  exit 1
}
$env:DATABASE_URL = ($lineaProd -replace '^PRODUCCION_DATABASE_URL=', '').Trim().Trim('"')

# cmd /c junta la salida normal y la de errores sin que PowerShell 5.1 la
# convierta en registros de error.
cmd /c "npm run scrape 2>&1" | Out-File $log -Append -Encoding utf8
$codigo = $LASTEXITCODE
"=== Fin scrapers (codigo de salida: $codigo) ===" | Out-File $log -Append -Encoding utf8

# Copia a staging aunque alguna fuente haya fallado: lo que si se actualizo tambien sirve.
cmd /c "npm run copiar-a-staging 2>&1" | Out-File $log -Append -Encoding utf8
$codigoCopia = $LASTEXITCODE
"=== Fin copia a staging (codigo de salida: $codigoCopia) ===" | Out-File $log -Append -Encoding utf8

# Conserva solo los ultimos 60 logs.
Get-ChildItem $carpetaLogs -Filter 'scrape-*.log' | Sort-Object Name -Descending | Select-Object -Skip 60 | Remove-Item -Force

if ($codigo -ne 0) { exit $codigo }
exit $codigoCopia
