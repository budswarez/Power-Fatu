"use client";

import { useState, useEffect } from "react";
import { Settings2, Save, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("revenue_target");
    if (t) setTarget(t);
  }, []);

  function handleSave() {
    if (target) {
      localStorage.setItem("revenue_target", target);
    } else {
      localStorage.removeItem("revenue_target");
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClear() {
    localStorage.removeItem("revenue_target");
    setTarget("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
            />
          </div>
          <button className="btn-primary flex items-center gap-2 h-10" onClick={handleSave}>
            <Save className="w-4 h-4" /> Salvar
          </button>
          <button className="btn-ghost flex items-center gap-2 h-10" onClick={handleClear}>
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
            superior representam uma margem de ±15% sobre a projeção central, ajustada pelo desvio padrão
            dos dados históricos.
          </p>
        </div>
      </div>
    </div>
  );
}
