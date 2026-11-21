# ✅ DESIGN SYSTEM — CHECKLIST DE IMPLEMENTAÇÃO

## 📋 Resumo das Alterações

| Arquivo | Status | Descrição |
|---------|--------|-----------|
| `frontend/src/styles/tokens.css` | **NOVO** | Design tokens centralizados (cores, espaçamento, tipografia, sombras, radius, z-index, touch targets, breakpoints, dark mode) |
| `frontend/src/index.css` | **ATUALIZADO** | Import `@import './styles/tokens.css';` adicionado |
| `frontend/src/pages/Admin/AdminLogin.jsx` | **REESCRITO** | Acessibilidade completa, validação inline, UX minimalista |
| `frontend/src/pages/Admin/AdminLogin.css` | **REESCRITO** | Design tokens aplicados, responsivo, motion reduction, high contrast |
| `frontend/src/pages/Auth/Auth.jsx` | **REESCRITO** | Login/Registro unificado, validação inline, mesmos padrões |
| `frontend/src/pages/Auth/Auth.css` | **REESCRITO** | Herda tokens, overrides mínimos, success states |
| `frontend/src/pages/Auth/ForgotPassword.jsx` | **REESCRITO** | Mesma estrutura, validação, success state acessível |
| `frontend/src/pages/Auth/ResetPassword.jsx` | **REESCRITO** | Confirmação de senha, toggle visibilidade, success state |

---

## ✅ CHECKLIST DE VALIDAÇÃO VISUAL

### Admin Login (`/admin/login`)
- [ ] Card centralizado, sombra `--shadow-lg`, borda 1px `var(--color-neutral-100)`
- [ ] Ícone Shield 28px em círculo 56px com bg `var(--color-primary-50)`
- [ ] Título "SENAI Connect" 24px bold (`--text-xl`), subtítulo 14px (`--text-sm`)
- [ ] Inputs 44px (`--touch-target`), padding lateral 16px, ícone 20px alinhado
- [ ] Placeholder cinza (`--color-text-muted`), label 14px medium
- [ ] Focus: borda azul (`--color-border-focus`) + ring 3px `--shadow-focus`
- [ ] Erro: borda vermelha + bg rosa + ícone erro + texto vermelho 12px
- [ ] Toggle senha: 44x44px, `aria-label`, `aria-pressed`, focus visível
- [ ] Hint "Sua senha está visível" ao mostrar
- [ ] Botão: 44px, azul primary, hover `--color-primary-hover`, loading spinner
- [ ] Link "Esqueci minha senha" alinhado à direita do label
- [ ] Footer "Solicite ao administrador" com link
- [ ] Mobile ≤480px: card full-width, padding 24px/16px, título 18px

### Login/Registro (`/login`, `/register`)
- [ ] Mesmo layout do Admin Login
- [ ] Registro: campo Nome Completo com ícone User
- [ ] Hint fixo "Use @estudante.senai.com ou @docente.senai.com"
- [ ] Alternância Login/Registro no footer (botão styled)
- [ ] Validação nome ≥2 chars, e-mail formato, senha ≥6 chars

### Esqueci Senha (`/forgot-password`)
- [ ] Header "Recuperar Senha" com descrição
- [ ] Success state: ícone check 64px verde, texto confirmando e-mail
- [ ] Botão "Voltar ao Login" primary full-width
- [ ] Footer "Voltar para o Login" com ícone ArrowLeft

### Redefinir Senha (`/reset-password?token=...`)
- [ ] Header "Criar Nova Senha" / "Senha Redefinida!"
- [ ] Dois campos: Nova Senha + Confirmar (toggle compartilhado)
- [ ] Validação coincidência em tempo real
- [ ] Success state idêntico ao forgot-password
- [ ] Botão "Fazer Login" navega para `/login`

---

## ♿ CHECKLIST DE ACESSIBILIDADE (WCAG AA)

