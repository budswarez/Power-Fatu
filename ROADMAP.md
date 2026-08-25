# ROADMAP — Melhorias futuras Power Fatu

Análise técnica e roteiro de implementação para cada item do backlog.
Ordenados por impacto × esforço.

---

## Sumário de prioridades

| # | Feature | Impacto | Esforço | Prioridade |
|---|---------|:-------:|:-------:|:----------:|
| 1 | Filtro por canal nos gráficos | Alto | P | **P1** |
| 2 | Notificações de projeção | Alto | M | **P1** |
| 3 | Múltiplos meses no gráfico histórico | Médio | M | **P2** |
| 4 | Exportar PDF/Excel | Médio | M | **P2** |
| 5 | Dark/light mode toggle | Baixo | M | **P3** |
| 6 | Histórico de alterações (audit log) | Médio | G | **P3** |
| 7 | i18n | Baixo | G | **P4** |
| 8 | Testes automatizados | Alto (long-term) | G | **P4** |

Legenda: P = Pequeno (<1 dia) · M = Médio (1–3 dias) · G = Grande (3+ dias)

---

## 1. Filtro por canal nos gráficos do dashboard

### Análise
O dashboard já renderiza dois gráficos Recharts (cumulativo e diário) com todas as linhas
de todos os canais sobrepostas. Com muitos canais, o gráfico fica poluído e ilegível.
O filtro precisa de estado local (não persiste no servidor) e interação imediata.

### Abordagem
Adicionar um grupo de toggles abaixo de cada gráfico. Cada toggle corresponde a um
canal (exibe a cor do canal). Clicar desativa/ativa a linha no gráfico.
Estado: `Set<string>` de IDs ativos, inicializado com todos os canais.

### Arquivos afetados
- `src/app/page.tsx` — único arquivo a modificar

### Roteiro

```
1. Adicionar estado:
   const [activeChannels, setActiveChannels] = useState<Set<string>>(new Set())
   // useEffect: quando channels carrega, inicializar com todos os IDs

2. Criar componente inline ChannelToggle:
   <button
     onClick={() => toggle(channel.id)}
     className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border
       transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`}
     style={{ borderColor: channel.color, color: channel.color }}
   >
     <span className="w-2 h-2 rounded-full" style={{ background: channel.color }} />
     {channel.name}
   </button>

3. Filtrar os dados passados ao Recharts:
   // Antes de passar para o gráfico, mapear os dados e definir
   // como undefined os valores de canais desativados
   // (Recharts omite pontos undefined automaticamente)

4. Adicionar botão "Todos / Nenhum" para reset rápido.

5. Repetir para o gráfico diário (estado separado ou compartilhado).
```

### Notas
- Não requer nova dependência.
- Estado reset ao navegar entre páginas (comportamento esperado).

---

## 2. Notificações quando projeção estiver abaixo/acima da meta

### Análise
Existem dois níveis de notificação possíveis:
- **In-app (banner/toast):** simples, sem infra extra. Mostra alerta na própria tela.
- **Push/e-mail:** requer Firebase Cloud Messaging (FCM) ou Firebase Extensions.

Recomendado: implementar in-app primeiro; push como fase 2 opcional.

### Abordagem — In-app
Calcular o desvio percentual `(projecao - meta) / meta * 100` no dashboard.
Exibir um banner fixo abaixo dos KPIs quando `|desvio| > threshold` (ex: 10%).

Variantes:
- `desvio < -10%` → banner vermelho "Projeção abaixo da meta em X%"
- `desvio > +10%` → banner verde "Projeção acima da meta em X%"
- `|desvio| <= 10%` → nenhum banner

Threshold configurável em `settings/global.alert_threshold` (Firestore).

### Arquivos afetados
- `src/app/page.tsx` — adicionar lógica de banner
- `src/app/settings/page.tsx` — campo "Threshold de alerta (%)"
- `src/lib/types.ts` — adicionar `alert_threshold?: number` no tipo GlobalSettings
- `firestore.rules` — nenhuma alteração (settings já coberto)

### Roteiro

```
1. src/lib/types.ts
   Adicionar ao tipo de settings:
   alert_threshold: number  // padrão: 10 (%)

