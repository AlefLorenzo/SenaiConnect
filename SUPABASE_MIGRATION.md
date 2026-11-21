# Migração do SENAI Connect para Supabase

A branch \`feat/supabase-migration-auth\` prepara a API para usar Supabase Auth e PostgreSQL. A branch \`main\` e o banco MySQL original não são alterados por este trabalho.

## Serviços e variáveis

No backend, copie \`backend/.env.example\` para \`backend/.env\` e informe os valores reais:

- \`SUPABASE_URL\`: URL do projeto Supabase.
- \`SUPABASE_PUBLISHABLE_KEY\`: chave publishable do projeto. Não use uma service role key no frontend.
- \`DATABASE_URL\`: URI PostgreSQL do Supabase, copiada em **Supabase > Connect**. Para uma API Node persistente, use a opção **Session pooler**.
- \`FRONTEND_URL\`: endereço principal do frontend.
- \`FRONTEND_URLS\`: outros endereços de frontend separados por vírgula, por exemplo o domínio de produção.
- \`MYSQL_SOURCE_*\`: conexão local com o banco antigo. O padrão histórico deste repositório é host \`localhost\`, usuário \`root\`, banco \`redesocial\`.

Nunca grave senhas, tokens privados, URIs com senha ou chaves de serviço no Git.

## Configuração do Supabase Auth

No painel Supabase, em **Authentication > URL Configuration**, defina o Site URL e adicione os Redirect URLs usados no ambiente local e no domínio real da aplicação, incluindo:

- \`http://localhost:5173/reset-password\`
- \`https://SEU-DOMINIO/reset-password\`

O domínio de produção precisa ser substituído pelo domínio real publicado. A aplicação restringe o cadastro aos endereços \`@estudante.senai.com\` e \`@docente.senai.com\`.

## Testes locais antes de publicar

Na pasta \`backend\`:

\`\`\`powershell
npm ci
npm test
\`\`\`

Na pasta \`frontend\`:

\`\`\`powershell
npm ci
npm test -- --run
npm run build
\`\`\`

O CI do GitHub executa os testes do backend, os testes do frontend e o build de produção em cada atualização da branch de migração.

## Cópia dos dados antigos

**Faça primeiro um backup completo do MariaDB/MySQL e não desligue nem apague o banco antigo.** O importador começa em modo de simulação:

\`\`\`powershell
cd backend
npm run db:copy:dry-run
\`\`\`

Revise todas as tabelas e colunas informadas como incompatíveis ou sem destino. A simulação não grava nada. A cópia real exige os dois sinalizadores de confirmação:

\`\`\`powershell
npm run db:copy:apply
\`\`\`

O importador aborta se as tabelas de destino correspondentes já contiverem registros, se faltar uma coluna obrigatória, se houver incompatibilidades não resolvidas ou se a cópia não puder ser feita com segurança. Ele preserva IDs, trata FKs circulares anuláveis e grava dentro de uma transação. Se a simulação apontar tabelas/colunas de origem sem correspondência, não aceite a omissão automaticamente: mapeie os campos primeiro; só use \`--allow-unmapped\` depois de revisar conscientemente as perdas.

Os hashes antigos em \`users.password_hash\` não são copiados para o Supabase Auth. Depois da cópia, cada usuário legado deve ativar a conta usando o mesmo e-mail institucional e o fluxo de recuperação de senha. Isso evita tratar um hash MySQL como se fosse uma credencial Supabase válida.

## Ordem segura de ativação

1. Configure as variáveis privadas no ambiente do backend.
2. Configure os Redirect URLs do Supabase Auth e o domínio de frontend permitido em \`FRONTEND_URLS\`.
3. Faça backup do MySQL e rode a simulação até resolver os avisos.
4. Faça a cópia e compare contagens por tabela e registros-chave.
5. Teste com duas contas institucionais distintas: cadastro, confirmação/recuperação, sessão, perfil, mensagens e rotas administrativas.
6. Só depois altere o ambiente de produção para usar esta branch/versão. Mantenha o MySQL e seu backup até concluir a validação e a janela de rollback.

## Segurança e observações

- A API valida cada bearer token com Supabase Auth e associa o usuário ao perfil local por \`auth_user_id\`.
- A autorização administrativa é lida do perfil no banco; o cliente não pode definir a própria função administrativa.
- Os privilégios de acesso direto a tabelas continuam revogados para \`anon\` e \`authenticated\`. O backend é o ponto de acesso; não exponha uma service role key no navegador.
- O aviso do Security Advisor sobre tabelas RLS sem policies reflete esse bloqueio intencional. Não conceda privilégios diretos nem crie policies amplas sem modelar as regras de privacidade de cada recurso.
- A transferência efetiva dos dados só pode ser executada no ambiente que consegue alcançar o MySQL local e que tenha a URI privada do PostgreSQL.