| Critério | Implementado |
|----------|--------------|
| Labels associadas (`htmlFor` + `id`) | ✅ Todos inputs |
| `aria-invalid` + `aria-describedby` | ✅ Erros e hints |
| `role="alert"` + `aria-live="polite"` | ✅ Alertas globais e de campo |
| Focus visível (`:focus-visible`) | ✅ Inputs, botões, toggles, links |
| Touch target mínimo 44x44px | ✅ Inputs, botões, toggles |
| `aria-label` / `aria-pressed` no toggle | ✅ Mostrar/ocultar senha |
| `aria-busy` no submit loading | ✅ Botões de submit |
| `prefers-reduced-motion` | ✅ Transições/animações desabilitadas |
| `forced-colors` (Windows High Contrast) | ✅ Bordas, backgrounds, focus |
| Navegação por Tab ordenada | ✅ Header → fields → btn → footer |
| Autofoco no primeiro campo | ✅ `useRef` + `useEffect` |
| Autofoco no erro global | ✅ `errorRef` + `tabIndex=-1` |

---

## 🎨 DESIGN TOKENS APLICADOS

### Espaçamento (base 4px)
```css
--space-1: 4px   /* gap ícone-input */
--space-2: 8px   /* gap label-link */
--space-3: 12px  /* gap alert icon-text */
--space-4: 16px  /* gap form fields, padding input */
--space-5: 20px  /* padding btn horizontal */
--space-6: 24px  /* margin header/footer */
--space-8: 32px  /* padding card */
```

### Tipografia
```css
--text-xs: 12px   /* erros, hints */
--text-sm: 14px   /* labels, links, subtitle */
--text-base: 16px /* inputs, botões */
--text-lg: 18px   /* título mobile */
--text-xl: 24px   /* título desktop */
--font-medium: 500
--font-semibold: 600
--font-bold: 700
```

### Cores Semânticas
```css
/* Primary */
--color-primary: var(--color-blue-600)      /* #2563eb */
--color-primary-hover: var(--color-blue-700) /* #1d4ed8 */
--color-primary-light: var(--color-blue-50)  /* #eff6ff */

/* Error */
--color-error: var(--color-red-600)         /* #dc2626 */
--color-error-light: var(--color-red-50)    /* #fef2f2 */
--color-error-border: var(--color-red-200)  /* #fecaca */

/* Neutral */
--color-bg: var(--color-gray-50)            /* #f9fafb */
--color-bg-card: #fff
--color-text-primary: var(--color-gray-900) /* #111827 */
--color-text-secondary: var(--color-gray-600) /* #4b5563 */
--color-text-muted: var(--color-gray-400)   /* #9ca3af */
--color-border: var(--color-gray-200)       /* #e5e7eb */
```

### Radius & Shadows
```css
--radius-sm: 4px    /* toggle btn */
--radius-md: 8px    /* inputs, btns, alerts, card brand */
--radius-lg: 12px   /* card container */

--shadow-lg: 0 10px 15px -3px rgba(0,0,0,.1)  /* card */
--shadow-focus: 0 0 0 3px var(--color-blue-100) /* focus ring */
```

### Touch Targets
```css
--touch-target: 44px      /* inputs, btns, toggle */
--touch-target-sm: 36px   /* futuro uso */
```

---

## 🔄 PRÓXIMOS PASSOS PRIORITÁRIOS

### 1. Componentes Base Reutilizáveis (Prioridade Alta)
Criar em `frontend/src/components/ui/`:

| Componente | Props Principais | Baseado em |
|------------|------------------|------------|
| `Input` | `label`, `error`, `hint`, `icon`, `type`, `showPassword` | `form-field` + `input-wrapper` |
| `Button` | `variant` (primary/secondary/ghost), `size`, `loading`, `fullWidth` | `.btn` + `.btn--primary` |
| `Card` | `padding`, `elevation`, `bordered` | `.login-card` / `.auth-card` |
| `Alert` | `variant` (error/success/warning/info), `dismissible` | `.login-alert` |
| `Link` | `variant` (inline/standalone), `icon`, `iconPosition` | `.form-link`, `.auth-switch-btn` |
| `Spinner` | `size` (sm/md/lg), `color` | `.btn-spinner` |

### 2. Migrar Outras Telas (Prioridade Média)
Aplicar tokens nas páginas existentes:

| Tela | Arquivo | Tokens a Aplicar |
|------|---------|------------------|
| Settings | `Settings.jsx/css` | spacing, typography, inputs, buttons |
| Profile | `Profile.jsx/css` | card, avatar, buttons |
| Admin Dashboard | `Dashboard.jsx/css` | cards, stats, charts container |
| Admin Notices | `AdminNoticesList.jsx/css` | table, buttons, modal |
| Business Dashboard | `BusinessDashboard*.jsx` | sidebar, cards, forms |