2. src/app/settings/page.tsx
   Adicionar campo numérico "Threshold de alerta (%)" ao formulário,
   salvo junto com revenue_target.

3. src/app/page.tsx
   // Após calcular projection:
   const desvio = revenue_target > 0
     ? ((projection.totalProjectedRevenue - revenue_target) / revenue_target) * 100
     : null;
   const threshold = globalSettings?.alert_threshold ?? 10;

   // Renderizar banner:
   {desvio !== null && Math.abs(desvio) > threshold && (
     <div className={`glass-card px-4 py-3 flex items-center gap-3 border
       ${desvio < 0 ? 'border-[var(--accent-rose)]' : 'border-[var(--accent-green)]'}`}>
       <AlertCircle className="w-4 h-4 flex-shrink-0" />
       <span className="text-sm">
         Projeção {desvio < 0 ? 'abaixo' : 'acima'} da meta em {Math.abs(desvio).toFixed(1)}%
       </span>
     </div>
   )}
```

### Fase 2 — Notificações por e-mail (opcional, futuro)
Usar **Firebase Extension: Trigger Email** + Firestore collection `mail/{id}`.
Uma Cloud Function (ou cron via Cloud Scheduler) verificaria diariamente se a
projeção está fora do threshold e gravaria um doc em `mail/{id}` para disparo.

---

## 3. Suporte a múltiplos meses simultâneos no gráfico histórico

### Análise
A tela `/historical` hoje exibe uma tabela de vendas de um mês selecionado.
O gráfico evolutivo no dashboard compara mês atual vs. um único mês de referência.
A melhoria: permitir selecionar N meses e sobrepor as curvas num único gráfico
para análise de tendência multi-período.

### Abordagem
Criar uma nova seção na tela `/historical` (ou uma tab "Comparativo") com:
- Multi-select de meses (checkboxes com label "Jan/2025", "Fev/2025" etc.)
- Gráfico de linhas Recharts com uma série por mês selecionado
- Cada série: eixo X = dia do mês (1–31), eixo Y = faturamento acumulado ou diário

### Arquivos afetados
- `src/app/historical/page.tsx` — nova seção de comparativo
- `src/lib/types.ts` — nenhum novo tipo necessário (já existe `SalesRecord`)

### Roteiro

```
1. Buscar todos os meses disponíveis no Firestore:
   // Agrupar sales por (month, year) para montar a lista de seleção
   const availableMonths = useMemo(() => {
     const seen = new Set<string>();
     return historicalSales
       .map(s => ({ key: `${s.year}-${s.month}`, label: `${MONTH_NAMES[s.month-1]}/${s.year}` }))
       .filter(m => !seen.has(m.key) && seen.add(m.key));
   }, [historicalSales]);

2. Estado de seleção:
   const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
   // Limitar a 6 meses simultâneos para legibilidade

3. Construir dados para o gráfico:
   // Para cada dia 1-31, criar um ponto com valores de cada mês selecionado
   type DataPoint = { day: number } & Record<string, number>;
   const chartData: DataPoint[] = Array.from({ length: 31 }, (_, i) => {
     const day = i + 1;
     const point: DataPoint = { day };
     for (const monthKey of selectedMonths) {
       const [year, month] = monthKey.split('-').map(Number);
       point[monthKey] = historicalSales
         .filter(s => s.year === year && s.month === month && s.day <= day)
         .reduce((sum, s) => sum + s.amount, 0);
     }
     return point;
   });

4. Renderizar gráfico:
   <LineChart data={chartData}>
     {selectedMonths.map((key, i) => (
       <Line key={key} dataKey={key} name={labels[key]} stroke={PALETTE[i]} dot={false} />
     ))}
   </LineChart>

