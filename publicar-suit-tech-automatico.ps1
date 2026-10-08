$ErrorActionPreference = 'Stop'

# Ajuste estes dois caminhos se as pastas do seu computador forem diferentes.
$SourceRoot = Join-Path $HOME 'Desktop\MINHA EMPRESA\SUIT-TECH-corrigido-travamentos\SUIT-TECH-v1.0.16'
$RepoRoot = Join-Path $HOME 'Desktop\MINHA EMPRESA\suit-tech-releases-publicacao'
$RepoUrl = 'https://github.com/MATGON05/suit-tech-releases.git'

if (-not (Test-Path (Join-Path $SourceRoot 'package.json'))) {
    throw "Não encontrei o projeto de origem: $SourceRoot. Ajuste `$SourceRoot no início deste script."
}
if (-not (Test-Path (Join-Path $SourceRoot 'src\renderer\pages\orcamentos.html'))) {
    throw 'Não encontrei src\renderer\pages\orcamentos.html na pasta de origem.'
}
if (-not (Test-Path (Join-Path $SourceRoot 'src\renderer\js\glitter.js'))) {
    throw 'Não encontrei src\renderer\js\glitter.js na pasta de origem.'
}

if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
    if (Test-Path $RepoRoot) {
        $conteudoExistente = Get-ChildItem -LiteralPath $RepoRoot -Force | Select-Object -First 1
        if ($conteudoExistente) {
            throw "A pasta de destino existe, mas não é um clone Git: $RepoRoot. Renomeie-a ou ajuste `$RepoRoot."
        }
    } else {
        New-Item -ItemType Directory -Path (Split-Path -Parent $RepoRoot) -Force | Out-Null
    }
    Write-Host "A criar o clone Git em $RepoRoot ..."
    & git clone --branch main $RepoUrl $RepoRoot
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível clonar o repositório. Verifique Git e a ligação ao GitHub.' }
}

Push-Location $RepoRoot
try {
    $branch = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível verificar a branch Git.' }
    if ($branch -ne 'main') { throw "A branch atual é '$branch'; este script só publica a branch main." }

    $estado = & git status --porcelain
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível verificar o estado Git.' }
    if ($estado) {
        throw "O clone tem alterações locais pendentes. Revise-as antes de executar novamente:`n$($estado -join "`n")"
    }

    Write-Host 'A atualizar o clone a partir do GitHub...'
    & git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível atualizar o clone. Nenhuma nova publicação foi iniciada.' }

    $versaoAtual = (& node -p "require('./package.json').version").Trim()
    if ($LASTEXITCODE -ne 0 -or -not $versaoAtual) { throw 'Não foi possível ler a versão atual do repositório.' }

    Write-Host 'A sincronizar o projeto de origem com o clone...'
    $pastasExcluidas = @(
        (Join-Path $SourceRoot '.git'),
        (Join-Path $SourceRoot 'node_modules'),
        (Join-Path $SourceRoot 'dist'),
        (Join-Path $SourceRoot 'src\data\json'),
        (Join-Path $SourceRoot 'src\backend\__pycache__')
    )
    $ficheirosExcluidos = @('package.json', 'package-lock.json', '.env', '.env.*', '*.db', '*.sqlite', '*.sqlite3')
    $robocopyArgs = @($SourceRoot, $RepoRoot, '/E', '/COPY:DAT', '/DCOPY:DAT', '/R:1', '/W:1', '/XD') + $pastasExcluidas + @('/XF') + $ficheirosExcluidos + @('/NFL', '/NDL', '/NJH', '/NJS', '/NP')
    & robocopy @robocopyArgs
    $robocopyCode = $LASTEXITCODE
    if ($robocopyCode -ge 8) { throw "Falha ao copiar ficheiros do projeto (robocopy $robocopyCode)." }

    # Copia alterações intencionais às dependências, mas mantém a versão do clone
    # para que o incremento não tente reutilizar uma tag antiga.
    Copy-Item -LiteralPath (Join-Path $SourceRoot 'package.json') -Destination (Join-Path $RepoRoot 'package.json') -Force
    Copy-Item -LiteralPath (Join-Path $SourceRoot 'package-lock.json') -Destination (Join-Path $RepoRoot 'package-lock.json') -Force
    $atualizarVersao = "const fs=require('fs');const v=process.argv[1];const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version=v;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');const l=JSON.parse(fs.readFileSync('package-lock.json','utf8'));l.version=v;if(l.packages&&l.packages[''])l.packages[''].version=v;fs.writeFileSync('package-lock.json',JSON.stringify(l,null,2)+'\n');"
    & node -e $atualizarVersao $versaoAtual
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível alinhar package.json e package-lock.json à versão do clone.' }

    Write-Host "A executar npm test (versão base $versaoAtual)..."
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Os testes falharam. Nenhuma versão foi enviada ao GitHub.' }

    $alteracoes = & git status --porcelain
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível verificar as alterações sincronizadas.' }
    if (-not $alteracoes) {
        Write-Host 'Não há alterações novas para publicar.'
        return
    }

    Write-Host "`nFicheiros a publicar:"
    & git status --short
    & git add -A
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível preparar os ficheiros para o commit.' }
    & git diff --cached --check
    if ($LASTEXITCODE -ne 0) { throw 'A validação do diff encontrou problemas de formatação; publicação cancelada.' }

    $mensagem = 'Atualiza SUIT-TECH ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
    & git commit -m $mensagem
    if ($LASTEXITCODE -ne 0) { throw 'O commit falhou. Verifique a configuração do Git.' }

    Write-Host "`nA criar a próxima versão patch..."
    & npm.cmd version patch -m 'Publica versao %s'
    if ($LASTEXITCODE -ne 0) {
        throw 'Falha ao incrementar a versão. Verifique git status e git log antes de tentar novamente.'
    }

    Write-Host "`nA enviar commit e tag ao GitHub..."
    & git push origin main --tags
    if ($LASTEXITCODE -ne 0) {
        throw 'O envio falhou. Depois de corrigir o acesso, execute git push origin main --tags na pasta do clone.'
    }
    Write-Host "`nPublicação concluída. Consulte GitHub Actions para acompanhar a geração do instalador."
}
finally {
    Pop-Location
}
