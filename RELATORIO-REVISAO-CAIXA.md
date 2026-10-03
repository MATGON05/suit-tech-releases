# Relatório de revisão — caixa e recepção de equipamentos

**Base analisada:** `ST-LDTA-revisado-servicos-terceirizados-v1.0.13.zip`  
**Versão corrigida:** `1.0.16`

## 1. Caixa e fecho mensal

O problema relatado era consistente com a interpretação de datas civis `AAAA-MM-DD` como UTC. Em fusos com diferença negativa face a UTC — como o de Brasília — a conversão para hora local pode recuar o lançamento para o dia anterior. Quando a data é o primeiro dia do mês, o filtro mensal pode colocá-lo no mês anterior.

A correcção usa um parser local nos caixas de entrada e saída, dashboard, gráficos financeiros, relatórios, devoluções e fecho mensal. As datas por omissão das operações financeiras também usam o calendário local.

O fecho aponta agora para o último mês concluído; preserva os lançamentos do mês actual e recalcula os saldos sem os contar duas vezes. O fecho exige backup válido, inclui `historico_mensal` no backup e verifica a gravação do arquivo antes de apagar movimentos activos. Os resumos monetários convertem valores numéricos em texto antes da soma/formatação.

## 2. Aba Entrada de Equipamento

A antiga ficha misturava a recepção com orçamento, valores, forma de pagamento, serviço em reparo e checklist de saída. Foi reorganizada para representar uma **entrada de equipamento**:

- cliente existente ou novo, contacto e CPF/e-mail;
- categoria, marca, modelo, cor, número de série e IMEI;
- acessórios entregues;
- queixa do cliente separada da avaliação visual da recepção;
- estado de energia, tela, carcaça, câmeras, áudio, botões/portas e sinais de líquido;
- prioridade, previsão de retorno do diagnóstico e responsável pela recepção;
- autorização para diagnóstico e confirmação das orientações sobre backup dos dados.

A ficha não pede preço, pagamento, diagnóstico técnico final nem checklist de entrega. Também deixou de recolher senhas/PINs: a interface informa para não guardar credenciais pessoais. A OS continua a ser gravada na coleção existente `vendas`, com campos compatíveis com Orçamentos, estágio inicial de avaliação e valor “A definir”. A lista de Orçamentos identifica a entrada como “Recebido para avaliação” e conserva os campos próprios da recepção quando os dados são editados depois.

O menu foi renomeado para **Entrada de Equipamento**. A ficha oferece resumo, impressão e envio de comprovante de recepção pelo WhatsApp.

## 3. Verificações efectuadas

- `npm test`: **aprovado** — testes de fecho mensal e teste de fumaça da nova ficha.
- Testes de fecho com `TZ=America/Sao_Paulo`: **aprovados**, incluindo falha simulada de backup/arquivo sem apagar movimentos.
- Sintaxe dos módulos JavaScript e Python: **aprovada**.
- Scripts inline das páginas HTML e ficheiros JSON: verificados.
- Tipos de equipamento da nova ficha: disponíveis também na edição posterior em Orçamentos.
- Versões de `package.json` e `package-lock.json`: sincronizadas em `1.0.16`.

## 4. Limitações e acções pendentes

1. A análise foi feita sobre o código e os ficheiros incluídos no ZIP. Não houve ligação à base de dados real/local nem à conta Supabase; por isso, **não confirmei nem alterei movimentos, clientes ou OS já gravados**.
2. Se um movimento já foi arquivado no mês errado por uma versão anterior, a correcção do código não o reintroduz automaticamente no caixa activo. Faça backup e confira `historico_mensal`, comparando `mes` com `dados.data`, antes de repor para evitar duplicação ou alteração do saldo.
3. A varredura também encontrou riscos de segurança fora do âmbito funcional: há uma conta local de administrador predefinida no código e a opção “lembrar senha” guarda a palavra-passe em texto simples no `localStorage`. Não alterei o fluxo de autenticação para não bloquear utilizadores existentes; recomendo tratar estes pontos numa revisão de segurança separada.
4. Não foi gerado instalador Windows nesta sessão. O ZIP contém o projecto e os testes; no Windows, instale as dependências com `npm.cmd ci` e inicie com `npm.cmd start`. Faça backup antes de substituir a aplicação em uso.

## 5. Revisão da ficha e busca de clientes — versão 1.0.16

Os textos visíveis da aba **Entrada de Equipamento**, do resumo e do comprovante foram revisados para português brasileiro, uniformizando termos como “registrar”, “equipe”, “contato”, “tela”, “Videogame” e “capa protetora”.

O campo de cliente agora pesquisa cadastros por nome parcial (ignorando diferenças de acentuação), telefone ou CPF. A busca aceita números com ou sem pontuação, apresenta até dez resultados e mostra nome, telefone e CPF sem inserir os dados do cliente como HTML. A pessoa pode selecionar um cadastro existente ou iniciar um novo; ao selecionar, os dados são preenchidos e vinculados à OS. A verificação de CPF duplicado direciona para o cadastro correspondente.

Os testes automatizados também verificam correspondências por nome com acento, trechos de telefone/CPF formatados e ausência de variantes ortográficas europeias na ficha.
