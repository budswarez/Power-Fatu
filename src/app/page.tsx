"use client";

import { useEffect, useState, useMemo } from "react";
import { db, collection, getDocs, query, where, Timestamp } from "@/lib/firebase";
import type { SalesChannel, DailySale, SalesRecord } from "@/lib/types";
import { computeConsolidatedProjection, buildDailyChartData } from "@/lib/prediction-engine";
import { TrendingUp, Activity, BarChart3, LayoutDashboard } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function toSalesRecords(sales: DailySale[], type: "historical" | "current"): SalesRecord[] {
  return sales.map((s) => {
    const d = new Date(s.date);
    return {
      id: s.id,
      channel_id: s.channel_id,
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      revenue: s.amount,
      orders: s.order_count ?? 0,
      type,
      created_at: s.date,
    };
  });
}

export default function DashboardPage() {
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [currentSales, setCurrentSales] = useState<DailySale[]>([]);
  const [historicalSales, setHistoricalSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<number>(0);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const now = new Date();
        const startCurr = new Date(now.getFullYear(), now.getMonth(), 1);
        const endCurr = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const startHist = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endHist = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        const [chSnap, currSnap, histSnap] = await Promise.all([
          getDocs(collection(db, "channels")),
          getDocs(
            query(
              collection(db, "sales"),
              where("date", ">=", Timestamp.fromDate(startCurr)),
              where("date", "<=", Timestamp.fromDate(endCurr))
            )
          ),
          getDocs(
            query(
              collection(db, "sales"),
              where("date", ">=", Timestamp.fromDate(startHist)),
              where("date", "<=", Timestamp.fromDate(endHist))
            )
          ),
        ]);

        const chList = chSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SalesChannel[];
        setChannels(chList.sort((a, b) => a.name.localeCompare(b.name)));

        const mapSales = (snap: any) =>
          snap.docs.map((d: any) => ({
            id: d.id,
            ...d.data(),
            date: d.data().date?.toDate?.() ?? new Date(),
          })) as DailySale[];

        setCurrentSales(mapSales(currSnap));
        setHistoricalSales(mapSales(histSnap));

        const savedTarget = localStorage.getItem("revenue_target");
        if (savedTarget) setTarget(parseFloat(savedTarget));
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const now = new Date();
  const currentMonthNum = now.getMonth() + 1;
  const currentYearNum = now.getFullYear();

  const projection = useMemo(() => {
    if (!channels.length) return null;
    const currRecords = toSalesRecords(currentSales, "current");
    const histRecords = toSalesRecords(historicalSales, "historical");
    return computeConsolidatedProjection(
      channels,
      currRecords,
      histRecords,
      currentMonthNum,
      currentYearNum
    );
  }, [channels, currentSales, historicalSales, currentMonthNum, currentYearNum]);

  const chartData = useMemo(() => {
    if (!projection) return [];
    const totalDays = new Date(currentYearNum, currentMonthNum, 0).getDate();
    return buildDailyChartData(
      toSalesRecords(currentSales, "current"),
      toSalesRecords(historicalSales, "historical"),
      totalDays
    );
  }, [currentSales, historicalSales, projection, currentMonthNum, currentYearNum]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto h-64 flex items-center justify-center">
        <div className="text-[var(--text-muted)] animate-pulse flex items-center gap-3">
          <Activity className="w-5 h-5" /> Carregando Dashboard...
        </div>
      </div>
    );
  }

  if (!projection) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <LayoutDashboard className="w-6 h-6 text-[var(--accent-blue)]" /> Dashboard Geral
        </h1>
        <div className="glass-card p-12 text-center text-[var(--text-muted)]">
          Cadastre canais de venda e lançamentos para visualizar o dashboard.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/15 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Dashboard Geral</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Visão consolidada de todas as vendas e projeção para o mês atual
            </p>
          </div>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 kpi-blue animate-in delay-1 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Faturamento Acumulado
            </p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              {fmt(projection.totalCurrentRevenue)}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {projection.totalCurrentOrders} pedidos registrados
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 opacity-10 blur-xl">
            <TrendingUp className="w-32 h-32 text-[var(--accent-blue)]" />
          </div>
        </div>

        <div className="glass-card p-6 kpi-emerald animate-in delay-2 relative overflow-hidden text-center md:text-left shadow-lg glow-emerald">
          <div className="relative z-10">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Projeção Fim do Mês
            </p>
            <p className="text-3xl font-bold text-[var(--accent-emerald)]">
              {fmt(projection.totalProjectedRevenue)}
            </p>
            {target > 0 && (
              <p className="text-sm font-medium mt-1" style={{ color: projection.totalProjectedRevenue >= target ? "var(--accent-emerald)" : "var(--accent-rose)" }}>
                Meta {fmt(target)} {projection.totalProjectedRevenue >= target ? "atingida" : "não atingida"}
              </p>
            )}
          </div>
        </div>

        <div className="glass-card p-6 kpi-amber animate-in delay-3 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Ticket Médio Estimado
            </p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              {fmt(projection.projectedTicket)}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Histórico mês anterior: {fmt(projection.historicalTicket)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in delay-4">
        {/* Cumulative Chart */}
        <div className="glass-card p-6 lg:col-span-2 flex flex-col">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-6 tracking-wide">
            Evolução de Faturamento (Acumulado Diário)
          </h2>
          <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, left: -20, right: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorHistorical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--text-muted)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--text-muted)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "var(--text-muted)", fontSize: 12 }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`} 
                  tick={{ fill: "var(--text-muted)", fontSize: 12 }} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "12px",
                    color: "var(--text-primary)",
                  }}
                  itemStyle={{ fontSize: "14px", fontWeight: "600" }}
                  formatter={(value: any, name: any) => [fmt(Number(value) || 0), name === "current" ? "Atual" : name === "projected" ? "Projetado" : "Mês Anterior"]}
                  labelFormatter={(lbl) => `Dia ${lbl}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="historical" 
                  stroke="var(--text-muted)" 
                  fillOpacity={1} 
                  fill="url(#colorHistorical)" 
                  strokeDasharray="5 5"
                />
                <Area 
                  type="monotone" 
                  dataKey="current" 
                  stroke="var(--accent-blue)" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCurrent)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="projected" 
                  stroke="var(--accent-emerald)" 
                  strokeDasharray="3 3" 
                  strokeWidth={2}
                  fillOpacity={0} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 opacity-80">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-1 bg-[var(--accent-blue)] rounded-full"></span> Atual
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-1 bg-[var(--accent-emerald)] rounded-full border border-dashed"></span> Projetado
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-1 bg-[var(--text-muted)] rounded-full border border-dashed"></span> Mês Anterior
            </div>
          </div>
        </div>

        {/* Channel Breakdown */}
        <div className="glass-card p-6 flex flex-col">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-6 tracking-wide">
            Distribuição por Canal
          </h2>
          <div className="flex-1 space-y-4">
            {projection.channels.sort((a, b) => b.projectedRevenue - a.projectedRevenue).map(ch => {
              const maxProj = Math.max(...projection.channels.map(c => c.projectedRevenue));
              const pct = maxProj > 0 ? (ch.projectedRevenue / maxProj) * 100 : 0;
              return (
                <div key={ch.channelId} className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ch.channelColor }}></span>
                      <span className="truncate">{ch.channelName}</span>
                    </span>
                    <span className="font-semibold">{fmt(ch.projectedRevenue)}</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${pct}%`, backgroundColor: ch.channelColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
