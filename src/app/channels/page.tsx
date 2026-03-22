"use client";

import { useEffect, useState } from "react";
import {
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "@/lib/firebase";
import type { SalesChannel } from "@/lib/types";
import { Layers, Plus, Trash2, Pencil, X, Check } from "lucide-react";

const PRESET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

export default function ChannelsPage() {
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  async function fetchChannels() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "channels"));
      const list: SalesChannel[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        created_at: d.data().created_at?.toDate?.() ?? new Date(),
      })) as SalesChannel[];
      setChannels(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchChannels();
  }, []);

  async function handleSave() {
    if (!name.trim()) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, "channels", editingId), { name, color });
      } else {
        await addDoc(collection(db, "channels"), {
          name,
          color,
          created_at: Timestamp.now(),
        });
      }
      resetForm();
      fetchChannels();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este canal? As vendas associadas NÃO serão removidas.")) return;
    try {
      await deleteDoc(doc(db, "channels", id));
      fetchChannels();
    } catch (e) {
      console.error(e);
    }
  }

  function startEdit(ch: SalesChannel) {
    setEditingId(ch.id);
    setName(ch.name);
    setColor(ch.color);
    setShowForm(true);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setColor(PRESET_COLORS[0]);
    setShowForm(false);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-violet)]/15 flex items-center justify-center">
            <Layers className="w-5 h-5 text-[var(--accent-violet)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Canais de Venda</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Cadastre os canais de venda para projetar o faturamento
            </p>
          </div>
        </div>
        {!showForm && (
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Novo Canal
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="glass-card p-6 animate-in space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? "Editar Canal" : "Novo Canal"}</h2>
            <button onClick={resetForm} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1.5">Nome do canal</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Mercado Livre, Shopee, Loja Física…"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-lg border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                    transform: color === c ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn-primary flex items-center gap-2" onClick={handleSave}>
              <Check className="w-4 h-4" /> Salvar
            </button>
            <button className="btn-ghost" onClick={resetForm}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="glass-card p-12 text-center text-[var(--text-muted)]">Carregando…</div>
      ) : channels.length === 0 ? (
        <div className="glass-card p-12 text-center text-[var(--text-muted)]">
          Nenhum canal cadastrado ainda. Clique em &quot;Novo Canal&quot; para começar.
        </div>
      ) : (
        <div className="grid gap-3">
          {channels.map((ch, i) => (
            <div
              key={ch.id}
              className={`glass-card p-4 flex items-center justify-between animate-in delay-${Math.min(i + 1, 4)}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: ch.color }}
                />
                <span className="font-medium">{ch.name}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(ch)}
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-all"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(ch.id)}
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-rose)]/10 hover:text-[var(--accent-rose)] transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
