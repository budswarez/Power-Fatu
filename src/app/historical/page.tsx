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
import {
  CalendarClock,
  Pencil,
  Plus,
  Trash2,
  Download,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { fmt, getChannelName, getChannelColor } from "@/lib/format";

type ParsedRow = {
  channel_id: string;
  channelName: string;
  date: Date;
  amount: number;
  order_count: number | null;
};

export default function HistoricalPage() {
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Manual entry form
  const [channelId, setChannelId] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [orderCount, setOrderCount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // CSV import
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ valid: ParsedRow[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; skipped: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

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
      setSales(sList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (e) {
      console.error(e);
      setError("Erro ao carregar dados. Verifique sua conexão e recarregue a página.");
    }
    setLoading(false);
  }, [selectedMonth]);

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
      } else {
        await addDoc(collection(db, "sales"), payload);
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
    setDate("");
    setAmount("");
    setOrderCount("");
  }

  // ── CSV helpers ──────────────────────────────────────────────────────────

  function downloadTemplate() {
    const [year, month] = selectedMonth.split("-").map(Number);
    const chNames = channels.length > 0
      ? channels.map((c) => c.name)
      : ["Marketplace", "App", "Site"];

    const rows: string[] = ["data,canal,faturamento,pedidos"];
    const exampleDays = [1, 5, 10, 15, 20];
    const baseAmounts = [180250.75, 220100.50, 150750.25, 270320.00, 130080.90];
    const baseOrders  = [150, 185, 125, 225, 108];

    chNames.forEach((name, ci) => {
      exampleDays.forEach((day, di) => {
        const d = new Date(year, month - 1, day);
        if (d.getMonth() !== month - 1) return;
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const amt     = (baseAmounts[di] + ci * 40000).toFixed(2);
        const orders  = baseOrders[di]  + ci * 30;
        rows.push(`${dateStr},${name},${amt},${orders}`);
      });
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `modelo-historico-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseCSV(text: string): { valid: ParsedRow[]; errors: string[] } {
    const lines  = text.trim().split(/\r?\n/).filter((l) => l.trim());
    const errors: string[] = [];
    const valid:  ParsedRow[] = [];

    if (lines.length < 2) {
      return { valid, errors: ["Arquivo vazio ou sem linhas de dados."] };
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      const [dateStr, channelName, amountStr, ordersStr] = cols;

      if (!dateStr || !channelName || !amountStr) {
        errors.push(`Linha ${i + 1}: campos obrigatórios ausentes (data, canal, faturamento)`);
        continue;
      }

      const date = new Date(dateStr + "T12:00:00");
      if (isNaN(date.getTime())) {
        errors.push(`Linha ${i + 1}: data inválida "${dateStr}" — use o formato AAAA-MM-DD`);
        continue;
      }

      const ch = channels.find((c) => c.name.toLowerCase() === channelName.toLowerCase());
      if (!ch) {
        errors.push(`Linha ${i + 1}: canal "${channelName}" não encontrado`);
        continue;
      }

      const amount = parseFloat(amountStr.replace(",", "."));
      if (isNaN(amount) || amount <= 0) {
        errors.push(`Linha ${i + 1}: faturamento inválido "${amountStr}"`);
        continue;
      }

      const parsedOrders = ordersStr ? parseInt(ordersStr) : NaN;
      valid.push({
        channel_id: ch.id,
        channelName: ch.name,
        date,
        amount,
        order_count: isNaN(parsedOrders) ? null : parsedOrders,
      });
    }
    return { valid, errors };
  }

  function processFile(file: File) {
    setCsvFile(file);
    setImportResult(null);
    setCsvPreview(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvPreview(parseCSV(text));
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleCsvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  }

  async function handleImport() {
    if (!csvPreview || csvPreview.valid.length === 0) return;
    setImporting(true);
    setError(null);
    let imported = 0;
    let updated = 0;
    try {
      for (const row of csvPreview.valid) {
        const dayStart = new Date(row.date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(row.date);
        dayEnd.setHours(23, 59, 59, 999);

        const existingSnap = await getDocs(
          query(
            collection(db, "sales"),
            where("channel_id", "==", row.channel_id),
            where("date", ">=", Timestamp.fromDate(dayStart)),
            where("date", "<=", Timestamp.fromDate(dayEnd))
          )
        );

        const payload = {
          channel_id: row.channel_id,
          date: Timestamp.fromDate(row.date),
          amount: row.amount,
          order_count: row.order_count,
        };

        if (!existingSnap.empty) {
          await updateDoc(doc(db, "sales", existingSnap.docs[0].id), payload);
          updated++;
        } else {
          await addDoc(collection(db, "sales"), payload);
          imported++;
        }
      }
      setCsvFile(null);
      setCsvPreview(null);
      fetchData();
    } catch (e) {
      console.error(e);
      setError(`Importação interrompida. ${imported + updated} de ${csvPreview.valid.length} registros processados.`);
    } finally {
      setImportResult({ imported, updated, skipped: csvPreview?.errors.length ?? 0 });
      setImporting(false);
    }
  }

  function resetCsv() {
    setCsvFile(null);
    setCsvPreview(null);
    setImportResult(null);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-amber)]/15 flex items-center justify-center">
          <CalendarClock className="w-5 h-5 text-[var(--accent-amber)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Dados Históricos</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Cadastre vendas de meses anteriores para calibrar as projeções
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

      {/* Month selector */}
      <div className="glass-card p-4 flex items-center gap-4">
        <label className="text-sm text-[var(--text-secondary)]">Mês de referência:</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-44"
        />
      </div>

      {channels.length === 0 ? (
        <div className="glass-card p-8 text-center text-[var(--text-muted)]">
          Cadastre canais de venda antes de registrar dados históricos.
        </div>
      ) : (
        <>
          {/* CSV Import */}
          <div className="glass-card p-6 space-y-4 animate-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--accent-amber)]" />
                Importar via CSV
              </h2>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-amber)]/50 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar Modelo CSV
              </button>
            </div>

            {/* Upload area */}
            <label
              className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all"
              style={{
                borderColor: isDragging ? "var(--accent-amber)" : "var(--border-subtle)",
                background: isDragging ? "color-mix(in srgb, var(--accent-amber) 5%, transparent)" : undefined,
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCsvChange}
              />
              <Upload className="w-5 h-5 text-[var(--text-muted)] mb-1.5" />
              <span className="text-xs text-[var(--text-muted)]">
                {csvFile ? csvFile.name : "Clique ou arraste um arquivo .csv"}
              </span>
              {!csvFile && (
                <span className="text-[10px] text-[var(--text-muted)] opacity-60 mt-0.5">
                  Colunas: data (AAAA-MM-DD), canal, faturamento (use . para centavos: 150000.50), pedidos
                </span>
              )}
            </label>

            {/* Preview */}
            {csvPreview && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-xs flex-wrap">
                  <span className="flex items-center gap-1.5" style={{ color: "var(--accent-emerald)" }}>
                    <CheckCircle className="w-3.5 h-3.5" />
                    {csvPreview.valid.length} linha(s) válida(s)
                  </span>
                  {csvPreview.errors.length > 0 && (
                    <span className="flex items-center gap-1.5" style={{ color: "var(--accent-rose)" }}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      {csvPreview.errors.length} erro(s)
                    </span>
                  )}
                </div>

                {csvPreview.errors.length > 0 && (
                  <div
                    className="rounded-lg p-3 space-y-1"
                    style={{
                      background: "color-mix(in srgb, var(--accent-rose) 6%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--accent-rose) 20%, transparent)",
                    }}
                  >
                    {csvPreview.errors.slice(0, 5).map((err, i) => (
                      <p key={i} className="text-xs" style={{ color: "var(--accent-rose)" }}>{err}</p>
                    ))}
                    {csvPreview.errors.length > 5 && (
                      <p className="text-xs text-[var(--text-muted)]">
                        … e mais {csvPreview.errors.length - 5} erro(s)
                      </p>
                    )}
                  </div>
                )}

                {/* Row preview (first 3) */}
                {csvPreview.valid.length > 0 && (
                  <div className="rounded-lg overflow-hidden border border-[var(--border-subtle)] text-xs">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                          <th className="px-3 py-2 text-left font-medium">Data</th>
                          <th className="px-3 py-2 text-left font-medium">Canal</th>
                          <th className="px-3 py-2 text-right font-medium">Faturamento</th>
                          <th className="px-3 py-2 text-right font-medium">Pedidos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.valid.slice(0, 3).map((r, i) => (
                          <tr key={i} className="border-b border-[var(--border-subtle)]/50">
                            <td className="px-3 py-2">{r.date.toLocaleDateString("pt-BR")}</td>
                            <td className="px-3 py-2">{r.channelName}</td>
                            <td className="px-3 py-2 text-right">{fmt(r.amount)}</td>
                            <td className="px-3 py-2 text-right text-[var(--text-muted)]">
                              {r.order_count ?? "—"}
                            </td>
                          </tr>
                        ))}
                        {csvPreview.valid.length > 3 && (
                          <tr>
                            <td colSpan={4} className="px-3 py-2 text-center text-[var(--text-muted)]">
                              … e mais {csvPreview.valid.length - 3} linha(s)
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex gap-3">
                  {csvPreview.valid.length > 0 && (
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {importing
                        ? "Importando…"
                        : `Importar ${csvPreview.valid.length} registro(s)`}
                    </button>
                  )}
                  <button className="btn-ghost text-xs" onClick={resetCsv}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--accent-emerald)" }}>
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>
                  {importResult.imported > 0 && `${importResult.imported} novo(s) inserido(s)`}
                  {importResult.imported > 0 && importResult.updated > 0 && " · "}
                  {importResult.updated > 0 && `${importResult.updated} atualizado(s)`}
                  {importResult.imported === 0 && importResult.updated === 0 && "Nenhum registro processado."}
                  {importResult.skipped > 0 && (
                    <span className="text-[var(--text-muted)] ml-1">
                      ({importResult.skipped} linha(s) ignorada(s) por erro)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Manual entry form */}
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
              <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving}>
                {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingId ? "Atualizar" : "Adicionar"}
              </button>
              {editingId && (
                <button className="btn-ghost" onClick={resetForm}>Cancelar</button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Table */}
      {loading ? (
        <div className="glass-card p-12 text-center text-[var(--text-muted)]">Carregando…</div>
      ) : sales.length === 0 ? (
        <div className="glass-card p-12 text-center text-[var(--text-muted)]">
          Nenhum dado lançado para {selectedMonth}.
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
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getChannelColor(channels, s.channel_id) }} />
                        {getChannelName(channels, s.channel_id)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium">{fmt(s.amount)}</td>
                    <td className="px-5 py-3 text-right text-[var(--text-secondary)]">{s.order_count ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => startEdit(s)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all mr-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-rose)] hover:bg-[var(--accent-rose)]/10 transition-all"
                      >
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