### 3. Theme Provider + Dark Mode (Prioridade Média)
```jsx
// context/ThemeContext.jsx
// - Toggle no header
// - Persist localStorage
// - Aplicar [data-theme="dark"] no html
// - Tokens dark mode já definidos em tokens.css
```

### 4. Utilitários CSS Globais (Prioridade Baixa)
Adicionar em `tokens.css` ou arquivo separado:
```css
/* Spacing utilities */
.p-4 { padding: var(--space-4); }
.mt-6 { margin-top: var(--space-6); }
.gap-4 { gap: var(--space-4); }

/* Typography */
.text-sm { font-size: var(--text-sm); }
.font-semibold { font-weight: var(--font-semibold); }
.text-primary { color: var(--color-text-primary); }

/* Radius */
.rounded { border-radius: var(--radius-md); }

/* Shadows */
.shadow-lg { box-shadow: var(--shadow-lg); }
```

### 5. Storybook / Documentação Visual (Prioridade Baixa)
- Configurar Storybook
- Documentar cada componente com props
- Exemplos de uso (login, form, modal, toast)

---

## 🧪 TESTES RECOMENDADOS

### Visual Regression
```bash
# Chromatic / Percy / Playwright visual tests
# Testar: desktop 1440px, tablet 768px, mobile 375px/320px
# Estados: default, hover, focus, error, loading, disabled, success
```

### Acessibilidade Automatizada
```bash
# axe-core / jest-axe
npm test -- --testPathPattern=accessibility
# Verificar: contraste, labels, ARIA, focus order, landmarks
```

### Navegação por Teclado
- [ ] Tab percorre: brand → título → campos → toggle → botão → footer links
- [ ] Shift+Tab ordem reversa
- [ ] Enter no botão submete
- [ ] Espaço no toggle alterna
- [ ] Escape fecha alertas (futuro)

### Leitores de Tela (NVDA / VoiceOver)
- [ ] Labels anunciados corretamente
- [ ] Erros anunciados via `aria-live`
- [ ] Estado loading anunciado (`aria-busy`)
- [ ] Toggle anuncia "pressionado/não pressionado"

---

## 📁 ESTRUTURA FINAL SUGERIDA

```
frontend/src/
├── styles/
│   ├── tokens.css          # ✅ Design tokens centralizados
│   ├── globals.css         # Reset, base, utilitários
│   └── themes.css          # Dark mode, brand overrides
├── components/ui/          # 🔄 Criar componentes base
│   ├── Input/
│   ├── Button/
│   ├── Card/
│   ├── Alert/
│   ├── Link/
│   ├── Spinner/
│   └── index.js            # Barrel exports
├── context/
│   ├── AuthContext.jsx
│   ├── SocketContext.jsx
│   └── ThemeContext.jsx    # 🔄 Novo
├── pages/
│   ├── Admin/
│   │   ├── AdminLogin.jsx  # ✅ Atualizado
│   │   └── AdminLogin.css  # ✅ Atualizado
│   ├── Auth/
│   │   ├── Auth.jsx        # ✅ Atualizado
│   │   ├── Auth.css        # ✅ Atualizado
│   │   ├── ForgotPassword.jsx  # ✅ Atualizado
│   │   └── ResetPassword.jsx   # ✅ Atualizado
│   └── ...
└── main.jsx                # Providers: Auth, Socket, Theme
```

---

## ✅ STATUS FINAL

| Categoria | Concluído | Pendente |
|-----------|-----------|----------|
| Design Tokens | ✅ 100% | - |
| Admin Login | ✅ 100% | - |
| Auth Pages (4) | ✅ 100% | - |
| Acessibilidade | ✅ WCAG AA | Testes manuais |
| Responsividade | ✅ 320-1440px | - |
| Dark Mode Tokens | ✅ Definidos | Provider + Toggle |
| Componentes Base | 0% | 6 componentes |
| Migração Telas | 0% | ~15 telas |
| Documentação | ✅ Checklist | Storybook |

**Próxima ação recomendada**: Criar `Input` e `Button` como componentes base reutilizáveis, depois migrar `Settings` e `AdminDashboard` como prova de conceito.