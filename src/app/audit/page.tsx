"use client";

import { useEffect, useState, useCallback } from "react";
import {
  db,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "@/lib/firebase";
import type { AuditEntry, AuditAction, AuditEntity } from "@/lib/audit";
import type { SalesChannel } from "@/lib/types";
import { fmtCompact, getChannelName } from "@/lib/format";
import { ClipboardList, AlertCircle, ChevronDown } from "lucide-react";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<AuditAction, { label: string; color: string }> = {
  create: { label: "Criado",    color: "var(--accent-emerald)" },
  update: { label: "Editado",   color: "var(--accent-amber)" },
  delete: { label: "Excluído",  color: "var(--accent-rose)" },
};

const ENTITY_LABELS: Record<AuditEntity, string> = {
  sale:     "Venda",
  channel:  "Canal",
  user:     "Usuário",
  settings: "Configuração",
};

function fmtTs(d: Date) {
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatPayload(payload: Record<string, unknown>, channels: SalesChannel[]): string {
  if (Object.keys(payload).length === 0) return "—";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    if (k === "date") {
      const [y, m, d] = String(v).split("-");
      parts.push(`Data: ${d}/${m}/${y}`);
    } else if (k === "channel_id") {
      parts.push(`Canal: ${getChannelName(channels, String(v))}`);
    } else if (k === "amount") {
      parts.push(`Valor: ${fmtCompact(Number(v))}`);
    } else if (k === "order_count") {
      if (v !== null) parts.push(`Pedidos: ${v}`);
    } else if (k === "name") {
      parts.push(`Nome: ${v}`);
    } else if (k === "color") {
      // skip color hex — not user-friendly
    } else if (k === "role") {
      const roleLabels: Record<string, string> = { admin: "Admin", gerente: "Gerente", user: "Usuário" };
      parts.push(`Perfil: ${roleLabels[String(v)] ?? v}`);
    } else {
      parts.push(`${k}: ${v}`);
    }
  }
  return parts.join(" · ") || "—";
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<AuditAction | "all">("all");
  const [filterEntity, setFilterEntity] = useState<AuditEntity | "all">("all");
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchAudit = useCallback(async (after?: QueryDocumentSnapshot<DocumentData> | null) => {
    const isFirstPage = !after;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const constraints = [orderBy("timestamp", "desc"), limit(PAGE_SIZE)];
      if (after) constraints.push(startAfter(after));

      const [auditSnap, channelsSnap] = await Promise.all([
        getDocs(query(collection(db, "audit_log"), ...constraints)),
        isFirstPage ? getDocs(collection(db, "channels")) : Promise.resolve(null),
      ]);

      const list = auditSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        timestamp: (d.data().timestamp as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date(),
      })) as AuditEntry[];

      setEntries(prev => isFirstPage ? list : [...prev, ...list]);
      setLastDoc(auditSnap.docs[auditSnap.docs.length - 1] ?? null);
      setHasMore(auditSnap.docs.length === PAGE_SIZE);

      if (isFirstPage && channelsSnap) {
        setChannels(channelsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as SalesChannel[]);
      }
    } catch (e) {
      console.error(e);
      setError("Erro ao carregar o log de auditoria.");
    }
    if (isFirstPage) setLoading(false);
    else setLoadingMore(false);
  }, []);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const filtered = entries.filter(e =>
    (filterAction === "all" || e.action === filterAction) &&
    (filterEntity === "all" || e.entity === filterEntity)
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-violet)]/15 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-[var(--accent-violet)]" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Log de Auditoria</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Histórico de alterações realizadas no sistema
          </p>
        </div>
      </div>

      {error && (
        <div
          className="glass-card p-3 flex items-center gap-2 border"
          role="alert"
          style={{
            background: "color-mix(in srgb, var(--accent-rose) 6%, transparent)",
            borderColor: "color-mix(in srgb, var(--accent-rose) 30%, transparent)",
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "var(--accent-rose)" }} aria-hidden="true" />
          <p className="text-sm" style={{ color: "var(--accent-rose)" }}>{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-center">
        <span className="text-xs text-[var(--text-muted)] shrink-0">Filtrar:</span>
        <div
          className="flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-0.5 border border-[var(--border-subtle)]"
          role="group"
          aria-label="Filtrar por ação"
        >
          {(["all", "create", "update", "delete"] as const).map(a => (
            <button
              key={a}
              onClick={() => setFilterAction(a)}
              aria-pressed={filterAction === a}
              className="px-3 py-1 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: filterAction === a ? "var(--bg-card)" : "transparent",
                color: filterAction === a ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {a === "all" ? "Todas ações" : ACTION_LABELS[a].label}
            </button>
          ))}
        </div>
        <div
          className="flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-0.5 border border-[var(--border-subtle)]"
          role="group"
          aria-label="Filtrar por tipo de entidade"
        >
          {(["all", "sale", "channel", "user", "settings"] as const).map(e => (
            <button
              key={e}
              onClick={() => setFilterEntity(e)}
              aria-pressed={filterEntity === e}
              className="px-3 py-1 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: filterEntity === e ? "var(--bg-card)" : "transparent",
                color: filterEntity === e ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {e === "all" ? "Todos tipos" : ENTITY_LABELS[e]}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--text-muted)] ml-auto">
          {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          {hasMore && "+"}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="glass-card p-12 text-center text-[var(--text-muted)] animate-pulse">
          Carregando log…
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-[var(--text-muted)]">
          Nenhum registro encontrado.
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-muted)]">
                  <th className="px-4 py-3 font-medium" scope="col">Data/Hora</th>
                  <th className="px-4 py-3 font-medium" scope="col">Usuário</th>
                  <th className="px-4 py-3 font-medium" scope="col">Ação</th>
                  <th className="px-4 py-3 font-medium" scope="col">Entidade</th>
                  <th className="hidden sm:table-cell px-4 py-3 font-medium" scope="col">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const ac = ACTION_LABELS[e.action];
                  return (
                    <tr key={e.id} className="border-b border-[var(--border-subtle)]/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                        {fmtTs(e.timestamp)}
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[120px] truncate">{e.user_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            color: ac.color,
                            backgroundColor: `color-mix(in srgb, ${ac.color} 12%, transparent)`,
                          }}
                        >
                          {ac.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">
                        {ENTITY_LABELS[e.entity]}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-xs text-[var(--text-muted)] max-w-[240px] truncate">
                        {formatPayload(e.payload, channels)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchAudit(lastDoc)}
            disabled={loadingMore}
            className="btn-ghost flex items-center gap-2"
            aria-label="Carregar mais registros do log"
          >
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}
