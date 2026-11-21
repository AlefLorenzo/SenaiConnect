# SENAI Connect

Plataforma educacional em formato de rede social acadêmica para conectar alunos, professores, empresas e comunidades de aprendizagem.

## Stack atual

- Frontend: React 19, React Router e Vite 8.
- Backend: Node.js 24 e Express 5.
- Comunicação em tempo real: Socket.IO.
- Banco de dados: PostgreSQL hospedado no Supabase.
- Autenticação: Supabase Auth, validada pelo backend.
- Hospedagem: Render (frontend e API em serviços separados).

## Requisitos

- Node.js **24.22.1** (versão definida em .nvmrc e .node-version).
- npm incluído na instalação do Node.js.
- Git.
- Acesso ao projeto Supabase e às credenciais de desenvolvimento.
- Windows PowerShell, macOS ou Linux.

Confira as versões instaladas:

~~~bash
node --version
npm --version
git --version
~~~

A versão esperada do Node é v24.22.1. Caso utilize nvm, execute nvm install 24.22.1 e nvm use 24.22.1 (no Windows, use o nvm-windows).

## 1. Baixar o projeto

~~~bash
git clone https://github.com/AlefLorenzo/SenaiConnect.git
cd SenaiConnect
git switch feat/supabase-migration-auth
~~~

Se a equipe estiver trabalhando em outra branch, substitua o nome da branch pelo branch de desenvolvimento adotado.

## 2. Configurar e iniciar o backend

Abra um terminal na raiz do projeto e entre na pasta backend.

No Windows PowerShell:

~~~powershell
cd backend
Copy-Item .env.example .env
npm ci
~~~

No macOS/Linux:

~~~bash
cd backend
cp .env.example .env
npm ci
~~~

Abra backend/.env e preencha os valores reais:

| Variável | Obrigatória | Uso |
|---|---:|---|
| NODE_ENV | Não | Use development no ambiente local. |
| PORT | Não | Porta local da API; padrão 5000. |
| FRONTEND_URL | Sim para CORS | Origem local do Vite; padrão http://localhost:5173. |
| FRONTEND_URLS | Não | Outras origens permitidas, separadas por vírgula. |
| SUPABASE_URL | Sim | URL do projeto Supabase. |
| SUPABASE_PUBLISHABLE_KEY | Sim* | Chave publicável do Supabase usada pelo backend para Auth. |
| SUPABASE_ANON_KEY | Sim* | Nome legado aceito como alternativa à chave publicável. |
| DATABASE_URL | Sim* | URI PostgreSQL do Supabase. |
| SUPABASE_DB_URL | Sim* | Alternativa legada aceita pelo conector do banco. |
| SUPABASE_AUTH_TIMEOUT_MS | Não | Timeout das chamadas de autenticação; padrão 10000 ms. |
| DB_SSL | Não | Use require para conexões TLS. |
| DB_POOL_MAX | Não | Limite do pool PostgreSQL; padrão 10. |

* Informe uma das opções de cada grupo: SUPABASE_PUBLISHABLE_KEY ou SUPABASE_ANON_KEY; DATABASE_URL ou SUPABASE_DB_URL.

Copie a URI PostgreSQL em Supabase > Connect. Para um serviço Node persistente, escolha um método de conexão compatível com o ambiente de hospedagem e a disponibilidade de IPv4. Não compartilhe nem envie a senha do banco ao GitHub.

A chave publicável/anon é usada no backend para as chamadas REST do Supabase Auth. Não coloque credenciais do banco, service_role ou outros segredos em variáveis VITE_*: tudo que começa com VITE_ pode ser incluído no JavaScript enviado ao navegador.

As variáveis MYSQL_SOURCE_* são opcionais e servem exclusivamente para a ferramenta de cópia de dados legados MySQL. Não preencha nem execute a migração para iniciar o sistema.

Valide o ambiente e inicie a API:

~~~bash
npm run check:env
npm run dev
~~~

A API local ficará em http://localhost:5000. Mantenha esse terminal aberto.

## 3. Configurar e iniciar o frontend

Abra um **segundo terminal** na raiz do projeto:

Windows PowerShell:

~~~powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
~~~

macOS/Linux:

~~~bash
cd frontend
cp .env.example .env
npm ci
npm run dev
~~~

O arquivo frontend/.env deve conter:

~~~dotenv
VITE_API_URL=http://localhost:5000
VITE_USE_MOCK=false
~~~

VITE_API_URL aponta para a API Node/Express. VITE_USE_MOCK deve permanecer false para utilizar autenticação, feed, mensagens e dados reais. O modo mock existe apenas para desenvolvimento visual e não representa uma sessão real.

Abra http://localhost:5173 no navegador. O frontend e o backend precisam estar rodando ao mesmo tempo.

## Reabrir o projeto em outro dia (Windows)

Depois que a instalação inicial estiver concluída e `backend/.env` estiver preenchido, não é necessário repetir a instalação toda vez.

**Primeira configuração:** na raiz do repositório, execute:

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Install-Dev.ps1
~~~

Esse comando cria os arquivos `.env` somente quando ainda não existem e instala as dependências com `npm ci`. Ele nunca substitui seus arquivos `.env` existentes.

