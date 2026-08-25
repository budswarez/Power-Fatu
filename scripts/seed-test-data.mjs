/**
 * Seed script: insere dados de teste no Firestore
 * Cobre 01/01/2025 até 22/03/2026 com queda de vendas nos últimos 15 dias de cada mês.
 *
 * Uso: node scripts/seed-test-data.mjs
 */
import { initializeApp }       from "firebase/app";
import { initializeFirestore, collection, getDocs,
         addDoc, writeBatch, doc, Timestamp } from "firebase/firestore";
import { readFileSync }         from "fs";
import { resolve }              from "path";

/* ── ENV ─────────────────────────────────────────────────────────── */
function loadEnv() {
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  return Object.fromEntries(
    content.split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#") && l.trim())
      .map(l => {
        const idx = l.indexOf("=");
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

const env = loadEnv();
const app = initializeApp({
  apiKey:            env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

/* ── CONFIGURAÇÕES ───────────────────────────────────────────────── */

// Canais criados caso o banco esteja vazio
const TEST_CHANNELS = [
  { name: "E-commerce",      color: "#3b82f6" },
  { name: "Loja Física",     color: "#10b981" },
  { name: "WhatsApp/Social", color: "#f59e0b" },
  { name: "Marketplace",     color: "#8b5cf6" },
];

// Faturamento diário BASE (total de todos os canais) por mês
// Inclui sazonalidade: Black Friday, Natal, Dia das Mães, etc.
const MONTH_BASE = {
  "2025-01": 5_300_000,  // Janeiro    — pós-férias
  "2025-02": 5_750_000,  // Fevereiro  — Carnaval no meio
  "2025-03": 5_950_000,  // Março      — retomada
  "2025-04": 6_300_000,  // Abril      — Páscoa / feriados
  "2025-05": 7_200_000,  // Maio       — Dia das Mães (pico)
  "2025-06": 5_800_000,  // Junho      — baixa temporada
  "2025-07": 6_050_000,  // Julho      — férias escolares
  "2025-08": 6_450_000,  // Agosto     — Dia dos Pais
  "2025-09": 6_100_000,  // Setembro   — retomada Q4
  "2025-10": 7_600_000,  // Outubro    — Dia das Crianças
  "2025-11": 9_100_000,  // Novembro   — BLACK FRIDAY (pico máximo)
  "2025-12": 9_800_000,  // Dezembro   — Natal / Fim de Ano
  "2026-01": 5_050_000,  // Janeiro    — ressaca
  "2026-02": 5_600_000,  // Fevereiro  — recuperação
  "2026-03": 6_300_000,  // Março      — tendência alta
};

// Configuração por canal: participação no total e faixa de ticket médio
// Usada por índice: canal[0]=E-commerce, [1]=Física, [2]=WhatsApp, [3]=Marketplace
const CH_CONFIG = [
  { share: 0.35, ticketMin: 1_200, ticketMax: 1_800 }, // E-commerce
  { share: 0.30, ticketMin:   800, ticketMax: 1_200 }, // Loja Física
  { share: 0.20, ticketMin: 1_500, ticketMax: 2_000 }, // WhatsApp/Social
  { share: 0.15, ticketMin:   900, ticketMax: 1_400 }, // Marketplace
];

/* ── HELPERS ─────────────────────────────────────────────────────── */
const rand      = (min, max) => min + Math.random() * (max - min);
const randInt   = (min, max) => Math.round(rand(min, max));
const daysInMth = (y, m)     => new Date(y, m, 0).getDate();

/**
 * Retorna um multiplicador de receita para o dia dentro do mês.
 * Últimos 15 dias: queda progressiva de 3% até 15%.
 * Primeiros dias: variação aleatória realista ±8%.
 */
function dayMultiplier(day, totalDays) {
  const fromEnd = totalDays - day;
  if (fromEnd >= 15) {
    // Dias normais: variação ±8% com pico leve no início do mês
    const earlyBoost = day <= 5 ? rand(1.03, 1.12) : rand(0.92, 1.08);
    return earlyBoost;
  }
  // Últimos 15 dias: queda crescente
  const progress = (14 - fromEnd) / 14;          // 0 no dia (T-14), 1 no último dia
  const decline  = 0.03 + progress * 0.12;       // 3% → 15%
  return (1 - decline) * rand(0.97, 1.03);
}

/* ── MAIN ────────────────────────────────────────────────────────── */
async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Power Fatu — Seed de Dados de Teste");
  console.log("═══════════════════════════════════════\n");

  // 1. Canais ─────────────────────────────────────────────────────
  console.log("▶ Verificando canais...");
  const chSnap = await getDocs(collection(db, "channels"));
  let channels;

  if (chSnap.empty) {
    console.log("  Nenhum canal encontrado. Criando canais de teste...");
    channels = [];
    for (const ch of TEST_CHANNELS) {
      const ref = await addDoc(collection(db, "channels"), { ...ch, created_at: Timestamp.now() });
      channels.push({ id: ref.id, ...ch });
      console.log(`  ✓ Canal criado: ${ch.name}`);
    }
  } else {
    channels = chSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`  ✓ ${channels.length} canal(is) existente(s): ${channels.map(c => c.name).join(", ")}`);
  }

  // 2. Gerar documentos de venda ──────────────────────────────────
  console.log("\n▶ Gerando dados de venda (01/01/2025 → 22/03/2026)...");
  const salesDocs = [];
  const start = new Date(2025, 0, 1);
  const end   = new Date(2026, 2, 22);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y   = d.getFullYear();
    const m   = d.getMonth() + 1;
    const day = d.getDate();
    const key = `${y}-${String(m).padStart(2, "0")}`;

    const base    = MONTH_BASE[key] ?? 6_000_000;
    const mult    = dayMultiplier(day, daysInMth(y, m));
    const dayTotal = base * mult;

    channels.forEach((ch, idx) => {
      const cfg       = CH_CONFIG[idx % CH_CONFIG.length];
      // Pequena variação de participação por dia (±8%)
      const chRevenue = Math.round(dayTotal * cfg.share * rand(0.92, 1.08));
      const ticket    = rand(cfg.ticketMin, cfg.ticketMax);

      salesDocs.push({
        channel_id:  ch.id,
        date:        Timestamp.fromDate(new Date(y, m - 1, day, 12, 0, 0)),
        amount:      chRevenue,
        order_count: Math.round(chRevenue / ticket),
      });
    });
  }

  const totalDays = Math.round((end - start) / 86_400_000) + 1;
  console.log(`  ✓ ${totalDays} dias × ${channels.length} canais = ${salesDocs.length} registros`);

  // 3. Inserir em lotes de 499 ────────────────────────────────────
  console.log("\n▶ Inserindo no Firestore...");
  const BATCH_SIZE = 499;
  const totalBatches = Math.ceil(salesDocs.length / BATCH_SIZE);

  for (let i = 0; i < salesDocs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    salesDocs.slice(i, i + BATCH_SIZE).forEach(data =>
      batch.set(doc(collection(db, "sales")), data)
    );
    await batch.commit();
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const done     = Math.min(i + BATCH_SIZE, salesDocs.length);
    process.stdout.write(`\r  Lote ${batchNum}/${totalBatches} — ${done}/${salesDocs.length} registros`);
  }

  console.log("\n\n✓ Seed concluído com sucesso!");
  console.log(`  Total inserido: ${salesDocs.length} registros de venda\n`);
  process.exit(0);
}

main().catch(err => {
  console.error("\n✗ Erro durante o seed:", err.message ?? err);
  process.exit(1);
});
