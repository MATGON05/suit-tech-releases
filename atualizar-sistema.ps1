# Atualiza o sistema SUIT-TECH e publica uma nova versao no GitHub
$ErrorActionPreference = 'Stop'
$scriptPath = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptPath)) { $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition }
Set-Location -LiteralPath $scriptPath
$remoteUrl = 'https://github.com/MATGON05/suit-tech-releases.git'

function Parar-ComErro($mensagem) {
    Write-Host "`nERRO: $mensagem" -ForegroundColor Red
    Read-Host "Pressione ENTER para fechar"
    exit 1
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "     ATUALIZADOR DO SISTEMA SUIT-TECH" -ForegroundColor Cyan
Write-Host "===============================================`n" -ForegroundColor Cyan

if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) { Parar-ComErro "Git nao esta instalado. Instale em https://git-scm.com/download/win." }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { Parar-ComErro "Node.js/npm nao esta instalado. Instale em https://nodejs.org/." }

try {
    $ehRepositorio = Test-Path -LiteralPath (Join-Path $scriptPath '.git')
    if ($ehRepositorio) {
        $conflitos = @(git diff --name-only --diff-filter=U 2>$null)
        if ($conflitos.Count -gt 0) { git merge --abort 2>$null }
    }

    if (-not $ehRepositorio) {
        Write-Host "Primeira configuracao: inicializando o Git nesta pasta..." -ForegroundColor Yellow
        git init
        if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel inicializar o Git.' }
        git branch -M main
        $remotes = @(git remote 2>$null)
        if ($remotes -notcontains 'origin') { git remote add origin $remoteUrl }
        git add .
        git commit -m 'Versao inicial do sistema'
        if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel criar o commit inicial.' }
        Write-Host "Sincronizando com o GitHub sem substituir os arquivos locais..." -ForegroundColor Cyan
        git fetch origin main
        if ($LASTEXITCODE -eq 0) {
            git merge -s ours origin/main --allow-unrelated-histories -m 'Sincroniza projeto local com repositorio de releases'
            if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel sincronizar com o GitHub.' }
        }
        git push -u origin main
        if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel enviar ao GitHub. Verifique login e permissoes.' }
    }

    $branch = [string](git branch --show-current 2>$null)
    $branch = $branch.Trim()
    if ([string]::IsNullOrWhiteSpace($branch)) { $branch = 'main'; git branch -M main }
    $remoteOutput = @(git remote get-url origin 2>$null)
    $remote = if ($remoteOutput.Count -gt 0) { [string]$remoteOutput[0] } else { '' }
    if ([string]::IsNullOrWhiteSpace($remote)) { git remote add origin $remoteUrl }

    Write-Host "Pasta do projeto: $scriptPath"
    Write-Host "Branch: $branch`n"
    git fetch origin 2>$null
    if ($LASTEXITCODE -eq 0) {
        git pull --rebase origin $branch 2>$null
        if ($LASTEXITCODE -ne 0) {
            git rebase --abort 2>$null
            git pull origin $branch --allow-unrelated-histories --no-edit
            if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel sincronizar com o GitHub. Resolva conflitos no repositorio.' }
        }
    }

    $status = git status --porcelain
    if (-not [string]::IsNullOrWhiteSpace(($status -join ''))) {
        Write-Host "Arquivos alterados:" -ForegroundColor Yellow
        git status --short
        $mensagem = Read-Host "Digite uma descricao da alteracao (ou pressione ENTER)"
        if ([string]::IsNullOrWhiteSpace($mensagem)) { $mensagem = 'Atualizacao do sistema' }
        git add .
        git commit -m $mensagem
        if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel criar o commit.' }
    } else { Write-Host "Nenhuma alteracao de codigo encontrada." -ForegroundColor Yellow }

    Write-Host "`nAumentando a versao do sistema..." -ForegroundColor Cyan
    npm.cmd version patch -m "Publica versao %s"
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel aumentar a versao.' }

    Write-Host "`nEnviando codigo e tag para o GitHub..." -ForegroundColor Cyan
    git push origin $branch --tags
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel enviar para o GitHub. Verifique login e internet.' }

    Write-Host "`nATUALIZACAO PUBLICADA COM SUCESSO" -ForegroundColor Green
    Write-Host "O GitHub Actions deve gerar o instalador agora." -ForegroundColor Green
    git describe --tags --abbrev=0
} catch { Write-Host "`nERRO: $($_.Exception.Message)" -ForegroundColor Red }
Read-Host "`nPressione ENTER para fechar"
