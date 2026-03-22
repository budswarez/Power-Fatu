# Planejamento: Aplicação de Análise Preditiva de Faturamento

Este documento detalha a arquitetura, o banco de dados e as interfaces para a construção da plataforma de projeção de vendas multicanal. A aplicação utilizará **Next.js** para o frontend e **Firebase** para banco de dados.

## 1. Arquitetura e Stack Tecnológica
* **Frontend:** React com Next.js (App Router), estilizado com Tailwind CSS e lucide-react. Gráficos renderizados por Recharts.
* **Backend:** Firebase Firestore gerenciando agregações e armazenamento dos registros de venda.
* **Hospedagem:** Next.js habilitado para deploy fácil na Vercel ou plataformas Cloud.

## 2. Estrutura do Banco de Dados (Firebase Firestore)

Esquema NoSQL focado em coleções simples para agregar dados facilmente no cliente:

### Coleção: `channels`
Canais de venda.
* `name`: String
* `color`: String (HEX)
* `created_at`: Timestamp

### Coleção: `sales`
Armazena o consolidado histórico e diário para efetuar as projeções.
* `channel_id`: String
* `date`: Timestamp
* `amount`: Number (Faturamento lançado)
* `order_count`: Number (Pedidos)

## 3. Motor Preditivo (Integrado via TypeScript)
Engine robusto lidando com faturamento diário para cruzar dados atuais X base sazonal passada, extrapolando a meta de performance prevista para final do mês.

## 4. Estrutura de Interface (UX)
- **Menu Lateral Mapeado:** Rotas rápidas e claras para navegação.
- **Painel Históricos/Atuais:** Permite os lançamentos manuais com UI glassmorphism simplificada e alertas premium.
- **Dashboard Resumo:** Relatório rápido e dinâmico que compara acumulado x estimado para alívio no controle gerencial de receitas multicanal.
