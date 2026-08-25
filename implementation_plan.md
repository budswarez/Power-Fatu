# Plano de Implementação — Power Fatu

Este documento registra as decisões arquiteturais, o modelo de dados e as escolhas técnicas feitas durante o desenvolvimento da plataforma.

---

## 1. Stack tecnológica

- **Next.js 16 App Router** — SSR/SSG + Route Handlers para APIs server-side
- **React 19 + Tailwind CSS v4** — UI declarativa com design system por tokens CSS
- **Recharts 3** — gráficos de linha responsivos
- **Firebase Authentication** — Email/Password; secondary app para criar usuários sem deslogar admin
- **Cloud Firestore** — banco NoSQL em tempo real para canais, vendas, usuários e configurações
- **Firebase Admin SDK 13** — operações privilegiadas server-side (deletar/atualizar usuários no Firebase Auth)
- **Vercel** — deploy com variáveis de ambiente criptografadas

---

## 2. Modelo de dados (Firestore)

### `channels/{id}`
```
name:       string
color:      string  (hex, ex: #3b82f6)
created_at: Timestamp
```

### `sales/{id}`
```
channel_id:  string  (ref para channels/{id})
date:        Timestamp
amount:      number  (faturamento em BRL)
order_count: number  (pedidos — opcional)
```
Usado tanto para dados históricos quanto para o mês atual. A distinção é feita por data.

### `users/{uid}`
```
email:      string
name:       string
role:       "user" | "gerente" | "admin"
created_at: Timestamp
```
O `uid` do documento coincide com o UID do Firebase Authentication.

### `settings/initialized`
```
at: Timestamp
```
Sentinel de primeiro uso. Lido publicamente (sem auth) para detectar se o `/setup` já foi executado.

### `settings/global`
```
revenue_target: number  (meta mensal em BRL)
```

---

## 3. Autenticação e RBAC

**Fluxo de autenticação:**
1. `onAuthStateChanged` → busca `users/{uid}` no Firestore
2. Se doc não existe → `user = null` → AppShell exibe "Sem acesso"
3. Se Firebase user não existe → redireciona para `/login`
4. Perfil carregado → `UserProfile` disponível via `useAuth()`

**Route guard (AppShell):**
- Rotas públicas: `/login`, `/setup`
- `ROLE_REQUIREMENTS` define o prefixo de rota e roles permitidos
- Usuário sem acesso à rota → redireciona para `/`

**Criação de usuários pelo admin:**
- Usa `createSecondaryApp()` (nova instância Firebase) para criar no Auth sem deslogar o admin
- Após criação: `setDoc(users/{uid})` + `signOut(secondaryAuth)` + `deleteApp(secondaryApp)`

**Exclusão/edição de usuários:**
- Operações no Firebase Auth requerem Admin SDK (server-side)
- API Route `DELETE /api/users/[uid]` e `PATCH /api/users/[uid]`
- Ambas verificam Bearer token + role `admin` antes de executar

---

## 4. Motor de projeção (`prediction-engine.ts`)

Algoritmo de extrapolação sazonal:

1. Calcula o acumulado atual até o dia N do mês
2. Compara com o histórico do mesmo período do mês de referência
3. Aplica o peso sazonal (razão histórica dia-a-dia) para projetar o restante do mês
4. Retorna: `totalProjectedRevenue`, `confidence`, `lowerBound`, `upperBound`, `channels[]`

O "intervalo de confiança" é calculado com base na variância dos dados históricos disponíveis.

---

## 5. Arquitetura de layout responsivo

### Desktop (≥ 768px)
```
body (flex row)
├── Sidebar (fixed, 260px, always visible)
└── div (flex-1, ml-[260px])
    └── main (p-8)
        └── page content
```

### Mobile (< 768px)
```
body (flex row)
├── Sidebar (fixed, z-40, -translate-x-full → translate-x-0 via estado)
├── backdrop overlay (fixed, z-30, bg-black/60)
└── div (flex-1, flex-col, sem ml)
    ├── header (sticky, z-20 — hambúrguer + logo Power Fatu)
    └── main (p-4)
        └── page content
```

---

## 6. Decisões e trade-offs

| Decisão | Alternativa considerada | Motivo da escolha |
|---------|------------------------|-------------------|
| Firestore client-side | API REST própria | Menos código, tempo real grátis, regras de segurança declarativas |
| Secondary Firebase app para criar usuários | Admin SDK via API Route | Evita round-trip server; mantém a UX síncrona no formulário |
| Firebase Admin SDK lazy init | Init no module load | Evita erros em build time quando env vars não estão disponíveis |
| `fmtCompact()` separado de `fmt()` | Sempre usar formato completo | Tabelas mobile precisam de valores curtos; dashboards mantêm o formato BRL completo |
| Regras Firestore declarativas | Validação só no servidor | Segurança em múltiplas camadas; sem depender apenas da API |
| `viewport.maximumScale = 1` no layout | Deixar o browser escalar | Previne zoom acidental em inputs no iOS que quebraria o layout |

---

## 7. Variáveis de ambiente necessárias

### Client (Next.js / browser)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Server (Route Handlers / Admin SDK)
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY` — chave PEM com `\n` como escape literal na string

> Na Vercel, configurar como tipo **Encrypted**. Após adicionar, sempre fazer redeploy (`vercel --prod`) para ativar.

---

## 8. Regras de segurança Firestore

```
/settings/initialized  → read: público; write: autenticado
/users/{uid}           → get: próprio ou admin; list: admin; create: próprio ou admin; update/delete: admin
/channels/{id}         → read: autenticado; write: admin
/sales/{id}            → read: autenticado; write: gerente ou admin
/settings/{id}         → read: autenticado; write: admin
```

Deploy: `firebase deploy --only firestore:rules --project <project-id>`
