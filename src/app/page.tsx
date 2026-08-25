"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { db, collection, getDocs, query, where, Timestamp, doc, getDoc } from "@/lib/firebase";
import type { QuerySnapshot, DocumentData } from "firebase/firestore";
import type { SalesChannel, DailySale, SalesRecord } from "@/lib/types";
import {
  computeConsolidatedProjection,
  projectMonthlyRevenue,
} from "@/lib/prediction-engine";
import { fmt } from "@/lib/format";
import { TrendingUp, Activity, LayoutDashboard, AlertTriangle, CheckCircle2, Sheet, GitCompareArrows } from "lucide-react";
import { exportSalesToExcel } from "@/lib/export";
import { KpiCards } from "@/components/kpi-cards";
import { ChannelBreakdown } from "@/components/channel-breakdown";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COMP_PALETTE = ["#3b82f6","#10b981","#f59e0b","#f43f5e","#8b5cf6","#06b6d4"];

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

function toggleChannel(
  id: string,
  channels: SalesChannel[],
  prev: Set<string> | null,
  set: (v: Set<string>) => void
) {
  const base = prev ?? new Set(channels.map(c => c.id));
  const next = new Set(base);
  if (next.has(id) && next.size > 1) next.delete(id);
  else next.add(id);
  set(next);
}


