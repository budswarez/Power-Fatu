"use client";

import { useState, useEffect } from "react";
import { Settings2, Save, Trash2, AlertCircle, Bell } from "lucide-react";
import { db, doc, getDoc, setDoc } from "@/lib/firebase";

const SETTINGS_DOC = doc(db, "settings", "global");

export default function SettingsPage() {
  const [target, setTarget] = useState("");
  const [alertThreshold, setAlertThreshold] = useState("10");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(SETTINGS_DOC);
        if (snap.exists()) {
          const data = snap.data();
          if (data.revenue_target) setTarget(String(data.revenue_target));
          if (data.alert_threshold != null) setAlertThreshold(String(data.alert_threshold));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave() {
    setError(null);
    try {
      const val = target ? parseFloat(target) : null;
      const threshold = alertThreshold ? parseFloat(alertThreshold) : 10;
      await setDoc(SETTINGS_DOC, { revenue_target: val, alert_threshold: threshold }, { merge: true });
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

      {/* Target + Alert */}
      <div className="glass-card p-6 space-y-5 animate-in">
        <h2 className="font-semibold text-sm">Meta de Faturamento Mensal</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Defina a meta mensal para comparar com a projeção no dashboard.
        </p>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-[var(--text-muted)] mb-1">Meta (R$)</label>
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

        {/* Alert threshold */}
        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-[var(--text-muted)]" />
            <h3 className="text-xs font-semibold text-[var(--text-secondary)]">Alertas de Projeção</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Exibe um banner no dashboard quando a projeção desviar da meta em mais que este percentual.
          </p>
          <div className="flex items-center gap-3">
            <div className="w-32">
              <label className="block text-xs text-[var(--text-muted)] mb-1">Threshold (%)</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="10"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                className="w-full"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-4">
              Padrão: 10% · Alerta aparece se projeção estiver {">"}10% acima ou abaixo da meta.
            </p>
          </div>
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
