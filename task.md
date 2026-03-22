# Planejamento: Sistema Preditivo de Faturamento

## 1. Planejamento e Configuração Inicial
- [x] Criar plano de implementação (`implementation_plan.md`)
- [x] Configurar repositório Next.js (na raiz do projeto `d:\Projeto Ai\PFatu`)
- [x] Configurar lib do Firebase

## 2. Banco de Dados (Firebase)
- [x] Ligar e configurar as regras do Firestore Collections
- [x] Inicializações bases (`channels`, `sales`)

## 3. Lógica de Preditividade e Gráficos
- [x] Implementar o serviço de cálculo consolidado (`lib/prediction-engine.ts`)
  - [x] Peso sazonal por tempo decorrido
  - [x] Extrapolação baseada em curvas atuais vs base histórica 

## 4. Telas do Frontend (Painel Preditivo)
- [x] Componentes Core de UI (Theme e Sidebar)
- [x] Gestor CRUD de Canais de Venda e cores customizadas (`/channels`)
- [x] Registro Diário de Baseline de Histórico Anteriores (`/historical`)
- [x] Acompanhamento Diário via Lançamentos no Mês Validado (`/current`)

## 5. Dashboards Resumo
- [x] Home / Dashboard Padrão contendo comparativo dos valores Meta x Real vs Histórico.
- [x] Gráficos de tendências interativos que renderizam a progressão das informações diárias (`Recharts`).

## 6. Lançamento e Ajuste Fino
- [x] Adicionar `/settings` na navegação lateral (sidebar).
- [x] Unificar Dashboard e página /projection em uma única tela consolidada (KPIs, gráfico, confiança, intervalo, barra de meta, breakdown por canal % do total).
- [x] Eliminar página /projection redundante.
- [x] Alinhar algoritmos preditivos: `computeChannelProjection` e `projectMonthlyRevenue` agora usam ratio de performance vs histórico do mesmo período.
- [x] Corrigir `projectMonthlyRevenue` para usar dados históricos reais na projeção.
- [x] Corrigir linha projetada no gráfico (null antes do período projetado, sem falso zero).
- [x] Unificar escopo do fetch histórico em todas as páginas (mês anterior).
- [x] Corrigir variável CSS `--accent-purple` indefinida (bug de cor na página /projection).
- [x] Corrigir inputs de data: `type="text"` → `type="date"` com date-picker nativo (dark mode).
- [x] Corrigir ícone de edição nas tabelas: `Save` → `Pencil`.
- [x] Mover Configurações para o rodapé fixo da sidebar, separado da navegação principal.
- [x] Adicionar indicador visual (borda) no link ativo da sidebar.
- [x] Padronizar input `type="month"` com o sistema de design global.
- [x] Adicionar estados `disabled` e `active` nos botões primários.
- [ ] Vercel deploy test (opcional).