export default function DashboardPage() {
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [currentSales, setCurrentSales] = useState<DailySale[]>([]);
  const [historicalSales, setHistoricalSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<number>(0);
  const [selectedChannels, setSelectedChannels] = useState<Set<string> | null>(null);
  const [selectedEvolution, setSelectedEvolution] = useState<Set<string> | null>(null);
  const [prevYearSales, setPrevYearSales] = useState<DailySale[]>([]);
  const [compareMode, setCompareMode] = useState<"prev_month" | "prev_year">("prev_month");
  const [alertThreshold, setAlertThreshold] = useState<number>(10);

  // Comparativo multi-meses
  const [compMonths, setCompMonths] = useState<string[]>([]);
  const [compData, setCompData] = useState<Record<string, DailySale[]>>({});
  const [compLoading, setCompLoading] = useState(false);
  const fetchedMonths = useRef<Set<string>>(new Set());

  const monthOptions = useMemo(() => {
    const opts: { key: string; label: string }[] = [];
    const base = new Date();
    base.setDate(1);
    for (let i = 1; i <= 12; i++) {
      base.setMonth(base.getMonth() - 1);
      const y = base.getFullYear();
      const m = base.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const label = base.toLocaleString("pt-BR", { month: "short", year: "numeric" });
      opts.push({ key, label });
    }
    return opts;
  }, []);

  useEffect(() => {
    async function fetchComp() {
      const toFetch = compMonths.filter(m => !fetchedMonths.current.has(m));
      if (toFetch.length === 0) return;
      setCompLoading(true);
      const newData: Record<string, DailySale[]> = {};
      for (const monthKey of toFetch) {
        const [year, month] = monthKey.split("-").map(Number);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);
        try {
          const snap = await getDocs(query(
            collection(db, "sales"),
            where("date", ">=", Timestamp.fromDate(start)),
            where("date", "<=", Timestamp.fromDate(end))
          ));
          newData[monthKey] = snap.docs.map(d => ({
            id: d.id, ...d.data(), date: d.data().date?.toDate?.() ?? new Date(),
          })) as DailySale[];
          fetchedMonths.current.add(monthKey);
        } catch (e) { console.error(e); }
      }
      setCompData(prev => ({ ...prev, ...newData }));
      setCompLoading(false);
    }
    fetchComp();
  }, [compMonths]);

  const compChartData = useMemo(() => {
    if (compMonths.length === 0) return [];
    return Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      const point: Record<string, number | null> = { day };
      for (const monthKey of compMonths) {
        const [y, m] = monthKey.split("-").map(Number);
        const daysInM = new Date(y, m, 0).getDate();
        if (day > daysInM) { point[monthKey] = null; continue; }
        const sales = compData[monthKey] ?? [];
        const hasDayData = sales.some(s => new Date(s.date).getDate() === day);
        if (!hasDayData && day > 1) { point[monthKey] = null; continue; }
        point[monthKey] = sales
          .filter(s => new Date(s.date).getDate() <= day)
          .reduce((sum, s) => sum + s.amount, 0) || null;
      }
      return point;
    });
  }, [compMonths, compData]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const now = new Date();
        const startCurr = new Date(now.getFullYear(), now.getMonth(), 1);
        const endCurr = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const startHist = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endHist = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        const startPrevYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        const endPrevYear = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0, 23, 59, 59);

        const [chSnap, currSnap, histSnap, prevYearSnap] = await Promise.all([
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
          getDocs(
            query(
              collection(db, "sales"),
              where("date", ">=", Timestamp.fromDate(startPrevYear)),
              where("date", "<=", Timestamp.fromDate(endPrevYear))
            )
          ),
        ]);

        const chList = chSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SalesChannel[];
        setChannels(chList.sort((a, b) => a.name.localeCompare(b.name)));

        const mapSales = (snap: QuerySnapshot<DocumentData>): DailySale[] =>
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            date: (d.data().date as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date(),
          })) as DailySale[];

        setCurrentSales(mapSales(currSnap));
        setHistoricalSales(mapSales(histSnap));
        setPrevYearSales(mapSales(prevYearSnap));

        try {
          const settingsSnap = await getDoc(doc(db, "settings", "global"));
          if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            if (data.revenue_target) setTarget(parseFloat(data.revenue_target));
            if (data.alert_threshold != null) setAlertThreshold(Number(data.alert_threshold));
          }
        } catch {
          // se falhar, meta fica em zero (sem fallback local)
        }
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

  const comparisonSales = compareMode === "prev_month" ? historicalSales : prevYearSales;

  const projection = useMemo(() => {
    if (!channels.length) return null;
    const currRecords = toSalesRecords(currentSales, "current");
    const histRecords = toSalesRecords(comparisonSales, "historical");
    return computeConsolidatedProjection(
      channels,
      currRecords,
      histRecords,
      currentMonthNum,
      currentYearNum
    );
  }, [channels, currentSales, comparisonSales, currentMonthNum, currentYearNum]);

  // Detailed projection result (confidence, bounds, target tracking)
  const projResult = useMemo(() => {
    if (currentSales.length === 0) return null;
    return projectMonthlyRevenue(currentSales, comparisonSales, target || undefined);
  }, [currentSales, comparisonSales, target]);

  const evolutionData = useMemo(() => {
    if (!channels.length) return [];
    const totalDays = new Date(currentYearNum, currentMonthNum, 0).getDate();
    const points: Record<string, number | null>[] = Array.from({ length: totalDays }, (_, i) => ({ day: i + 1 }));

    // Combined historical cumulative (all channels)
    let cumHist = 0;
    for (let d = 1; d <= totalDays; d++) {
      cumHist += comparisonSales
        .filter(s => new Date(s.date).getDate() === d)
        .reduce((sum, s) => sum + s.amount, 0);
      points[d - 1].hist = cumHist;
    }

    // Consolidated total cumulative + projection
    const allDays = currentSales.map(s => new Date(s.date).getDate());
    const lastDayTotal = allDays.length > 0 ? Math.max(...allDays) : 0;
    let cumTotal = 0;
    for (let d = 1; d <= totalDays; d++) {
      cumTotal += currentSales
        .filter(s => new Date(s.date).getDate() === d)
        .reduce((sum, s) => sum + s.amount, 0);
      points[d - 1].total = d <= lastDayTotal ? cumTotal : null;
      points[d - 1].total_p = null;
    }
    if (lastDayTotal > 0 && lastDayTotal < totalDays && cumTotal > 0) {
      const projectedEnd = projection?.totalProjectedRevenue ?? (cumTotal / lastDayTotal * totalDays);
      const daysRemaining = totalDays - lastDayTotal;
      for (let d = lastDayTotal; d <= totalDays; d++) {
        const t = daysRemaining > 0 ? (d - lastDayTotal) / daysRemaining : 1;
        points[d - 1].total_p = cumTotal + t * (projectedEnd - cumTotal);
      }
    }

    // Per-channel current cumulative + projected extrapolation
    channels.forEach(ch => {
      const chSales = currentSales.filter(s => s.channel_id === ch.id);
      const dataDays = chSales.map(s => new Date(s.date).getDate());
      const lastDay = dataDays.length > 0 ? Math.max(...dataDays) : 0;
      const projChannel = projection?.channels.find(c => c.channelId === ch.id);

      let cum = 0;
      for (let d = 1; d <= totalDays; d++) {
        cum += chSales
          .filter(s => new Date(s.date).getDate() === d)
          .reduce((sum, s) => sum + s.amount, 0);
        points[d - 1][ch.id] = d <= lastDay ? cum : null;
        points[d - 1][ch.id + "_p"] = null;
      }

      // Interpolate from current cumulative to channel projected revenue
      if (lastDay > 0 && lastDay < totalDays && cum > 0) {
        const projectedEnd = projChannel?.projectedRevenue ?? (cum / lastDay * totalDays);
        const daysRemaining = totalDays - lastDay;
        for (let d = lastDay; d <= totalDays; d++) {
          const t = daysRemaining > 0 ? (d - lastDay) / daysRemaining : 1;
          points[d - 1][ch.id + "_p"] = cum + t * (projectedEnd - cum);
        }
      }
    });

    return points;
  }, [channels, currentSales, comparisonSales, currentMonthNum, currentYearNum, projection]);

  // Day-by-day revenue per channel for the line chart
  const dailyChannelData = useMemo(() => {
    if (!projection) return [];
    return Array.from({ length: projection.totalDays }, (_, i) => {
      const day = i + 1;
      const point: Record<string, number | null> = { day };
      channels.forEach(ch => {
        const total = currentSales
          .filter(s => s.channel_id === ch.id && new Date(s.date).getDate() === day)
          .reduce((sum, s) => sum + s.amount, 0);
        point[ch.id] = total > 0 ? total : null;
      });
      return point;
    });
  }, [channels, currentSales, projection]);

  const effectiveSelected = selectedChannels ?? new Set(channels.map(c => c.id));
  const effectiveEvolution = selectedEvolution ?? new Set(channels.map(c => c.id));
  const compareLabel = compareMode === "prev_month" ? "Mês Anterior" : "Mesmo Mês (Ano Anterior)";
  const currentDay = now.getDate();
  const comparisonAccumulated = comparisonSales
    .filter(s => new Date(s.date).getDate() <= currentDay)
    .reduce((sum, s) => sum + s.amount, 0);
  const comparisonFullMonth = comparisonSales.reduce((sum, s) => sum + s.amount, 0);


  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

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
          <LayoutDashboard className="w-6 h-6 text-[var(--accent-blue)]" /> Dashboard
        </h1>
        <div className="glass-card p-12 text-center text-[var(--text-muted)]">
          Cadastre canais de venda e lançamentos para visualizar o dashboard.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/15 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Visão consolidada · {now.toLocaleString("pt-BR", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportSalesToExcel(currentSales, channels, projection,
              now.toLocaleString("pt-BR", { month: "long", year: "numeric" }))}
            className="btn-ghost text-xs flex items-center gap-1.5 h-9 px-3"
            title="Exportar para Excel"
          >
            <Sheet className="w-3.5 h-3.5" /> Excel
          </button>
          <span className="text-xs text-[var(--text-muted)]">Comparar com:</span>
          <div className="flex gap-0.5 bg-[var(--bg-secondary)] rounded-lg p-0.5 border border-[var(--border-subtle)]">
            <button
              onClick={() => setCompareMode("prev_month")}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: compareMode === "prev_month" ? "var(--bg-card)" : "transparent",
                color: compareMode === "prev_month" ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: compareMode === "prev_month" ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
              }}
            >
              Mês Anterior
            </button>
            <button
              onClick={() => setCompareMode("prev_year")}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: compareMode === "prev_year" ? "var(--bg-card)" : "transparent",
                color: compareMode === "prev_year" ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: compareMode === "prev_year" ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
              }}
            >
              Mesmo Mês (Ano Anterior)
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <KpiCards
        projection={projection}
        projResult={projResult}
        target={target}
        compareLabel={compareLabel}
        comparisonAccumulated={comparisonAccumulated}
        comparisonFullMonth={comparisonFullMonth}
        currentDay={currentDay}
      />

      {/* Alert banner */}
      {target > 0 && projection && (() => {
        const desvio = (projection.totalProjectedRevenue - target) / target * 100;
        if (Math.abs(desvio) <= alertThreshold) return null;
        const abaixo = desvio < 0;
        return (
          <div
            className="glass-card px-4 py-3 flex items-center gap-3 border animate-in"
            style={{
              borderColor: abaixo ? "color-mix(in srgb, var(--accent-rose) 40%, transparent)" : "color-mix(in srgb, var(--accent-emerald) 40%, transparent)",
              background: abaixo ? "color-mix(in srgb, var(--accent-rose) 6%, transparent)" : "color-mix(in srgb, var(--accent-emerald) 6%, transparent)",
            }}
          >
            {abaixo
              ? <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--accent-rose)" }} />
              : <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "var(--accent-emerald)" }} />
            }
            <p className="text-sm font-medium" style={{ color: abaixo ? "var(--accent-rose)" : "var(--accent-emerald)" }}>
              Projeção {abaixo ? "abaixo" : "acima"} da meta em{" "}
              <strong>{Math.abs(desvio).toFixed(1)}%</strong>
              {abaixo
                ? ` — faltam ${fmt(target - projection.totalProjectedRevenue)} para atingir a meta.`
                : ` — ${fmt(projection.totalProjectedRevenue - target)} acima do objetivo.`
              }
            </p>
          </div>
        );
      })()}

      {/* Target Progress */}
      {target > 0 && projResult && (() => {
        const stillNeeded = Math.max(0, target - projResult.accumulatedTotal);
        const daysLeft = projection ? projection.totalDays - currentDay : 0;
        const dailyNeeded = daysLeft > 0 && stillNeeded > 0 ? stillNeeded / daysLeft : null;
        const alreadyMet = projResult.accumulatedTotal >= target;
        return (
          <div className="glass-card p-6 animate-in delay-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Progresso vs Meta</p>
              <p className="text-sm text-[var(--text-muted)]">
                {pct(projResult.accumulatedTotal / target)} acumulado ·{" "}
                {pct(projResult.confidence)} de confiança
              </p>
            </div>
            <div className="h-2.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(100, (projResult.accumulatedTotal / target) * 100)}%`,
                  background: "linear-gradient(90deg, var(--accent-emerald), var(--accent-blue))",
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-[var(--text-muted)]">
              <span>Acumulado: {fmt(projResult.accumulatedTotal)}</span>
              <span>Meta: {fmt(target)}</span>
            </div>

            {/* Daily pace needed */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--bg-secondary)" }}>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Dias restantes</p>
                <p className="text-lg font-bold" style={{ color: daysLeft > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {daysLeft > 0 ? daysLeft : "—"}
                </p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--bg-secondary)" }}>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Falta acumular</p>
                <p
                  className="text-lg font-bold"
                  style={{ color: alreadyMet ? "var(--accent-emerald)" : "var(--accent-rose)" }}
                >
                  {alreadyMet ? "✓ Meta batida" : fmt(stillNeeded)}
                </p>
                {!alreadyMet && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--accent-rose)" }}>
                    {((stillNeeded / target) * 100).toFixed(1)}% da meta
                  </p>
                )}
              </div>
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--bg-secondary)" }}>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Necessário/dia</p>
                <p
                  className="text-lg font-bold"
                  style={{
                    color: alreadyMet
                      ? "var(--accent-emerald)"
                      : dailyNeeded !== null
                      ? "var(--accent-amber)"
                      : "var(--text-muted)",
                  }}
                >
                  {alreadyMet ? "—" : dailyNeeded !== null ? fmt(dailyNeeded) : "—"}
                </p>
              </div>
            </div>

            {projResult.targetMet !== undefined && (
              <p
                className="mt-3 text-sm font-medium"
                style={{
                  color: projResult.targetMet ? "var(--accent-emerald)" : "var(--accent-rose)",
                }}
              >
                {projResult.targetMet
                  ? "✓ Projeção indica que a meta será alcançada!"
                  : `✗ Projeção indica ${fmt(target - projResult.projected)} abaixo da meta`}
              </p>
            )}
          </div>
        );
      })()}

      {/* Chart + Channel Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in delay-4">
        {/* Cumulative Chart */}
        <div className="glass-card p-6 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
              Evolução de Faturamento (Acumulado Diário)
            </h2>
            <div className="flex gap-2 flex-wrap">
              {channels.map(ch => {
                const active = effectiveEvolution.has(ch.id);
                return (
                  <button
                    key={ch.id}
                    onClick={() => toggleChannel(ch.id, channels, selectedEvolution, setSelectedEvolution)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200"
                    style={{
                      backgroundColor: active ? `${ch.color}20` : "rgba(255,255,255,0.04)",
                      color: active ? ch.color : "var(--text-muted)",
                      border: `1px solid ${active ? ch.color + "50" : "var(--border-subtle)"}`,
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? ch.color : "var(--text-muted)" }} />
                    {ch.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="w-full">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolutionData} margin={{ top: 0, left: -10, right: 0, bottom: 0 }}>
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
                  tickFormatter={(val) =>
                    val >= 1_000_000
                      ? `R$${(val / 1_000_000).toFixed(1)}M`
                      : `R$${(val / 1000).toFixed(0)}k`
                  }
                  tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "12px",
                    color: "var(--text-primary)",
                  }}
                  itemStyle={{ fontSize: "13px", fontWeight: "600" }}
                  formatter={(value: unknown, _name: unknown, props: { dataKey?: string | number | ((obj: unknown) => unknown) }) => {
                    const key: string = String(props.dataKey ?? "");
                    if (key === "hist") return [fmt(Number(value) || 0), compareLabel];
                    if (key === "total") return [fmt(Number(value) || 0), "Total Acumulado"];
                    if (key === "total_p") return [fmt(Number(value) || 0), "Total (proj.)"];
                    const isProj = key.endsWith("_p");
                    const chId = isProj ? key.slice(0, -2) : key;
                    const chName = channels.find(c => c.id === chId)?.name ?? chId;
                    return [fmt(Number(value) || 0), isProj ? `${chName} (proj.)` : chName];
                  }}
                  labelFormatter={(lbl) => `Dia ${lbl}`}
                  itemSorter={(item) => {
                    const key = item.dataKey as string;
                    if (key === "total") return 0;
                    if (key === "total_p") return 1;
                    if (key === "hist") return 2;
                    return 3;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--accent-blue)"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="linear"
                  dataKey="total_p"
                  stroke="var(--accent-blue)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="hist"
                  stroke="var(--text-muted)"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {channels
                  .filter(ch => effectiveEvolution.has(ch.id))
                  .flatMap(ch => [
                    <Line
                      key={ch.id}
                      type="monotone"
                      dataKey={ch.id}
                      stroke={ch.color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />,
                    <Line
                      key={ch.id + "_p"}
                      type="linear"
                      dataKey={ch.id + "_p"}
                      stroke={ch.color}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />,
                  ])}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 opacity-70 text-xs flex-wrap">
            <div className="flex items-center gap-2">
              <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="var(--accent-blue)" strokeWidth="2.5"/></svg>
              Total
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="var(--accent-blue)" strokeWidth="2" strokeDasharray="6 4"/></svg>
              Total (proj.)
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="var(--text-primary)" strokeWidth="2"/></svg>
              Canal
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="var(--text-primary)" strokeWidth="2" strokeDasharray="6 4"/></svg>
              Canal (proj.)
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="5 4"/></svg>
              {compareLabel}
            </div>
          </div>
        </div>

        {/* Channel Breakdown */}
        <ChannelBreakdown projection={projection} />
      </div>

      {/* Daily Revenue by Channel */}
      <div className="glass-card p-6 animate-in delay-4">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
            Faturamento Diário por Canal
          </h2>
          <div className="flex gap-2 flex-wrap">
            {channels.map(ch => {
              const active = effectiveSelected.has(ch.id);
              return (
                <button
                  key={ch.id}
                  onClick={() => toggleChannel(ch.id, channels, selectedChannels, setSelectedChannels)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200"
                  style={{
                    backgroundColor: active ? `${ch.color}20` : "rgba(255,255,255,0.04)",
                    color: active ? ch.color : "var(--text-muted)",
                    border: `1px solid ${active ? ch.color + "50" : "var(--border-subtle)"}`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: active ? ch.color : "var(--text-muted)" }}
                  />
                  {ch.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="w-full">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyChannelData} margin={{ top: 0, left: -10, right: 0, bottom: 0 }}>
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
                tickFormatter={(val) =>
                  val >= 1_000_000
                    ? `R$${(val / 1_000_000).toFixed(1)}M`
                    : `R$${(val / 1000).toFixed(0)}k`
                }
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "12px",
                  color: "var(--text-primary)",
                }}
                itemStyle={{ fontSize: "13px", fontWeight: "600" }}
                formatter={(value: unknown, _name: unknown, props: { dataKey?: string | number | ((obj: unknown) => unknown) }) => [
                  fmt(Number(value) || 0),
                  channels.find(c => c.id === props.dataKey)?.name ?? String(props.dataKey ?? ""),
                ]}
                labelFormatter={(lbl) => `Dia ${lbl}`}
              />
              {channels
                .filter(ch => effectiveSelected.has(ch.id))
                .map(ch => (
                  <Line
                    key={ch.id}
                    type="monotone"
                    dataKey={ch.id}
                    stroke={ch.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    name={ch.name}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparativo Multi-Meses */}
      <div className="glass-card p-6 animate-in delay-4">
        <div className="flex items-center gap-2 mb-3">
          <GitCompareArrows className="w-4 h-4 text-[var(--accent-blue)]" />
          <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
            Comparativo Multi-Meses
          </h2>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Selecione até 6 meses para sobrepor as curvas de faturamento acumulado.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {monthOptions.map(({ key, label }) => {
            const active = compMonths.includes(key);
            const color = COMP_PALETTE[compMonths.indexOf(key)] ?? "var(--text-muted)";
            return (
              <button
                key={key}
                onClick={() => {
                  if (active) {
                    setCompMonths(prev => prev.filter(m => m !== key));
                  } else if (compMonths.length < 6) {
                    setCompMonths(prev => [...prev, key]);
                  }
                }}
                disabled={!active && compMonths.length >= 6}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                style={{
                  borderColor: active ? color : "var(--border-subtle)",
                  color: active ? color : "var(--text-muted)",
                  backgroundColor: active ? `${color}15` : "transparent",
                  opacity: !active && compMonths.length >= 6 ? 0.4 : 1,
                }}
              >
                {label}
              </button>
            );
          })}
          {compMonths.length > 0 && (
            <button
              onClick={() => setCompMonths([])}
              className="px-3 py-1.5 rounded-full text-xs text-[var(--text-muted)] border border-[var(--border-subtle)] hover:border-[var(--accent-rose)]/50 hover:text-[var(--accent-rose)] transition-all"
            >
              Limpar
            </button>
          )}
        </div>

        {compMonths.length > 0 ? (
          compLoading ? (
            <div className="h-48 flex items-center justify-center text-[var(--text-muted)] text-sm animate-pulse">
              Carregando dados…
            </div>
          ) : (
            <div className="w-full">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={compChartData} margin={{ top: 0, left: -10, right: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="day" axisLine={false} tickLine={false}
                    tick={{ fill: "var(--text-muted)", fontSize: 12 }} dy={10}
                  />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1_000_000 ? `R$${(v/1_000_000).toFixed(1)}M` : `R$${(v/1000).toFixed(0)}k`}
                    tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={60}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "12px", color: "var(--text-primary)" }}
                    itemStyle={{ fontSize: "13px", fontWeight: "600" }}
                    formatter={(value: unknown, name: unknown) => {
                      const opt = monthOptions.find(o => o.key === (name as string));
                      return [fmt(Number(value) || 0), opt?.label ?? (name as string)];
                    }}
                    labelFormatter={lbl => `Dia ${lbl}`}
                  />
                  {compMonths.map((monthKey, i) => (
                    <Line
                      key={monthKey}
                      type="monotone"
                      dataKey={monthKey}
                      stroke={COMP_PALETTE[i]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      name={monthKey}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-4 justify-center mt-2">
                {compMonths.map((monthKey, i) => (
                  <div key={monthKey} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: COMP_PALETTE[i] }} />
                    {monthOptions.find(o => o.key === monthKey)?.label ?? monthKey}
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="h-24 flex items-center justify-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] rounded-xl">
            Selecione meses acima para visualizar o comparativo
          </div>
        )}
      </div>

    </div>
  );
}
