# Power Fatu — Projeção de Faturamento

Plataforma web da **Sua Empresa** para análise preditiva de faturamento multicanal com motor de sazonalidade. Permite registrar vendas históricas e do mês atual, calcular projeções de encerramento do mês e acompanhar o desempenho por canal em tempo real.

## Snapshots

> Pré-visualizações visuais do produto para documentação. O dashboard real exige autenticação Firebase configurada.

### Dashboard de faturamento

![Dashboard do Power Fatu](assets/screenshots/dashboard.png)

### Tela de login

![Login do Power Fatu](assets/screenshots/login-v2.png)

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| Gráficos | Recharts 3 |
| Ícones | Lucide React |
| Autenticação | Firebase Authentication (Email/Password) |
| Banco de dados | Cloud Firestore |
| API server-side | Next.js Route Handlers + Firebase Admin SDK 13 |
| Deploy | Vercel |

---

## Funcionalidades

| Tela | Role mínimo | Descrição |
|------|:-----------:|-----------|
| Dashboard | `user` | KPIs do mês (acumulado, projeção, ticket médio), progresso vs meta, gráfico cumulativo por canal, gráfico diário por canal |
| Dados Históricos | `gerente` | Cadastro manual e importação via CSV de vendas de meses anteriores |
| Mês Atual | `gerente` | Lançamento diário de vendas por canal com edição e exclusão |
| Canais de Venda | `admin` | Cadastro de canais com nome e cor personalizáveis |
| Configurações | `admin` | Meta de faturamento mensal global (Firestore) |
| Usuários | `admin` | Criar, editar (nome, e-mail, senha, perfil) e excluir usuários |

---

## Estrutura do projeto

```
src/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── layout.tsx                  # Root layout + viewport + AuthProvider + AppShell
│   ├── globals.css                 # Design system (dark glassmorphism, tokens CSS)
│   ├── login/page.tsx              # Tela de login
│   ├── setup/page.tsx              # Criação do primeiro admin
│   ├── historical/page.tsx         # Dados históricos (manual + CSV)
│   ├── current/page.tsx            # Mês atual
│   ├── channels/page.tsx           # Canais de venda
│   ├── settings/page.tsx           # Configurações
│   ├── users/page.tsx              # Gestão de usuários
│   └── api/
│       └── users/[uid]/route.ts    # PATCH + DELETE via Firebase Admin
├── components/
│   ├── app-shell.tsx               # Route guard RBAC + layout responsivo + drawer mobile
│   └── sidebar.tsx                 # Navegação lateral role-based + slide-in mobile
└── lib/
    ├── firebase.ts                 # Firebase client SDK + createSecondaryApp
    ├── firebase-admin.ts           # Firebase Admin SDK (lazy init)
    ├── auth-context.tsx            # AuthProvider + useAuth hook
    ├── format.ts                   # fmt(), fmtCompact(), helpers de canal
    ├── prediction-engine.ts        # Motor de projeção com sazonalidade
    └── types.ts                    # Tipos compartilhados (Role, UserProfile, etc.)

firestore.rules                     # Regras de segurança Firestore (RBAC)
```

---

## Roles e permissões

| Role | Dashboard | Histórico | Mês Atual | Canais | Config | Usuários |
|------|:---------:|:---------:|:---------:|:------:|:------:|:--------:|
| `user` | ✓ | — | — | — | — | — |
| `gerente` | ✓ | ✓ | ✓ | — | — | — |
| `admin` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Configuração local

### Pré-requisitos
- Node.js 18+
- Projeto Firebase com **Authentication (Email/Password)** e **Firestore** habilitados
- Conta de serviço Firebase Admin para as variáveis server-side

### Variáveis de ambiente — `.env.local`

```env
# Firebase Client SDK (público — prefixo NEXT_PUBLIC_)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (server-side — nunca expor ao cliente)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> A `FIREBASE_ADMIN_PRIVATE_KEY` deve ter as quebras de linha como `\n` literais (em aspas duplas) no arquivo `.env.local`. O código faz o replace automaticamente.

### Instalação e execução

```bash
git clone https://github.com/budswarez/Power-Fatu.git
cd Power-Fatu
npm install
npm run dev        # http://localhost:3000
npm run build      # build de produção
```

### Primeiro acesso

1. Acesse `/setup` — cria o administrador inicial
2. Após criado, redireciona automaticamente para `/`
3. Em **Usuários**, crie os demais usuários com os perfis adequados

### Regras do Firestore

```bash
firebase deploy --only firestore:rules --project <project-id>
```

---

## Deploy (Vercel)

Configure as variáveis `FIREBASE_ADMIN_*` como **Encrypted** nas Environment Variables do projeto na Vercel. Após adicioná-las, faça um novo deploy para ativá-las:

```bash
vercel --prod
```

O projeto também contém configuração para Firebase App Hosting em `apphosting.yaml`. Se esse for o destino escolhido, mantenha as variáveis públicas no arquivo de configuração e armazene as credenciais do Firebase Admin no Secret Manager.

## Segurança

- As variáveis `NEXT_PUBLIC_FIREBASE_*` são configurações públicas do cliente; as credenciais `FIREBASE_ADMIN_*` são exclusivamente server-side.
- Nunca faça commit de `FIREBASE_ADMIN_PRIVATE_KEY`, arquivos JSON de conta de serviço ou `.env.local`.
- Mantenha as regras RBAC em `firestore.rules` e publique-as com `firebase deploy --only firestore:rules`.
- Revise as regras e indexes no ambiente de produção antes do primeiro uso.

## Scripts

| Comando | Finalidade |
|---|---|
| `npm run dev` | Servidor Next.js local na porta 3000. |
| `npm run build` | Type-check e build de produção. |
| `npm run start` | Executa o build em modo produção. |
| `npm run lint` | Executa o ESLint. |
| `npm test` | Executa os testes Jest. |

---

## Design system

A aplicação usa um tema escuro glassmorphism definido em `globals.css` com tokens CSS (`--bg-primary`, `--accent-blue`, etc.). Componentes principais:

- `.glass-card` — card com backdrop-filter e borda sutil
- `.btn-primary` / `.btn-ghost` / `.btn-danger` — botões padronizados
- `.sidebar-link` / `.sidebar-link.active` — links da navegação lateral
- `.animate-in` + `.delay-N` — animações de entrada fadeInUp

### Responsividade

- **Mobile** (`< 768px`): header fixo com hambúrguer, sidebar como drawer overlay, grids colapsam para 1 coluna, tabelas com valores compactos (`fmtCompact`)
- **Desktop** (`≥ 768px`): sidebar fixa lateral de 260px, padding `p-8`, valores completos nas tabelas
