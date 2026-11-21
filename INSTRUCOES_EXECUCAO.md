# SENAI Connect - Instruções para Execução Local

## ✅ Status do Projeto

Todos os erros de sintaxe, migrações e configurações foram corrigidos. O projeto está **pronto para execução** no ambiente local com XAMPP.

---

## 📋 Correções Realizadas

### Backend
1. **migração `migrate_business_platform.js`** - Corrigida ordem das tabelas (FK) e exportação do módulo
2. **migração `migrate_complete.js`** - Importação correta do `migrateBusinessPlatform`
3. **`server.js`** - Removido flag `--watch`, adicionado graceful shutdown
4. **`adminRoutes.js`** - Usa `authController.login` (endpoint unificado)
5. **`authController.js`** - Login unificado com `redirectTo` baseado no role
6. **`adminAuthController.js`** - Simplificado para apenas `logAdminAction`
6. **`adminAuth.js` / `auth.js`** - Middlewares JWT funcionais

### Frontend
1. **`BusinessProfilePage.jsx`** - Corrigidos ternários JSX (UserPlus/UserX)
2. **`BusinessDashboardCampaigns.jsx`** - Ícone Stop → Square (Pause)
3. **`BusinessDashboardSettings.jsx`** - Corrigidas aspas aninhadas
4. **`BusinessDashboardBilling.jsx`** - Removida declaração duplicada de `token`
5. **`Dashboard.jsx` (Admin)** - Imports Calendar, Settings, Shield
6. **`AdminAudit.jsx`** - Import CheckCircle
7. **`AdminLogin.jsx`** - Usa `/api/auth/login` + AuthContext
8. **`AuthContext.jsx`** - Login unificado, compatibilidade admin_token

---

## 🚀 Passos para Executar Localmente

### 1. Iniciar MySQL no XAMPP
```
1. Abra o XAMPP Control Panel
2. Clique em "Start" ao lado de MySQL
3. Verifique se está rodando na porta 3306
```

### 2. Configurar Backend
```bash
cd C:\RedeSocialSenai_corrigido\RedeSocialSenai\backend

# Instalar dependências (se não fez ainda)
npm install

# Executar migrações (ordem importante!)
node migrate_fix_schema.js
node migrate_business_platform.js

# Criar usuário admin
node seed_admin.js

# Iniciar servidor
npm run dev
# ou: node server.js
```

### 3. Configurar Frontend
```bash
cd C:\RedeSocialSenai_corrigido\RedeSocialSenai\frontend

# Instalar dependências (se não fez ainda)
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

### 4. Acessar a Aplicação
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

### 5. Credenciais de Teste
- **Admin**: admin@senai.com / admin123
- **Login Admin**: http://localhost:5173/admin/login

---

## 🔧 Verificações Pós-Execução

### Backend
```bash
# Testar se API está rodando
curl http://localhost:5000/health

# Testar login admin
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@senai.com","password":"admin123"}'
```

### Frontend
1. Abrir http://localhost:5173
2. Verificar se não aparece "API offline"
3. Acessar http://localhost:5173/admin/login
4. Fazer login com admin@senai.com / admin123
5. Verificar redirecionamento para /admin/dashboard

---

## 📁 Estrutura de Arquivos Principais

```
RedeSocialSenai/
├── backend/
│   ├── server.js                    # Entry point
│   ├── db.js                        # MySQL pool
│   ├── migrate_fix_schema.js        # Migração base
│   ├── migrate_business_platform.js # Migração business
│   ├── migrate_complete.js          # Migração completa
│   ├── seed_admin.js                # Seed admin
│   ├── .env                         # Configurações
│   ├── controllers/                 # Controllers
│   ├── routes/                      # Rotas
│   └── middlewares/                 # Auth middlewares
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  # Rotas principais
│   │   ├── context/                 # AuthContext, SocketContext
│   │   ├── pages/                   # Páginas
│   │   └── components/              # Componentes
│   ├── .env                         # VITE_API_URL
│   └── package.json
```

---

## ⚠️ Problemas Conhecidos & Soluções

| Problema | Solução |
|----------|---------|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL não está rodando no XAMPP |
| `migrateBusinessPlatform is not a function` | Já corrigido - verificar se arquivo foi salvo |
| `ER_NO_REFERENCED_ROW_2` (FK error) | Executar `migrate_fix_schema.js` ANTES do `migrate_business_platform.js` |
| `API offline` no frontend | Backend não está rodando na porta 5000 |
| Tela branca no admin | Verificar console (F12) - geralmente erro de import |
| `Senha incorreta` | Executar `node seed_admin.js` novamente |

---

## 🎯 Próximos Passos (Pós-Execução)

1. **Testar todas as funcionalidades admin**:
   - Dashboard com gráficos
   - Avisos (CRUD)
   - Denúncias
   - Usuários
   - Auditoria
   - Configurações

2. **Testar plataforma Business**:
   - /divulgacao (feed)
   - /business/directory
   - /business/dashboard (posts, stories, campaigns, analytics, billing, settings)

3. **Implementar MercadoPago** (para monetização):
   ```bash
   cd backend && npm install mercadopago
   ```

4. **Produção**:
   - Configurar HTTPS
   - Adicionar Helmet.js para security headers
   - Configurar variáveis de ambiente de produção
   - Configurar PM2 ou Docker

---

## 📞 Suporte

Se houver problemas:
1. Verifique se MySQL está rodando no XAMPP
2. Execute as migrações na ordem correta
3. Verifique os logs do backend (terminal)
4. Verifique o console do navegador (F12)
5. Confirme que as portas 5000 e 5173 estão livres

---
*Documento gerado automaticamente após auditoria e correção completa do projeto SENAI Connect*