5. Paleta de 6 cores fixas para as séries (distintas dos canais).
```

---

## 4. Exportar relatório PDF/Excel

### Análise
Dois formatos com propósitos distintos:
- **Excel (.xlsx):** dados brutos para análise; útil para gerentes
- **PDF:** snapshot visual do dashboard; útil para apresentações

### Abordagem

**Excel** — usar biblioteca `xlsx` (SheetJS, ~200 KB gzip):
- Exporta os dados tabulares de vendas (canais, datas, valores, pedidos)
- Adiciona uma aba "Projeção" com os KPIs calculados
- Não requer servidor — geração 100% client-side

**PDF** — usar `jsPDF` + `html2canvas` (~300 KB gzip):
- Captura o DOM do dashboard via html2canvas
- Converte para PDF via jsPDF
- Alternativa mais leve: gerar PDF com layout próprio em jsPDF (sem captura de tela)

### Dependências
```bash
npm install xlsx jspdf html2canvas
```

### Arquivos afetados
- `src/lib/export.ts` — novo módulo de exportação
- `src/app/page.tsx` — botão "Exportar" no header do dashboard
- `src/app/historical/page.tsx` — botão "Exportar" na tabela de histórico

### Roteiro

```
1. src/lib/export.ts

   // === EXCEL ===
   export function exportToExcel(
     sales: DailySale[],
     channels: SalesChannel[],
     projection: ConsolidatedProjection,
     month: string  // "Março 2025"
   ) {
     const wb = XLSX.utils.book_new();

     // Aba 1: Vendas brutas
     const rows = sales.map(s => ({
       Data: formatDate(s.date),
       Canal: getChannelName(channels, s.channel_id),
       Faturamento: s.amount,
       Pedidos: s.order_count ?? '',
     }));
     XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Vendas');

     // Aba 2: Projeção
     const proj = [
       { Métrica: 'Acumulado', Valor: projection.totalCurrentRevenue },
       { Métrica: 'Projeção', Valor: projection.totalProjectedRevenue },
       { Métrica: 'Limite inferior', Valor: projection.lowerBound },
       { Métrica: 'Limite superior', Valor: projection.upperBound },
     ];
     XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(proj), 'Projeção');

     XLSX.writeFile(wb, `Power Fatu_${month}.xlsx`);
   }

   // === PDF (captura de tela) ===
   export async function exportToPDF(elementId: string, filename: string) {
     const el = document.getElementById(elementId);
     if (!el) return;
     const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#0f1117' });
     const imgData = canvas.toDataURL('image/png');
     const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width/2, canvas.height/2] });
     pdf.addImage(imgData, 'PNG', 0, 0, canvas.width/2, canvas.height/2);
     pdf.save(filename);
   }

2. src/app/page.tsx
   // Adicionar div id="dashboard-content" ao wrapper principal
   // Adicionar botão no header:
   <div className="flex gap-2">
     <button onClick={() => exportToExcel(...)} className="btn-ghost text-sm gap-1.5">
       <TableIcon className="w-4 h-4" /> Excel
     </button>
     <button onClick={() => exportToPDF('dashboard-content', 'dashboard.pdf')} className="btn-ghost text-sm gap-1.5">
       <FileDown className="w-4 h-4" /> PDF
     </button>
   </div>

3. Lazy load das libs para não aumentar o bundle inicial:
   const xlsxModule = await import('xlsx');
```

### Notas
- `html2canvas` não captura bem fontes customizadas — testar resultado
- Alternativa para PDF sem html2canvas: gerar layout tabular direto no jsPDF (mais leve, menos fiel)

---

## 5. Dark/light mode toggle

### Análise
O projeto usa tokens CSS definidos em `:root` no `globals.css`. Toda a paleta dark já
está encapsulada em variáveis (`--bg-primary`, `--accent-blue`, etc.).
Para suportar light mode: redefine as mesmas variáveis num seletor `[data-theme="light"]`.

### Abordagem
- Adicionar os tokens light em `globals.css` dentro de `[data-theme="light"]`
- Persistir preferência em `localStorage`
- Inicializar no `<html>` element para evitar flash (script inline no `<head>`)
- Toggle via botão na sidebar (ícone Sun/Moon)

### Arquivos afetados
- `src/app/globals.css` — adicionar tokens light mode
- `src/app/layout.tsx` — script inline anti-flash
- `src/components/sidebar.tsx` — botão toggle
- `src/lib/theme-context.tsx` — novo Context (opcional; pode ser simples localStorage)

### Roteiro

```
1. globals.css — definir paleta light:
   [data-theme="light"] {
     --bg-primary:    #f0f2f7;
     --bg-secondary:  #e4e8f0;
     --bg-card:       #ffffff;
     --border-subtle: rgba(0,0,0,0.08);
     --text-primary:  #111827;
     --text-secondary:#374151;
     --text-muted:    #6b7280;
     /* manter accent colors iguais ou levemente ajustados */
     --accent-blue:   #2563eb;
     --accent-green:  #16a34a;
     --accent-rose:   #dc2626;
     --accent-amber:  #d97706;
   }

