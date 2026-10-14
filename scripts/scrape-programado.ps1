# Lo ejecuta la tarea programada de Windows "FanBase - Scraper diario".
# Corre `npm run scrape` y guarda la salida en logs\scrape-AAAA-MM-DD_HHmmss.log.
#
# Para correrlo a mano igual que la tarea:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\scrape-programado.ps1

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
# cmd /c junta la salida normal y la de errores sin que PowerShell 5.1 la
# convierta en registros de error.
cmd /c "npm run scrape 2>&1" | Out-File $log -Append -Encoding utf8
$codigo = $LASTEXITCODE
# Sin tildes en los textos: PowerShell 5.1 lee este archivo como ANSI.
"=== Fin (codigo de salida: $codigo) ===" | Out-File $log -Append -Encoding utf8

# Conserva solo los últimos 60 logs.
Get-ChildItem $carpetaLogs -Filter 'scrape-*.log' | Sort-Object Name -Descending | Select-Object -Skip 60 | Remove-Item -Force

exit $codigo
