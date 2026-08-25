"use client";

import { useEffect, useState, useCallback } from "react";
import {
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp,
} from "@/lib/firebase";
import type { SalesChannel, DailySale } from "@/lib/types";
import { CalendarCheck2, Pencil, Plus, Trash2, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { fmt, fmtCompact, getChannelName, getChannelColor } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth-context";

export default function CurrentMonthPage() {
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const [channelId, setChannelId] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [amount, setAmount] = useState("");
  const [orderCount, setOrderCount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<"date" | "channel" | "amount" | "orders">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { user } = useAuth();

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedSales = [...sales].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    else if (sortKey === "channel") cmp = getChannelName(channels, a.channel_id).localeCompare(getChannelName(channels, b.channel_id));
    else if (sortKey === "amount") cmp = a.amount - b.amount;
    else if (sortKey === "orders") cmp = (a.order_count ?? -1) - (b.order_count ?? -1);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const chSnap = await getDocs(collection(db, "channels"));
      const chList: SalesChannel[] = chSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as SalesChannel[];
      setChannels(chList.sort((a, b) => a.name.localeCompare(b.name)));

      const salesQ = query(
        collection(db, "sales"),
        where("date", ">=", Timestamp.fromDate(startDate)),
        where("date", "<=", Timestamp.fromDate(endDate))
      );
      const salesSnap = await getDocs(salesQ);
      const sList: DailySale[] = salesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate?.() ?? new Date(),
      })) as DailySale[];
      setSales(sList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (e) {
      console.error(e);
      setError("Erro ao carregar dados. Verifique sua conexão e recarregue a página.");
    }
    setLoading(false);
  }, []);

  // Initialize default channel separately to avoid fetchData re-triggering
  useEffect(() => {
    if (channels.length > 0 && !channelId) setChannelId(channels[0].id);
  }, [channels, channelId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  async function handleSave() {
    const parsedAmount = parseFloat(amount);
    if (!channelId || !date || !amount || isNaN(parsedAmount) || parsedAmount <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        channel_id: channelId,
        date: Timestamp.fromDate(new Date(date + "T12:00:00")),
        amount: parsedAmount,
        order_count: orderCount ? parseInt(orderCount) : null,
      };
      if (editingId) {
        await updateDoc(doc(db, "sales", editingId), payload);
        if (user) logAudit(user, "update", "sale", editingId, { channel_id: channelId, date, amount: parsedAmount, order_count: orderCount ? parseInt(orderCount) : null });
      } else {
        const ref = await addDoc(collection(db, "sales"), payload);
        if (user) logAudit(user, "create", "sale", ref.id, { channel_id: channelId, date, amount: parsedAmount, order_count: orderCount ? parseInt(orderCount) : null });
      }
      resetForm();
      fetchData();
    } catch (e) {
      console.error(e);
      setError("Erro ao salvar lançamento. Tente novamente.");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    setError(null);
    try {
      await deleteDoc(doc(db, "sales", id));
      if (user) logAudit(user, "delete", "sale", id);
      fetchData();
    } catch (e) {
      console.error(e);
      setError("Erro ao excluir lançamento. Tente novamente.");
    }
  }

  function startEdit(s: DailySale) {
    setEditingId(s.id);
    setChannelId(s.channel_id);
    const d = new Date(s.date);
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    setAmount(String(s.amount));
    setOrderCount(s.order_count ? String(s.order_count) : "");
  }

  function resetForm() {
    setEditingId(null);
    const d = new Date();
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    setAmount("");
    setOrderCount("");
  }

  const totalMonth = sales.reduce((s, e) => s + e.amount, 0);
  const totalOrders = sales.reduce((s, e) => s + (e.order_count ?? 0), 0);
  const daysWithData = new Set(sales.map((s) => new Date(s.date).getDate())).size;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-emerald)]/15 flex items-center justify-center">
          <CalendarCheck2 className="w-5 h-5 text-[var(--accent-emerald)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Mês Atual — {currentMonth}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Lance as vendas do mês corrente para calcular a projeção
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="glass-card p-3 flex items-center gap-2 border"
          style={{
            background: "color-mix(in srgb, var(--accent-rose) 6%, transparent)",
            borderColor: "color-mix(in srgb, var(--accent-rose) 30%, transparent)",
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "var(--accent-rose)" }} />
          <p className="text-sm" style={{ color: "var(--accent-rose)" }}>{error}</p>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 kpi-emerald animate-in delay-1">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Faturado até hoje</p>
          <p className="text-lg font-bold text-[var(--accent-emerald)]">{fmt(totalMonth)}</p>
        </div>
        <div className="glass-card p-4 kpi-blue animate-in delay-2">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Pedidos</p>
          <p className="text-lg font-bold text-[var(--accent-blue)]">{totalOrders}</p>
        </div>
        <div className="glass-card p-4 kpi-amber animate-in delay-3">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Dias lançados</p>
          <p className="text-lg font-bold text-[var(--accent-amber)]">{daysWithData}</p>
        </div>
      </div>

      {/* Entry form */}
      {channels.length === 0 ? (
        <div className="glass-card p-8 text-center text-[var(--text-muted)]">
          Cadastre canais de venda antes de registrar vendas.
        </div>
      ) : (
        <div className="glass-card p-6 space-y-4 animate-in">
          <h2 className="font-semibold text-sm">{editingId ? "Editar Lançamento" : "Novo Lançamento"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Canal</label>
              <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="w-full">
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Faturamento (R$)</label>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Pedidos (opc.)</label>
              <input type="number" value={orderCount} onChange={(e) => setOrderCount(e.target.value)} className="w-full" />
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-primary flex items-center justify-center gap-2 flex-1 sm:flex-none" onClick={handleSave} disabled={saving}>
              {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? "Atualizar" : "Adicionar"}
            </button>
            {editingId && (
              <button className="btn-ghost flex-1 sm:flex-none" onClick={resetForm}>Cancelar</button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="glass-card p-12 text-center text-[var(--text-muted)]">Carregando…</div>
      ) : sales.length === 0 ? (
        <div className="glass-card p-12 text-center text-[var(--text-muted)]">
          Nenhuma venda lançada para o mês atual.
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-muted)]">
                {(["date", "channel", "amount", "orders"] as const).map((key) => {
                  const labels: Record<typeof key, string> = { date: "Data", channel: "Canal", amount: "Faturamento", orders: "Pedidos" };
                  const isActive = sortKey === key;
                  const Icon = isActive ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
                  const isRight = key === "amount" || key === "orders";
                  const isHidden = key === "orders";
                  return (
                    <th
                      key={key}
                      className={`px-3 py-2.5 sm:px-5 sm:py-3 font-medium${isRight ? " text-right" : ""}${isHidden ? " hidden sm:table-cell" : ""}`}
                    >
                      <button
                        onClick={() => handleSort(key)}
                        className={`inline-flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors${isRight ? " flex-row-reverse" : ""}${isActive ? " text-[var(--text-primary)]" : ""}`}
                      >
                        {labels[key]}
                        <Icon className="w-3 h-3 shrink-0" />
                      </button>
                    </th>
                  );
                })}
                <th className="px-3 py-2.5 sm:px-5 sm:py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedSales.map((s) => {
                const d = new Date(s.date);
                return (
                  <tr key={s.id} className="border-b border-[var(--border-subtle)]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2.5 sm:px-5 sm:py-3 tabular-nums">
                      {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-2.5 sm:px-5 sm:py-3 max-w-[100px] sm:max-w-none">
                      <span className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0" style={{ backgroundColor: getChannelColor(channels, s.channel_id) }} />
                        <span className="truncate">{getChannelName(channels, s.channel_id)}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 sm:px-5 sm:py-3 text-right font-medium tabular-nums">
                      <span className="sm:hidden">{fmtCompact(s.amount)}</span>
                      <span className="hidden sm:inline">{fmt(s.amount)}</span>
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3 text-right text-[var(--text-secondary)]">{s.order_count ?? "—"}</td>
                    <td className="px-3 py-2.5 sm:px-5 sm:py-3 text-right">
                      <button onClick={() => startEdit(s)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all mr-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-rose)] hover:bg-[var(--accent-rose)]/10 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
