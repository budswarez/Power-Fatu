"use client";

import { BarChart3, TrendingUp, Activity, Gauge } from "lucide-react";
import { fmt } from "@/lib/format";
import type { ConsolidatedProjection } from "@/lib/types";
import type { ProjectionResult } from "@/lib/prediction-engine";

interface Props {
  projection: ConsolidatedProjection;
  projResult: ProjectionResult | null;
  target: number;
  compareLabel: string;
  comparisonAccumulated: number;
  comparisonFullMonth: number;
  currentDay: number;
}

function diffBadge(current: number, base: number) {
  if (base <= 0) return null;
  const diff = (current - base) / base;
  const pos = diff >= 0;
  return (
    <span
      className="text-xs font-bold px-1.5 py-0.5 rounded-md shrink-0"
      style={{
        color: pos ? "var(--accent-emerald)" : "var(--accent-rose)",
        backgroundColor: pos
          ? "color-mix(in srgb, var(--accent-emerald) 12%, transparent)"
          : "color-mix(in srgb, var(--accent-rose) 12%, transparent)",
      }}
    >
      {pos ? "+" : ""}{(diff * 100).toFixed(1)}%
    </span>
  );
}

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

export function KpiCards({
  projection,
  projResult,
  target,
  compareLabel,
  comparisonAccumulated,
  comparisonFullMonth,
  currentDay,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Accumulated */}
      <div className="glass-card p-6 kpi-blue animate-in delay-1 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" aria-hidden="true" /> Faturamento Acumulado
          </p>
          <p className="text-3xl font-bold text-[var(--text-primary)]">
            {fmt(projection.totalCurrentRevenue)}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {projection.totalCurrentOrders} pedidos registrados
          </p>
          {comparisonAccumulated > 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span>{compareLabel} (até dia {currentDay}): {fmt(comparisonAccumulated)}</span>
              {diffBadge(projection.totalCurrentRevenue, comparisonAccumulated)}
            </p>
          )}
        </div>
        <div className="absolute -right-6 -bottom-6 opacity-10 blur-xl" aria-hidden="true">
          <TrendingUp className="w-32 h-32 text-[var(--accent-blue)]" />
        </div>
      </div>

      {/* Projection + confidence + interval */}
      <div className="glass-card p-6 kpi-emerald animate-in delay-2 relative overflow-hidden shadow-lg glow-emerald">
        <div className="relative z-10">
          {projResult && (
            <span
              className="absolute top-0 right-0 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-2xl flex items-center gap-1"
              style={{
                backgroundColor: `color-mix(in srgb, ${confidenceColor(projResult.confidence)} 15%, transparent)`,
                color: confidenceColor(projResult.confidence),
              }}
              aria-label={`Confiança ${confidenceLabel(projResult.confidence)}`}
            >
              <Gauge className="w-4 h-4" aria-hidden="true" />
              {confidenceLabel(projResult.confidence)}
            </span>
          )}
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" aria-hidden="true" /> Projeção Fim do Mês
          </p>
          <p className="text-3xl font-bold text-[var(--accent-emerald)]">
            {fmt(projection.totalProjectedRevenue)}
          </p>
          {projResult && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {fmt(projResult.lowerBound)} — {fmt(projResult.upperBound)}
            </p>
          )}
          {comparisonFullMonth > 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span>{compareLabel}: {fmt(comparisonFullMonth)}</span>
              {diffBadge(projection.totalProjectedRevenue, comparisonFullMonth)}
            </p>
          )}
          {target > 0 && (
            <p
              className="text-sm font-medium mt-1"
              style={{
                color:
                  projection.totalProjectedRevenue >= target
                    ? "var(--accent-emerald)"
                    : "var(--accent-rose)",
              }}
            >
              Meta {fmt(target)}{" "}
              {projection.totalProjectedRevenue >= target ? "✓ atingida" : "✗ não atingida"}
            </p>
          )}
        </div>
      </div>

      {/* Avg Ticket */}
      <div className="glass-card p-6 kpi-amber animate-in delay-3 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2">
            <Activity className="w-4 h-4" aria-hidden="true" /> Ticket Médio Estimado
          </p>
          <p className="text-3xl font-bold text-[var(--text-primary)]">
            {fmt(projection.projectedTicket)}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1 flex items-center gap-2 flex-wrap">
            {compareLabel}: {fmt(projection.historicalTicket)}
            {diffBadge(projection.projectedTicket, projection.historicalTicket)}
          </p>
        </div>
      </div>
    </div>
  );
}
