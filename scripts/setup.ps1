<#
.SYNOPSIS
    Prepara el entorno local: instala dependencias y copia los .env.example.

.DESCRIPTION
    No modifica Git. Ejecutar desde la raíz del repositorio.
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $root

Write-Host "[setup] Repositorio: $repo" -ForegroundColor Cyan

foreach ($folder in @(".", "backend", "frontend")) {
    $path = if ($folder -eq ".") { $repo } else { Join-Path $repo $folder }
    $nombre = if ($folder -eq ".") { "raíz" } else { $folder }

    if (-not (Test-Path $path)) {
        Write-Host "[setup] Falta la carpeta $nombre" -ForegroundColor Red
        continue
    }

    $example = Join-Path $path ".env.example"
    $envFile = Join-Path $path ".env"
    if ((Test-Path $example) -and -not (Test-Path $envFile)) {
        Copy-Item $example $envFile
        Write-Host "[setup] Creado $nombre/.env (edítalo con tus valores)" -ForegroundColor Green
    }

    Write-Host "[setup] Instalando dependencias de $nombre..." -ForegroundColor Cyan
    Push-Location $path
    try { npm install } finally { Pop-Location }
}

Write-Host "[setup] Listo. Configura tus variables y ejecuta npm run dev desde la raíz." -ForegroundColor Green