2. layout.tsx — script anti-flash (antes de qualquer CSS carregado):
   <head>
     <script dangerouslySetInnerHTML={{ __html: `
       (function(){
         const t = localStorage.getItem('power-fatu-theme') || 'dark';
         document.documentElement.setAttribute('data-theme', t);
       })();
     `}} />
   </head>

3. src/lib/use-theme.ts — hook simples:
   export function useTheme() {
     const [theme, setTheme] = useState<'dark'|'light'>('dark');
     useEffect(() => {
       const saved = localStorage.getItem('power-fatu-theme') as 'dark'|'light' || 'dark';
       setTheme(saved);
     }, []);
     function toggle() {
       const next = theme === 'dark' ? 'light' : 'dark';
       setTheme(next);
       localStorage.setItem('power-fatu-theme', next);
       document.documentElement.setAttribute('data-theme', next);
     }
     return { theme, toggle };
   }

4. sidebar.tsx — adicionar botão no footer:
   import { Sun, Moon } from 'lucide-react';
   const { theme, toggle } = useTheme();
   <button onClick={toggle} className="sidebar-link w-full text-left">
     {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
     {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
   </button>
```

### Notas
- Glassmorphism com `backdrop-filter: blur` pode parecer estranho em fundos claros — ajustar
  `background` dos `.glass-card` para algo como `rgba(255,255,255,0.6)` no light mode.
- Testar gráficos Recharts (cores de texto dos eixos hardcoded em alguns exemplos — usar `var(--text-muted)`).

---

## 6. Histórico de alterações (audit log) por usuário

### Análise
Permite rastrear quem criou, editou ou excluiu registros de vendas e configurações.
Crítico para ambientes multiusuário onde múltiplos gerentes lançam dados.

### Modelo de dados — nova collection `audit_log/{id}`
```
action:     "create" | "update" | "delete"
entity:     "sale" | "channel" | "user" | "settings"
entity_id:  string  (ID do doc afetado)
uid:        string  (quem executou)
user_name:  string  (desnormalizado — para exibir sem join)
timestamp:  Timestamp
payload:    object  (dados relevantes — ex: { amount, channel_id, date })
```

### Regras Firestore a adicionar
```
match /audit_log/{id} {
  allow read: if isAdmin();
  allow create: if isAuthenticated();  // clientes gravam seus próprios logs
  allow update, delete: if false;       // imutável
}
```

### Arquivos afetados
- `src/lib/audit.ts` — novo helper `logAudit()`
- `src/app/current/page.tsx` — chamar `logAudit` em create/update/delete
- `src/app/historical/page.tsx` — idem
- `src/app/channels/page.tsx` — idem
- `src/app/users/page.tsx` — idem
- `src/app/audit/page.tsx` — nova tela (admin only)
- `src/components/sidebar.tsx` — novo item nav para admin
- `firestore.rules` — adicionar regra `audit_log`

### Roteiro

```
1. src/lib/audit.ts
   import { collection, addDoc, Timestamp } from 'firebase/firestore';
   import { db } from './firebase';

   export async function logAudit(
     user: UserProfile,
     action: 'create' | 'update' | 'delete',
     entity: 'sale' | 'channel' | 'user' | 'settings',
     entity_id: string,
     payload: Record<string, unknown> = {}
   ) {
     await addDoc(collection(db, 'audit_log'), {
       action, entity, entity_id, payload,
       uid: user.uid,
       user_name: user.name,
       timestamp: Timestamp.now(),
     });
   }

2. Integrar em current/page.tsx (exemplo create):
   await addDoc(collection(db, 'sales'), newSale);
   await logAudit(user, 'create', 'sale', docRef.id, { amount, channel_id });

3. src/app/audit/page.tsx
   - Busca os últimos 100 docs de audit_log ordenados por timestamp desc
   - Exibe tabela: Data · Usuário · Ação (badge colorido) · Entidade · Detalhes
   - Filtros: por usuário, por tipo de ação, por período
   - Paginação simples (cursor-based com startAfter)

4. Sidebar: adicionar item { href: '/audit', label: 'Auditoria', icon: ClipboardList, roles: ['admin'] }
```

### Notas
- `payload` não deve guardar senhas ou dados sensíveis.
- Volume de logs cresce com o tempo — considerar TTL (Firestore TTL policy) de 90 dias no futuro.
- Não é atômico com a operação principal (falha silenciosa no log não deve bloquear o save).
  Usar `logAudit(...).catch(console.error)` para não propagar erros de log.

---

## 7. Internacionalização (i18n)

### Análise
O projeto tem strings PT-BR hardcoded em todos os componentes. A estrutura App Router
do Next.js 16 é compatível com `next-intl`, que é a solução mais madura para i18n
no ecossistema Next.js atual.

Escopo inicial: PT-BR (já existente) + EN-US.

### Dependência
```bash
npm install next-intl
```

### Arquivos afetados (todos os componentes têm strings)
- `src/i18n/` — novo diretório com arquivos de mensagens
- `src/i18n/pt.json` + `src/i18n/en.json`
- `src/app/layout.tsx` — adicionar NextIntlClientProvider
- `next.config.ts` — adicionar plugin next-intl
- Todos os `.tsx` de pages e components — substituir strings por `t('chave')`

### Roteiro

```
1. Instalar e configurar next-intl:
   // next.config.ts
   import createNextIntlPlugin from 'next-intl/plugin';
   const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
   export default withNextIntl(nextConfig);

2. src/i18n/request.ts
   import { getRequestConfig } from 'next-intl/server';
   export default getRequestConfig(async () => {
     const locale = cookies().get('locale')?.value ?? 'pt';
     return { locale, messages: (await import(`./messages/${locale}.json`)).default };
   });

3. src/i18n/messages/pt.json (exemplo parcial):
   {
     "dashboard": {
       "title": "Dashboard",
       "accumulated": "Acumulado",
       "projection": "Projeção",
       "avg_ticket": "Ticket Médio",
       "target_progress": "Progresso vs Meta"
     },
     "nav": {
       "dashboard": "Dashboard",
       "historical": "Dados Históricos",
       "current": "Mês Atual",
       "channels": "Canais de Venda",
       "users": "Usuários",
       "settings": "Configurações"
     }
   }

4. src/i18n/messages/en.json — tradução correspondente

5. Hook de troca de idioma:
   // Botão na sidebar ou settings
   // Seta cookie 'locale' e faz router.refresh()

6. Extração de strings: processo manual (ou usar i18n-ally VSCode extension
   para identificar strings não traduzidas)
```

### Notas
- Maior parte do esforço é a extração de strings (estimado: 300–500 strings no projeto).
- Formatos de data e moeda já usam `pt-BR` locale — verificar comportamento no modo EN
  (faturamento em BRL mas UI em inglês é aceitável para o MVP).
- Recomendado fazer por fase: nav + dashboard primeiro; demais telas depois.

---

## 8. Testes automatizados (Jest + Testing Library)

### Análise
Sem testes, refatorações futuras são arriscadas. Prioridade: cobrir a lógica de negócio
pura primeiro (`prediction-engine.ts`, `format.ts`), depois os componentes críticos.

### Setup para Next.js App Router + React 19

```bash
npm install -D jest @types/jest jest-environment-jsdom
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @swc/jest @swc/core  # transpiler mais rápido que babel-jest
```

### Arquivos de configuração

```js
// jest.config.ts
import type { Config } from 'jest';
const config: Config = {
  testEnvironment: 'jsdom',
  transform: { '^.+\\.(ts|tsx)$': ['@swc/jest'] },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
};
export default config;

// jest.setup.ts
import '@testing-library/jest-dom';
```

### Plano de cobertura (por prioridade)

```
FASE 1 — Lógica pura (sem mock de Firebase)

  src/lib/__tests__/format.test.ts
    ✓ fmt(1234567.89) → "R$ 1.234.567,89"
    ✓ fmtCompact(1234567) → "R$ 1,2Mi"
    ✓ fmtCompact(800000) → "R$ 800Mil"
    ✓ fmtCompact(1500) → "R$ 1,5Mil"
    ✓ fmtCompact(950) → "R$ 950,00"
    ✓ getChannelName — encontrado / não encontrado

  src/lib/__tests__/prediction-engine.test.ts
    ✓ daysInMonth — fevereiro leap/non-leap
    ✓ seasonalWeight — dia 0, meio do mês, último dia
    ✓ projectMonthlyRevenue — sem histórico → projeção linear
    ✓ projectMonthlyRevenue — com histórico → aplica fator sazonal
    ✓ confidence aumenta com mais dados históricos
    ✓ lowerBound < projection < upperBound

FASE 2 — Componentes UI (com mock de contextos)

  src/components/__tests__/sidebar.test.tsx
    ✓ Renderiza itens corretos para role 'user'
    ✓ Renderiza itens corretos para role 'gerente'
    ✓ Renderiza todos os itens para role 'admin'
    ✓ Botão Sair chama signOut

  src/components/__tests__/app-shell.test.tsx
    ✓ Redireciona para /login se não autenticado
    ✓ Mostra "Sem acesso" se autenticado mas sem doc Firestore
    ✓ Redireciona para / se role insuficiente para a rota

FASE 3 — Integração (mock Firestore)

  src/app/__tests__/dashboard.test.tsx
    ✓ Mostra spinner enquanto carrega
    ✓ Exibe KPIs após dados carregados
    ✓ Banner de alerta aparece quando projeção desvia da meta
```

### Roteiro

```
1. Instalar dependências e criar jest.config.ts + jest.setup.ts

2. Adicionar script em package.json:
   "test": "jest",
   "test:watch": "jest --watch",
   "test:coverage": "jest --coverage"

3. Escrever testes da Fase 1 (sem mocks complexos — mais fáceis e alto ROI)

4. Criar __mocks__/firebase.ts com stubs básicos para useAuth + Firestore

5. Escrever testes da Fase 2

6. Configurar GitHub Actions (opcional) para rodar testes no push:
   .github/workflows/test.yml
```

### Notas
- Firebase e Next.js Router precisam de mock. Usar `jest.mock('@/lib/firebase')` e
  `jest.mock('next/navigation')`.
- Para App Router server components, preferir testar via Playwright (E2E) em vez de
  Jest — server components não renderizam em jsdom.
- Meta de cobertura inicial realista: **70% nas funções `lib/`**, **50% nos componentes**.

---

## Sequência de implementação recomendada

```
Sprint 1 (impacto imediato, baixo risco):
  [1] Filtro por canal nos gráficos      ← ~4h, zero deps novas
  [2] Notificações de projeção (in-app)  ← ~4h, zero deps novas

Sprint 2 (valor analítico):
  [3] Múltiplos meses no gráfico         ← ~1 dia
  [4] Exportar Excel                     ← ~1 dia (PDF pode ficar para depois)

Sprint 3 (UX e governança):
  [5] Dark/light mode                    ← ~1 dia
  [6] Audit log                          ← ~2 dias

Sprint 4 (qualidade e escala):
  [8] Testes — Fase 1 (lógica pura)      ← ~1 dia (maior ROI dos testes)
  [7] i18n                               ← ~3 dias (se necessário internacionalizar)
```