**Nas próximas vezes:** abra a pasta do projeto e execute:

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Start-Dev.ps1
~~~

O inicializador:

1. Confere a versão do Node.js e as variáveis obrigatórias.
2. Reinstala dependências somente quando estiverem ausentes ou desatualizadas.
3. Detecta se API ou frontend já estão ativos para evitar abrir instâncias duplicadas.
4. Inicia os serviços que faltam em janelas separadas.
5. Aguarda a API confirmar acesso ao PostgreSQL do Supabase e o Vite responder antes de abrir o navegador.

Para encerrar, use `Ctrl+C` nas janelas do backend e do frontend. Fechar o navegador não encerra os servidores. O banco Supabase permanece remoto e os dados não são apagados ao fechar ou reabrir o projeto.

A API oferece `GET /api/health` para verificar o processo e `GET /api/health/ready` para verificar também a conexão PostgreSQL. A rota de prontidão não expõe credenciais nem dados de usuários.

Se o PowerShell bloquear a execução de scripts, use o comando acima com `-ExecutionPolicy Bypass`; isso não altera a política global do Windows.

---

## 4. Comandos úteis

### Backend (dentro de backend/)

| Comando | Ação |
|---|---|
| npm run dev | Inicia a API com reinicialização automática ao alterar arquivos. |
| npm start | Valida o ambiente e inicia a API sem modo watch. |
| npm run check:env | Verifica as variáveis obrigatórias sem exibir seus valores. |
| npm run check | Verifica a sintaxe dos principais arquivos do servidor. |
| npm test | Executa as verificações e os testes automatizados existentes. |

### Frontend (dentro de frontend/)

| Comando | Ação |
|---|---|
| npm run dev | Inicia o servidor Vite. |
| npm run build | Gera a versão de produção em frontend/dist. |
| npm run preview | Serve localmente a build de produção para conferência. |
| npm run lint | Executa o ESLint. |
| npm test | Executa os testes Jest. |
| npm run test:ci | Executa os testes em sequência, com cobertura, adequado para CI. |
| npm run check | Executa lint e build. |

Use npm ci para instalar exatamente as dependências registradas no package-lock.json. Use npm install somente quando for intencional adicionar/atualizar dependências; nesse caso, versione também o package-lock.json correspondente.

## 5. Fluxo de conexão local

1. O navegador carrega o React/Vite em localhost:5173.
2. O frontend envia as chamadas HTTP e a conexão Socket.IO para a URL definida em VITE_API_URL.
3. O Express atende a API e valida as sessões por meio do Supabase Auth.
4. O backend acessa o PostgreSQL do Supabase usando DATABASE_URL.
5. O frontend recebe somente os dados necessários para a interface; segredos permanecem no backend.

Se alterar PORT no backend, atualize VITE_API_URL no frontend e FRONTEND_URL no backend para refletirem as novas portas/origens. As origens precisam coincidir exatamente, incluindo protocolo e porta.

## 6. Solução de problemas de instalação

- **Node incompatível / erro do Vite:** confirme node --version e use Node 24.22.1.
- **Dependências inconsistentes:** dentro da pasta afetada, execute npm ci. Não apague nem recrie os arquivos package-lock.json.
- **Porta 5000 ocupada:** encerre o processo que usa a porta ou defina outra PORT no backend e atualize VITE_API_URL e FRONTEND_URL.
- **Erro de CORS:** confira se FRONTEND_URL é exatamente http://localhost:5173 (ou a origem que o Vite mostrou no terminal).
- **API não conecta ao banco:** confira DATABASE_URL, usuário, senha, host, porta, SSL e método de conexão copiado do painel Supabase.
- **Falha de autenticação:** confirme SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY; não use a senha do banco como chave de API.
- **Tela abre, mas dados não carregam:** confirme que os dois terminais continuam ativos, VITE_API_URL aponta para a API e VITE_USE_MOCK está false.

Nunca publique arquivos .env, tokens, senhas, chaves privadas ou arquivos de sessão. Os arquivos .env.example são modelos sem credenciais reais.

## 7. Banco de dados e preservação de dados

O ambiente local utiliza o banco Supabase configurado em DATABASE_URL. A instalação de dependências não cria, apaga nem migra tabelas. Não execute scripts de cópia, reset, seed ou alteração de schema automaticamente.

Antes de qualquer mudança futura no schema ou nos dados, revise o SQL e o impacto, faça backup/exportação apropriada e valide primeiro em um ambiente separado. O script de migração MySQL para Supabase é uma ferramenta específica e não faz parte do fluxo normal de inicialização.

## 8. Estado dos ambientes

- Desenvolvimento local: frontend e backend iniciados separadamente, com arquivos .env próprios.
- Produção: variáveis configuradas nos serviços Render e no Supabase; não reutilize credenciais locais.
- Deploy: o frontend é compilado com Vite; o backend é iniciado como serviço Node/Express.

Consulte também a documentação oficial:
- Node.js: https://nodejs.org/en/download
- npm ci: https://docs.npmjs.com/cli/commands/npm-ci
- Vite: https://vite.dev/guide/
- Supabase: https://supabase.com/docs
- Render: https://render.com/docs
