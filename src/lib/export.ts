import type { SalesChannel, DailySale, ConsolidatedProjection } from "./types";
import { getChannelName } from "./format";

function monthLabel(date: Date) {
  return date.toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

function fmtDate(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export async function exportSalesToExcel(
  sales: DailySale[],
  channels: SalesChannel[],
  projection: ConsolidatedProjection | null,
  label?: string
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const fileLabel = label ?? monthLabel(new Date());

  // ── Aba 1: Vendas brutas ────────────────────────────────────────────────────
  const salesRows = sales
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(s => ({
      Data: fmtDate(new Date(s.date)),
      Canal: getChannelName(channels, s.channel_id),
      "Faturamento (R$)": s.amount,
      Pedidos: s.order_count ?? "",
    }));
  const wsSales = XLSX.utils.json_to_sheet(salesRows);
  wsSales["!cols"] = [{ wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsSales, "Vendas");

  // ── Aba 2: Resumo por canal ─────────────────────────────────────────────────
  const byChannel: Record<string, { fat: number; pedidos: number }> = {};
  for (const s of sales) {
    if (!byChannel[s.channel_id]) byChannel[s.channel_id] = { fat: 0, pedidos: 0 };
    byChannel[s.channel_id].fat += s.amount;
    byChannel[s.channel_id].pedidos += s.order_count ?? 0;
  }
  const resumoRows = Object.entries(byChannel).map(([id, v]) => ({
    Canal: getChannelName(channels, id),
    "Faturamento (R$)": v.fat,
    Pedidos: v.pedidos || "",
    "Ticket Médio": v.pedidos > 0 ? +(v.fat / v.pedidos).toFixed(2) : "",
  }));
  const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
  wsResumo["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo por Canal");

  // ── Aba 3: Projeção (se disponível) ────────────────────────────────────────
  if (projection) {
    const projRows = [
      { Métrica: "Faturamento Acumulado", "Valor (R$)": projection.totalCurrentRevenue },
      { Métrica: "Projeção Fim do Mês", "Valor (R$)": projection.totalProjectedRevenue },
      { Métrica: "Pedidos Acumulados", "Valor (R$)": projection.totalCurrentOrders },
      { Métrica: "Ticket Médio Estimado", "Valor (R$)": projection.projectedTicket },
      { Métrica: "Dia Atual", "Valor (R$)": projection.currentDay },
      { Métrica: "Total de Dias no Mês", "Valor (R$)": projection.totalDays },
    ];
    const wsProj = XLSX.utils.json_to_sheet(projRows);
    wsProj["!cols"] = [{ wch: 28 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsProj, "Projeção");
  }

  XLSX.writeFile(wb, `PFatu_${fileLabel.replace(/\s+/g, "_")}.xlsx`);
}
