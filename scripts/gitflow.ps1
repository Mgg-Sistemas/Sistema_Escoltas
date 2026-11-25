<#
.SYNOPSIS
    Ayudante GitFlow para el Sistema de Escoltas.

.DESCRIPTION
    Crea y sincroniza ramas siguiendo GitFlow. NO hace commit ni push:
    esos pasos se ejecutan únicamente cuando el usuario indica "SUBELO".

.PARAMETER Action
    init | feature | release | hotfix | status | sync

.PARAMETER Name
    Nombre de la rama (ej. modulo-permisos, 1.0.0).

.EXAMPLE
    powershell -File scripts/gitflow.ps1 -Action feature -Name "modulo-permisos"
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("init", "feature", "release", "hotfix", "status", "sync")]
    [string]$Action,

    [string]$Name
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[gitflow] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[gitflow] $msg" -ForegroundColor Green }
function Write-WarnMsg($msg) { Write-Host "[gitflow] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[gitflow] ERROR: $msg" -ForegroundColor Red; exit 1 }

function Assert-Repo {
    $inside = git rev-parse --is-inside-work-tree 2>$null
    if ($inside -ne "true") { Fail "La carpeta actual no es un repositorio Git." }
}

function Test-HasCommits {
    $null = git rev-parse --verify HEAD 2>$null
    return $LASTEXITCODE -eq 0
}

function Assert-Name {
    if ([string]::IsNullOrWhiteSpace($Name)) {
        Fail "Debes indicar -Name. Ejemplo: -Name 'modulo-permisos'"
    }
    if ($Name -match '[^a-zA-Z0-9._-]') {
        Fail "El nombre solo puede contener letras, números, punto, guion y guion bajo."
    }
}

function Get-Branch {
    (git branch --show-current).Trim()
}

Assert-Repo
$hasCommits = Test-HasCommits

switch ($Action) {
    "status" {
        Write-Step "Rama actual: $(Get-Branch)"
        git branch -vv
        Write-Step "Estado del working tree:"
        git status --short
    }

    "init" {
        if (-not $hasCommits) {
            Write-WarnMsg "El repositorio aún no tiene commits."
            Write-WarnMsg "No se crean ramas ni se hace commit: espera a que se indique 'SUBELO'."
            exit 0
        }
        Write-Step "Asegurando rama main..."
        git checkout main 2>$null | Out-Null
        if (-not $?) { git checkout -b main 2>$null | Out-Null }
        Write-Step "Asegurando rama develop desde main..."
        $dev = git show-ref --verify --quiet refs/heads/develop
        if ($LASTEXITCODE -ne 0) { git branch develop main }
        Write-Step "Publicando referencias (si hay remote)..."
        $remote = git remote
        if ($remote) {
            git push -u origin main 2>$null | Out-Null
            git push -u origin develop 2>$null | Out-Null
        }
        Write-Ok "GitFlow inicializado. main = producción, develop = integración."
    }

    "feature" {
        Assert-Name
        if (-not $hasCommits) { Fail "No hay commits aún. Espera a 'SUBELO' para inicializar." }
        $branch = "feature/$Name"
        Write-Step "Actualizando develop..."
        git checkout develop
        $remote = git remote
        if ($remote) { git pull --ff-only origin develop 2>$null | Out-Null }
        $exists = git show-ref --verify --quiet "refs/heads/$branch"
        if ($LASTEXITCODE -eq 0) { Fail "La rama $branch ya existe." }
        git checkout -b $branch
        Write-Ok "Rama creada: $branch (desde develop)."
    }

    "release" {
        Assert-Name
        if (-not $hasCommits) { Fail "No hay commits aún. Espera a 'SUBELO' para inicializar." }
        $branch = "release/$Name"
        Write-Step "Creando $branch desde develop..."
        git checkout develop
        $remote = git remote
        if ($remote) { git pull --ff-only origin develop 2>$null | Out-Null }
        git checkout -b $branch
        Write-Ok "Rama creada: $branch. Al terminar, merge a main y develop con --no-ff."
    }

    "hotfix" {
        Assert-Name
        if (-not $hasCommits) { Fail "No hay commits aún. Espera a 'SUBELO' para inicializar." }
        $branch = "hotfix/$Name"
        Write-Step "Creando $branch desde main..."
        git checkout main
        $remote = git remote
        if ($remote) { git pull --ff-only origin main 2>$null | Out-Null }
        git checkout -b $branch
        Write-Ok "Rama creada: $branch. Al terminar, merge a main y develop con --no-ff."
    }

    "sync" {
        if (-not $hasCommits) { Fail "No hay commits aún. Espera a 'SUBELO' para inicializar." }
        $current = Get-Branch
        $base = "develop"
        if ($current -like "hotfix/*") { $base = "main" }
        Write-Step "Sincronizando $current con $base (rebase)..."
        $remote = git remote
        if ($remote) { git fetch origin 2>$null | Out-Null }
        git rebase $base
        Write-Ok "Rama $current actualizada."
    }
}
