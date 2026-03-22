"use client";

import { useState, useEffect } from "react";
import { Settings2, Save, Trash2, AlertCircle } from "lucide-react";
import { db, doc, getDoc, setDoc } from "@/lib/firebase";

const SETTINGS_DOC = doc(db, "settings", "global");

export default function SettingsPage() {
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTarget() {
      try {
        const snap = await getDoc(SETTINGS_DOC);
        if (snap.exists()) {
          const val = snap.data().revenue_target;
          if (val) setTarget(String(val));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadTarget();
  }, []);

  async function handleSave() {
    setError(null);
    try {
      const val = target ? parseFloat(target) : null;
      await setDoc(SETTINGS_DOC, { revenue_target: val }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      setError("Erro ao salvar configuração. Tente novamente.");
    }
  }

  async function handleClear() {
    setError(null);
    try {
      await setDoc(SETTINGS_DOC, { revenue_target: null }, { merge: true });
      setTarget("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      setError("Erro ao limpar configuração. Tente novamente.");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center">
          <Settings2 className="w-5 h-5 text-[var(--text-secondary)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Configurações</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Ajustes gerais do sistema de projeção
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

      {/* Target */}
      <div className="glass-card p-6 space-y-4 animate-in">
        <h2 className="font-semibold text-sm">Meta de Faturamento Mensal</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Defina a meta mensal para comparar com a projeção na página de previsão.
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-[var(--text-muted)] mb-1">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              placeholder="50000"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full"
              disabled={loading}
            />
          </div>
          <button className="btn-primary flex items-center gap-2 h-10" onClick={handleSave} disabled={loading}>
            <Save className="w-4 h-4" /> Salvar
          </button>
          <button className="btn-ghost flex items-center gap-2 h-10" onClick={handleClear} disabled={loading}>
            <Trash2 className="w-4 h-4" /> Limpar
          </button>
        </div>
        {saved && (
          <p className="text-xs text-[var(--accent-emerald)] animate-in">✓ Salvo com sucesso</p>
        )}
      </div>

      {/* Info */}
      <div className="glass-card p-6 space-y-4 animate-in delay-1">
        <h2 className="font-semibold text-sm">Sobre o Motor de Projeção</h2>
        <div className="text-xs text-[var(--text-muted)] space-y-2 leading-relaxed">
          <p>
            O sistema calcula a projeção mensal com base nos dados já lançados para o mês atual,
            ponderando com padrões históricos quando disponíveis.
          </p>
          <p>
            <strong className="text-[var(--text-secondary)]">Grau de confiança:</strong> aumenta conforme
            mais dias são registrados no mês e mais dados históricos existem. Projeções feitas com poucos
            dias têm confiança menor.
          </p>
          <p>
            <strong className="text-[var(--text-secondary)]">Intervalo:</strong> os limites inferior e
            superior representam uma margem de ±10–15% sobre a projeção central, ajustada conforme o
            grau de confiança da projeção.
          </p>
        </div>
      </div>
    </div>
  );
}
