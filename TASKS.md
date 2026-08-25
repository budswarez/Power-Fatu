# TASKS — Histórico de desenvolvimento Power Fatu

Registro cronológico das funcionalidades implementadas e decisões tomadas durante o desenvolvimento.

---

## Concluído

### v1.0 — Base + Firebase
- [x] Scaffold Next.js 16 App Router com Tailwind CSS v4
- [x] Integração Firebase Client SDK (Auth + Firestore)
- [x] Design system dark glassmorphism (`globals.css`, tokens CSS)
- [x] Layout responsivo com Sidebar + AppShell (route guard RBAC)
- [x] Autenticação Email/Password (Firebase Auth)
- [x] Tela de login (`/login`)
- [x] Tela de setup primeiro admin (`/setup`) com sentinel `settings/initialized`
- [x] Context de autenticação (`auth-context.tsx`) com `useAuth()`
- [x] Perfis: `user`, `gerente`, `admin` com controle por rota

### v1.1 — Dashboard e projeção
- [x] Dashboard (`/`) com KPIs: acumulado, projeção, ticket médio
- [x] Barra de progresso vs meta mensal
- [x] Gráfico cumulativo por canal (Recharts)
- [x] Gráfico diário por canal (Recharts)
- [x] Motor de projeção com sazonalidade (`prediction-engine.ts`)
  - Calcula peso sazonal dia-a-dia comparando mês atual vs histórico
  - Retorna `totalProjectedRevenue`, `confidence`, `lowerBound`, `upperBound`
- [x] Meta mensal armazenada no Firestore (`settings/global.revenue_target`)

### v1.2 — Gestão de dados
- [x] Tela Mês Atual (`/current`) — lançamento diário por canal (criar/editar/excluir)
- [x] Tela Dados Históricos (`/historical`) — cadastro manual + importação CSV
  - Parsing client-side de CSV com preview antes de salvar
  - Suporte a drag-and-drop no input de arquivo
- [x] Tela Canais de Venda (`/channels`) — CRUD com nome e cor personalizáveis
- [x] Tela Configurações (`/settings`) — meta de faturamento (Firestore)

### v1.3 — Gestão de usuários
- [x] Tela Usuários (`/users`) — listagem, criação, edição completa e exclusão
- [x] Criação via secondary Firebase app (sem deslogar o admin)
- [x] Edição completa: nome, e-mail, senha, perfil
  - Campos de auth (email, senha) via Firebase Admin SDK (`PATCH /api/users/[uid]`)
  - Campos Firestore (name, role) via `updateDoc`
- [x] Exclusão com Firebase Auth via Admin SDK (`DELETE /api/users/[uid]`)
- [x] API Route `src/app/api/users/[uid]/route.ts` com verificação Bearer token + role admin

### v1.4 — Responsividade mobile
- [x] Mobile header fixo com hambúrguer + logo Power Fatu (`md:hidden`)
- [x] Sidebar como drawer overlay deslizante no mobile (z-40, backdrop z-30)
- [x] Viewport configurado: `maximumScale: 1` (previne zoom em inputs iOS)
- [x] Grids colapsam para 1 coluna no mobile (`grid-cols-1 sm:grid-cols-N`)
- [x] Tabelas com `overflow-x-auto` e padding reduzido no mobile
- [x] Coluna "Pedidos" ocultada no mobile (`hidden sm:table-cell`)
- [x] Formatter compacto `fmtCompact()` — ex: `R$ 1,1Mi`, `R$ 800Mil`, `R$ 1,5Mil`
  - Mobile mostra compacto; desktop mostra `fmt()` completo (BRL)
- [x] Formulários de lançamento em coluna única no mobile
- [x] Botões de ação `flex-1` (full-width) no mobile

### v1.5 — Segurança (Firestore Rules)
- [x] Regras declarativas RBAC no `firestore.rules`
- [x] `settings/initialized` público para leitura (setup sem auth)
- [x] `users/{uid}` — get: próprio ou admin; list/update/delete: admin
- [x] `channels` — read: autenticado; write: admin
- [x] `sales` — read: autenticado; write: gerente ou admin
- [x] `settings` — read: autenticado; write: admin

---

## Backlog / Melhorias futuras

- [ ] Exportar relatório PDF/Excel do dashboard
- [ ] Notificações quando projeção estiver abaixo/acima da meta
- [ ] Histórico de alterações (audit log) por usuário
- [ ] Suporte a múltiplos meses simultâneos no gráfico histórico
- [ ] Filtro por canal nos gráficos do dashboard
- [ ] Dark/light mode toggle
- [ ] Internacionalização (i18n) — estrutura já permite, só falta extrair strings
- [ ] Testes automatizados (Jest + Testing Library)

---

## Bugs conhecidos / resolvidos

| Bug | Status | Resolução |
|-----|--------|-----------|
| Recharts `width/height = -1` no carregamento inicial | Resolvido | Verificação `if (w > 0 && h > 0)` antes de renderizar |
| `AbortError` unhandledRejection em cleanup de listeners Firestore | Resolvido | `useEffect` cleanup com flag `active` |
| Password field sem estilo glassmorphism | Resolvido | Adicionado `input[type="password"]` ao selector em `globals.css` |
| Criação de usuário deslogava o admin | Resolvido | `createSecondaryApp()` — instância Firebase separada |
| Exclusão de usuário não removia do Firebase Auth | Resolvido | API Route com Firebase Admin SDK |
| Tabelas overflow no mobile | Resolvido | `overflow-x-auto` + `fmtCompact` + colunas ocultadas |
