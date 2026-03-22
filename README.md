# PFatu - Projeção de Faturamento

PFatu é uma plataforma de análise preditiva de faturamento multicanal, projetada para consolidar dados diários de vendas atuais e históricas para ajudar a extrapolar os resultados do final do mês através de cálculos de tendências e pesos sazonais.

## Tecnologias Utilizadas

- **Frontend:** Next.js (App Router), React, Tailwind CSS, Recharts (para gráficos), Lucide React (para ícones)
- **Backend/Data:** Firebase (Firestore) para persistência em tempo real e agregação nos clientes

## Funcionalidades

- **Dashboard Integrado:** Visualização de todos os KPIs da empresa (faturamento acumulado atual, projeção para o mês e ticket médio) em gráficos contínuos interativos.
- **Gestão de Canais:** Crie e gerencie os pontos de captação de vendas com cores personalizadas.
- **Dados Históricos:** Insira as vendas diárias da safra anterior na mesma janela para gerar um parâmetro comparativo.
- **Execução do Mês Atual:** Preencha os ganhos da execução correspondente aos canais e observe a IA extrapolar os padrões para a meta do mês.
- **Configuração de Meta Mensal:** Ajuste a meta que deseja atingir no mês em configurações, e o Dashboard dirá qual a saúde do projeto.

## Primeiros Passos

Inicie o servidor de desenvolvimento:

```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
# ou
bun dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador para ver o resultado.

## Uso

1. Entre em **Canais de Venda** e crie os seus canais principais (ex: Loja Física, E-commerce, WhatsApp).
2. Defina uma meta global em **Configurações**.
3. Adicione dados de faturamento passado em **Dados Históricos**.
4. Atualize frequentemente a página **Mês Atual** na qual toda a projeção irá basear-se.
5. Volte para o **Dashboard** para ver a mágica da extrapolação do fim de mês acontecer!
