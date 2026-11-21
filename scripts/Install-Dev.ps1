[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$expectedNode = (Get-Content (Join-Path $root '.nvmrc') -Raw).Trim()

try {
    $currentNode = (& node --version 2>$null).Trim()
} catch {
    throw "Node.js não foi encontrado. Instale a versão $expectedNode e abra um novo PowerShell."
}
if ($LASTEXITCODE -ne 0 -or $currentNode -ne "v$expectedNode") {
    throw "Versão Node incompatível. Esperada: v$expectedNode. Encontrada: $currentNode."
}
Write-Host "[SENAI Connect] Node.js $currentNode confirmado." -ForegroundColor Green

foreach ($project in @('backend', 'frontend')) {
    $projectPath = Join-Path $root $project
    $envPath = Join-Path $projectPath '.env'
    $examplePath = Join-Path $projectPath '.env.example'

    if (-not (Test-Path $envPath)) {
        if (-not (Test-Path $examplePath)) {
            throw "Arquivo modelo não encontrado: $examplePath"
        }
        Copy-Item $examplePath $envPath
        Write-Host "Criado $project/.env. Preencha os valores locais antes de iniciar." -ForegroundColor Yellow
    } else {
        Write-Host "$project/.env preservado. Nenhuma configuração existente foi sobrescrita." -ForegroundColor Green
    }
}

foreach ($project in @('backend', 'frontend')) {
    $projectPath = Join-Path $root $project
    Write-Host ""
    Write-Host "[SENAI Connect] Instalando dependências de $project com npm ci..." -ForegroundColor Cyan
    Push-Location $projectPath
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci falhou na pasta $project. Confira a mensagem acima."
        }
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Instalação concluída." -ForegroundColor Green
Write-Host "Confira backend/.env e preencha SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (ou SUPABASE_ANON_KEY) e DATABASE_URL (ou SUPABASE_DB_URL)."
Write-Host "Depois execute: powershell -ExecutionPolicy Bypass -File .\scripts\Start-Dev.ps1"
