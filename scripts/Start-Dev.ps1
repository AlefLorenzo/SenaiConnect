[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$expectedNode = (Get-Content (Join-Path $root '.nvmrc') -Raw).Trim()

try {
    $currentNode = (& node --version 2>$null).Trim()
} catch {
    throw "Node.js não foi encontrado. Instale a versão $expectedNode."
}
if ($LASTEXITCODE -ne 0 -or $currentNode -ne "v$expectedNode") {
    throw "Versão Node incompatível. Esperada: v$expectedNode. Encontrada: $currentNode."
}

$createdEnv = $false
foreach ($project in @('backend', 'frontend')) {
    $projectPath = Join-Path $root $project
    $envPath = Join-Path $projectPath '.env'
    $examplePath = Join-Path $projectPath '.env.example'

    if (-not (Test-Path $envPath)) {
        Copy-Item $examplePath $envPath
        Write-Host "Criei $project/.env a partir do modelo. Preencha as configurações antes de continuar." -ForegroundColor Yellow
        $createdEnv = $true
    }
}
if ($createdEnv) {
    throw "Configuração local criada. Preencha backend/.env e execute este comando novamente. Arquivos existentes nunca são sobrescritos."
}

Push-Location (Join-Path $root 'backend')
try {
    & node scripts/validate-env.js
    if ($LASTEXITCODE -ne 0) {
        throw "Configuração do backend inválida. Revise backend/.env; nenhum valor secreto foi exibido."
    }
} finally {
    Pop-Location
}

function Ensure-Dependencies([string]$project) {
    $projectPath = Join-Path $root $project
    $modules = Join-Path $projectPath 'node_modules'
    $hiddenLock = Join-Path $modules '.package-lock.json'
    $packageFile = Join-Path $projectPath 'package.json'
    $lockFile = Join-Path $projectPath 'package-lock.json'
    $needsInstall = (-not (Test-Path $modules)) -or (-not (Test-Path $hiddenLock))

    if (-not $needsInstall) {
        $installedAt = (Get-Item $hiddenLock).LastWriteTimeUtc
        if ((Get-Item $packageFile).LastWriteTimeUtc -gt $installedAt -or
            (Get-Item $lockFile).LastWriteTimeUtc -gt $installedAt) {
            $needsInstall = $true
        }
    }

    if ($needsInstall) {
        Write-Host "Dependências de $project ausentes ou desatualizadas. Executando npm ci..." -ForegroundColor Cyan
        Push-Location $projectPath
        try {
            & npm ci
            if ($LASTEXITCODE -ne 0) {
                throw "Não foi possível instalar as dependências de $project."
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-Host "Dependências de $project já estão instaladas." -ForegroundColor Green
    }
}

function Get-Endpoint([string]$uri) {
    try {
        return Invoke-RestMethod -Uri $uri -TimeoutSec 3
    } catch {
        return $null
    }
}

function Test-PortListening([int]$port) {
    try {
        return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop | Select-Object -First 1)
    } catch {
        return $false
    }
}

function Start-Terminal([string]$workingDirectory, [string]$title) {
    $powershellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
    $command = "Write-Host '[SENAI Connect] $title' -ForegroundColor Cyan; npm run dev"
    Start-Process -FilePath $powershellPath -WorkingDirectory $workingDirectory -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy', 'Bypass',
        '-Command', $command
    ) | Out-Null
}

function Wait-ForBackendReady([int]$seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        $result = Get-Endpoint 'http://127.0.0.1:5000/api/health/ready'
        if ($null -ne $result -and $result.status -eq 'ready') {
            return $true
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Wait-ForFrontend([int]$seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -TimeoutSec 3 -UseBasicParsing
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                return $true
            }
        } catch {}
        Start-Sleep -Seconds 1
    }
    return $false
}

Ensure-Dependencies 'backend'
Ensure-Dependencies 'frontend'

$backendPath = Join-Path $root 'backend'
$frontendPath = Join-Path $root 'frontend'
$backendLive = Get-Endpoint 'http://127.0.0.1:5000/api/health'

if ($null -eq $backendLive) {
    if (Test-PortListening 5000) {
        throw "A porta 5000 já está ocupada por outro processo. Feche-o e tente novamente."
    }
    Write-Host "Iniciando backend..." -ForegroundColor Cyan
    Start-Terminal $backendPath 'Backend / API'
} else {
    Write-Host "Backend já está em execução. Não abrirei outra instância." -ForegroundColor Green
}

if (-not (Wait-ForBackendReady 60)) {
    throw "A API não ficou pronta com o PostgreSQL. Confira a janela do backend e a conexão DATABASE_URL do Supabase."
}

$frontResponse = $null
try {
    $frontResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -TimeoutSec 3 -UseBasicParsing
} catch {}

if ($null -eq $frontResponse) {
    if (Test-PortListening 5173) {
        throw "A porta 5173 já está ocupada por outro processo. Feche-o e tente novamente."
    }
    Write-Host "Iniciando frontend..." -ForegroundColor Cyan
    Start-Terminal $frontendPath 'Frontend / Vite'
    if (-not (Wait-ForFrontend 45)) {
        throw "O frontend não respondeu em http://localhost:5173. Confira a janela do Vite."
    }
} else {
    Write-Host "Frontend já está em execução. Não abrirei outra instância." -ForegroundColor Green
}

Write-Host ""
Write-Host "SENAI Connect está pronto. API, frontend e PostgreSQL respondendo." -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173"
Write-Host "Prontidão API + banco: http://localhost:5000/api/health/ready"
Start-Process 'http://localhost:5173'
