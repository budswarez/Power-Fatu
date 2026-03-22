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
- [ ] Otimizações UI/UX Finas (glassmorphism/cores estritas).
- [ ] Vercel deploy test (opcional).
