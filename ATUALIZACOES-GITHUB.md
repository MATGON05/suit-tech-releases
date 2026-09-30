# Atualizações automáticas do SUIT-TECH

O aplicativo usa `electron-updater` e o provedor GitHub Releases. O destino configurado é `MATGON05/suit-tech-releases`.

## Publicar uma nova versão

1. Altere o código.
2. Atualize o campo `version` em `package.json`, por exemplo de `1.0.1` para `1.0.2`.
3. Crie um commit e uma tag com o mesmo número, usando o prefixo `v`:

```bash
git add .
git commit -m "Versão 1.0.2"
git tag v1.0.2
git push origin main --tags
```

4. O workflow `.github/workflows/release.yml` será executado em um Windows do GitHub, gerará o instalador NSIS e publicará os arquivos da Release.
5. Nos computadores instalados, abra **Ferramentas → Atualização do Sistema → Verificar atualização**. O programa também faz uma verificação automática alguns segundos após iniciar.

## Observações

A atualização automática funciona em instaladores gerados pelo `electron-builder` com alvo Windows NSIS. A versão em desenvolvimento (`npm start`) informa que a atualização só está disponível na versão instalada.

O repositório de releases precisa existir e o primeiro workflow precisa ser autorizado no GitHub. O código-fonte não deve ser colocado nesse repositório público de releases se a intenção for mantê-lo privado.
