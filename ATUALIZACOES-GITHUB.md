# Atualizações automáticas do SUIT-TECH

O aplicativo usa `electron-updater` e o provedor GitHub Releases. O destino configurado é `MATGON05/suit-tech-releases`. O workflow publica o instalador Windows e, em seguida, o instalador universal macOS na mesma Release.

## Requisito para o macOS

O auto-updater do Electron no macOS exige que o aplicativo seja assinado. O workflow também notariza a versão para reduzir os bloqueios do Gatekeeper. Antes de publicar uma versão Mac, configure no repositório GitHub os seguintes **Actions secrets**:

| Secret | Conteúdo |
|---|---|
| `MACOS_CERTIFICATE` | Certificado Apple Developer ID Application exportado como `.p12` e codificado em Base64 |
| `MACOS_CERTIFICATE_PASSWORD` | Senha usada ao exportar o arquivo `.p12` |
| `APPLE_ID` | Apple ID associado à conta Apple Developer |
| `APPLE_APP_SPECIFIC_PASSWORD` | Senha específica de app gerada na conta Apple |
| `APPLE_TEAM_ID` | Team ID da conta Apple Developer |

O certificado deve ser um certificado válido **Developer ID Application**. Para codificar o `.p12` em Base64 no Mac, use `base64 -i certificado.p12 | pbcopy` e cole o conteúdo no secret `MACOS_CERTIFICATE`. Não coloque o certificado, senha ou outras credenciais no código-fonte. Sem esses secrets, o job macOS falha intencionalmente em vez de publicar um app sem assinatura que não possa atualizar-se com segurança.

## Publicar a versão 1.0.13

O projeto está configurado para a versão `1.0.13`, pois a tag `v1.0.12` já existe. No clone do repositório do GitHub, depois de copiar os arquivos atualizados para dentro dele, confira e publique assim:

```powershell
node -p "require('./package.json').version"
# Deve imprimir 1.0.13

git status --short
git add package.json package-lock.json ATUALIZACOES-GITHUB.md
git commit -m "Prepara versão 1.0.13"
git tag v1.0.13
git push origin main --tags
```

Se o commit disser que não há alterações, confira `git status` e se copiou os arquivos para o clone correto. Se a tag `v1.0.13` já existir, não a force nem a apague: escolha a próxima versão patch, atualize `package.json` e as duas ocorrências da versão neste `package-lock.json`, e use a nova versão no commit e na tag.

O workflow `.github/workflows/release.yml` será executado após o envio de uma nova tag: primeiro gera/publica o instalador NSIS de Windows e depois, em um runner macOS, gera/publica os arquivos universais `.dmg` e `.zip` assinados e a metadata de atualização do macOS.

Nos computadores instalados, o programa verifica atualizações alguns segundos após iniciar. Em **Ferramentas → Atualização do Sistema → Verificar atualização**, também é possível fazer uma verificação manual, baixar e instalar a atualização. O app precisa ser instalado pelo instalador oficial; `npm start` não recebe atualizações.

## Instalação inicial no Mac

Cada Mac precisa instalar uma vez o arquivo `.dmg` da Release. As atualizações seguintes serão verificadas pelo próprio aplicativo. O pacote universal atende Macs Intel e Apple Silicon.

## Observações

- O job macOS depende do job Windows para publicar os ativos na mesma Release em sequência.
- A atualização automática no Mac depende da assinatura Apple válida e da correspondência da identidade de assinatura entre versões.
- O build de Windows permanece NSIS e mantém o comportamento de atualização já existente.
- O primeiro workflow precisa ter permissão para publicar Releases no GitHub. Não armazene o código-fonte em um repositório público se a intenção for mantê-lo privado.
