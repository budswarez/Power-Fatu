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
import { CalendarCheck2, Save, Plus, Trash2 } from "lucide-react";

export default function CurrentMonthPage() {
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
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
      if (!channelId && chList.length > 0) setChannelId(chList[0].id);

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
      setSales(sList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [channelId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function getChannelName(id: string) {
    return channels.find((c) => c.id === id)?.name ?? "—";
  }
  function getChannelColor(id: string) {
    return channels.find((c) => c.id === id)?.color ?? "#666";
  }

  async function handleSave() {
    if (!channelId || !date || !amount) return;
    setSaving(true);
    try {
      const payload = {
        channel_id: channelId,
        date: Timestamp.fromDate(new Date(date + "T12:00:00")),
        amount: parseFloat(amount),
        order_count: orderCount ? parseInt(orderCount) : null,
      };
      if (editingId) {
        await updateDoc(doc(db, "sales", editingId), payload);
      } else {
        await addDoc(collection(db, "sales"), payload);
      }
      resetForm();
      fetchData();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    try {
      await deleteDoc(doc(db, "sales", id));
      fetchData();
    } catch (e) {
      console.error(e);
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

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <input type="text" placeholder="AAAA-MM-DD" value={date} onChange={(e) => setDate(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Faturamento (R$)</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Pedidos (opc.)</label>
              <input type="number" value={orderCount} onChange={(e) => setOrderCount(e.target.value)} className="w-full" />
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving}>
              {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? "Atualizar" : "Adicionar"}
            </button>
            {editingId && (
              <button className="btn-ghost" onClick={resetForm}>Cancelar</button>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-muted)]">
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Canal</th>
                <th className="px-5 py-3 font-medium text-right">Faturamento</th>
                <th className="px-5 py-3 font-medium text-right">Pedidos</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const d = new Date(s.date);
                return (
                  <tr key={s.id} className="border-b border-[var(--border-subtle)]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      {String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getChannelColor(s.channel_id) }} />
                        {getChannelName(s.channel_id)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium">{fmt(s.amount)}</td>
                    <td className="px-5 py-3 text-right text-[var(--text-secondary)]">{s.order_count ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => startEdit(s)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all mr-1">
                        <Save className="w-3.5 h-3.5" />
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
      )}
    </div>
  );
}
