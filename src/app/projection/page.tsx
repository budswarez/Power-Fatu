"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  db,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "@/lib/firebase";
import type { SalesChannel, DailySale } from "@/lib/types";
import { projectMonthlyRevenue, type ProjectionResult } from "@/lib/prediction-engine";
import { TrendingUp, Gauge, AlertCircle } from "lucide-react";

export default function ProjectionPage() {
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [currentSales, setCurrentSales] = useState<DailySale[]>([]);
  const [historicalSales, setHistoricalSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<number>(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      // Current month
      const startCurr = new Date(now.getFullYear(), now.getMonth(), 1);
      const endCurr = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      // Last 3 months for historical
      const startHist = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const endHist = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const chSnap = await getDocs(collection(db, "channels"));
      const chList: SalesChannel[] = chSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as SalesChannel[];
      setChannels(chList);

      const currQ = query(
        collection(db, "sales"),
        where("date", ">=", Timestamp.fromDate(startCurr)),
        where("date", "<=", Timestamp.fromDate(endCurr))
      );
      const currSnap = await getDocs(currQ);
      setCurrentSales(
        currSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          date: d.data().date?.toDate?.() ?? new Date(),
        })) as DailySale[]
      );

      const histQ = query(
        collection(db, "sales"),
        where("date", ">=", Timestamp.fromDate(startHist)),
        where("date", "<=", Timestamp.fromDate(endHist))
      );
      const histSnap = await getDocs(histQ);
      setHistoricalSales(
        histSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          date: d.data().date?.toDate?.() ?? new Date(),
        })) as DailySale[]
      );

      // Load target from localStorage
      const saved = localStorage.getItem("revenue_target");
      if (saved) setTarget(parseFloat(saved));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const projection: ProjectionResult | null = useMemo(() => {
    if (currentSales.length === 0) return null;
    return projectMonthlyRevenue(currentSales, historicalSales, target || undefined);
  }, [currentSales, historicalSales, target]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  // Channel breakdown
  const channelBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    currentSales.forEach((s) => {
      map.set(s.channel_id, (map.get(s.channel_id) ?? 0) + s.amount);
    });
    return Array.from(map.entries())
      .map(([id, total]) => ({
        id,
        name: channels.find((c) => c.id === id)?.name ?? "—",
        color: channels.find((c) => c.id === id)?.color ?? "#666",
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [currentSales, channels]);

  const grandTotal = channelBreakdown.reduce((s, c) => s + c.total, 0);

  function confidenceColor(c: number) {
    if (c >= 0.7) return "var(--accent-emerald)";
    if (c >= 0.4) return "var(--accent-amber)";
    return "var(--accent-rose)";
  }

  function confidenceLabel(c: number) {
    if (c >= 0.7) return "Alta";
    if (c >= 0.4) return "Média";
    return "Baixa";
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="glass-card p-12 text-center text-[var(--text-muted)]">
          Calculando projeção…
        </div>
      </div>
    );
  }

  if (!projection) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-purple)]/15 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[var(--accent-purple)]" />
          </div>
          <h1 className="text-xl font-bold">Projeção de Faturamento</h1>
        </div>
        <div className="glass-card p-12 text-center space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto text-[var(--accent-amber)]" />
          <p className="text-[var(--text-muted)]">
            Nenhuma venda lançada no mês atual.<br />
            Registre vendas na aba &quot;Mês Atual&quot; para gerar a projeção.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-purple)]/15 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-[var(--accent-purple)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Projeção de Faturamento</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Baseada em {projection.daysElapsed} dias de dados e {historicalSales.length > 0 ? "padrões históricos" : "extrapolação linear"}
          </p>
        </div>
      </div>

      {/* Main projection card */}
      <div className="glass-card p-8 border-l-4 animate-in" style={{ borderLeftColor: confidenceColor(projection.confidence) }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Projeção do mês</p>
            <p className="text-3xl font-bold" style={{ color: "var(--accent-purple)" }}>
              {fmt(projection.projected)}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              intervalo: {fmt(projection.lowerBound)} — {fmt(projection.upperBound)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Confiança</p>
            <div className="flex items-center gap-3">
              <Gauge className="w-6 h-6" style={{ color: confidenceColor(projection.confidence) }} />
              <div>
                <p className="text-2xl font-bold" style={{ color: confidenceColor(projection.confidence) }}>
                  {pct(projection.confidence)}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{confidenceLabel(projection.confidence)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Média diária</p>
            <p className="text-2xl font-bold text-[var(--accent-blue)]">
              {fmt(projection.dailyAverage)}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              acumulado: {fmt(projection.accumulatedTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* Target progress */}
      {target > 0 && (
        <div className="glass-card p-6 animate-in delay-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Progresso vs Meta</p>
            <p className="text-sm text-[var(--text-muted)]">
              {pct(projection.accumulatedTotal / target)} da meta
            </p>
          </div>
          <div className="h-3 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(100, (projection.accumulatedTotal / target) * 100)}%`,
                background: `linear-gradient(90deg, var(--accent-emerald), var(--accent-blue))`,
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-[var(--text-muted)]">
            <span>Acumulado: {fmt(projection.accumulatedTotal)}</span>
            <span>Meta: {fmt(target)}</span>
          </div>
          {projection.targetMet !== undefined && (
            <p className="mt-3 text-sm" style={{ color: projection.targetMet ? "var(--accent-emerald)" : "var(--accent-rose)" }}>
              {projection.targetMet
                ? "✓ Projeção indica que a meta será alcançada!"
                : `✗ Projeção indica ${fmt(target - projection.projected)} abaixo da meta`}
            </p>
          )}
        </div>
      )}

      {/* Channel breakdown */}
      {channelBreakdown.length > 0 && (
        <div className="glass-card p-6 space-y-4 animate-in delay-2">
          <h2 className="font-semibold text-sm">Faturamento por Canal (acumulado)</h2>
          <div className="space-y-3">
            {channelBreakdown.map((ch) => (
              <div key={ch.id} className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ch.color }} />
                <span className="text-sm flex-1 truncate">{ch.name}</span>
                <span className="text-sm font-medium">{fmt(ch.total)}</span>
                <div className="w-24 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${grandTotal > 0 ? (ch.total / grandTotal) * 100 : 0}%`,
                      backgroundColor: ch.color,
                    }}
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)] w-12 text-right">
                  {grandTotal > 0 ? pct(ch.total / grandTotal) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
