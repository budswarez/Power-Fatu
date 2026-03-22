import {
  daysInMonth,
  seasonalWeight,
  projectValue,
  projectMonthlyRevenue,
  computeChannelProjection,
} from "../prediction-engine";
import type { SalesChannel, SalesRecord, DailySale } from "../types";

// ── daysInMonth ───────────────────────────────────────────────────────────────

describe("daysInMonth", () => {
  it("janeiro tem 31 dias", () => expect(daysInMonth(1, 2025)).toBe(31));
  it("abril tem 30 dias",   () => expect(daysInMonth(4, 2025)).toBe(30));
  it("fevereiro 2025 tem 28 dias (não bissexto)", () => expect(daysInMonth(2, 2025)).toBe(28));
  it("fevereiro 2024 tem 29 dias (bissexto)",     () => expect(daysInMonth(2, 2024)).toBe(29));
  it("dezembro tem 31 dias", () => expect(daysInMonth(12, 2025)).toBe(31));
});

// ── seasonalWeight ────────────────────────────────────────────────────────────

describe("seasonalWeight", () => {
  it("dia 0 → peso 0",  () => expect(seasonalWeight(0, 30)).toBe(0));
  it("dia 15/30 → 0.5", () => expect(seasonalWeight(15, 30)).toBeCloseTo(0.5));
  it("dia 30/30 → 1",   () => expect(seasonalWeight(30, 30)).toBe(1));
  it("totalDays 0 → 0 (sem divisão por zero)", () => expect(seasonalWeight(5, 0)).toBe(0));
  it("dia > totalDays → limitado a 1", () => expect(seasonalWeight(35, 30)).toBe(1));
});

// ── projectValue ──────────────────────────────────────────────────────────────

describe("projectValue", () => {
  it("extrapola valor linear", () => {
    // 15k acumulado em 50% do mês → projeção de 30k
    expect(projectValue(15_000, 0.5)).toBeCloseTo(30_000);
  });

  it("peso 0 → retorna 0 (sem divisão por zero)", () => {
    expect(projectValue(10_000, 0)).toBe(0);
  });

  it("peso 1 (mês completo) → retorna o próprio valor", () => {
    expect(projectValue(50_000, 1)).toBeCloseTo(50_000);
  });
});

// ── projectMonthlyRevenue ─────────────────────────────────────────────────────

function makeSale(day: number, amount: number, month?: number, year?: number): DailySale {
  const m = month ?? new Date().getMonth() + 1;
  const y = year  ?? new Date().getFullYear();
  return {
    id: `sale-${day}-${amount}`,
    channel_id: "ch1",
    date: new Date(y, m - 1, day),
    amount,
    order_count: null,
  };
}

describe("projectMonthlyRevenue — sem histórico", () => {
  it("retorna projeção > acumulado", () => {
    const sales = [makeSale(1, 10_000), makeSale(2, 12_000), makeSale(3, 8_000)];
    const result = projectMonthlyRevenue(sales, []);
    expect(result.projected).toBeGreaterThan(result.accumulatedTotal);
  });

  it("lowerBound < projected < upperBound", () => {
    const sales = [makeSale(1, 10_000), makeSale(5, 50_000)];
    const result = projectMonthlyRevenue(sales, []);
    expect(result.lowerBound).toBeLessThan(result.projected);
    expect(result.upperBound).toBeGreaterThan(result.projected);
  });

  it("confidence aumenta conforme mais dias registrados", () => {
    const fewDays  = [makeSale(1, 10_000), makeSale(2, 10_000)];
    const manyDays = Array.from({ length: 20 }, (_, i) => makeSale(i + 1, 10_000));
    const r1 = projectMonthlyRevenue(fewDays, []);
    const r2 = projectMonthlyRevenue(manyDays, []);
    expect(r2.confidence).toBeGreaterThan(r1.confidence);
  });

  it("targetMet=true quando projeção ≥ meta", () => {
    const sales = Array.from({ length: 25 }, (_, i) => makeSale(i + 1, 5_000));
    const result = projectMonthlyRevenue(sales, [], 100_000);
    expect(result.targetMet).toBe(true);
  });

  it("targetMet=false quando projeção < meta", () => {
    const sales = [makeSale(1, 100), makeSale(2, 100)];
    const result = projectMonthlyRevenue(sales, [], 1_000_000);
    expect(result.targetMet).toBe(false);
  });

  it("targetMet=undefined quando meta não informada", () => {
    const sales = [makeSale(1, 10_000)];
    const result = projectMonthlyRevenue(sales, []);
    expect(result.targetMet).toBeUndefined();
  });
});

describe("projectMonthlyRevenue — com histórico", () => {
  const prevMonth = new Date().getMonth(); // mês anterior (0-indexed)
  const prevYear  = prevMonth === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
  const prevMonthNum = prevMonth === 0 ? 12 : prevMonth;

  const historicalSales = Array.from({ length: 30 }, (_, i) =>
    makeSale(i + 1, 10_000, prevMonthNum, prevYear)
  ); // histórico: 300k total

  it("aplica fator sazonal quando há histórico", () => {
    // Mês atual acumula 50% do ritmo histórico → projeção ≈ 50% do histórico total
    const currentSales = Array.from({ length: 15 }, (_, i) =>
      makeSale(i + 1, 5_000)
    ); // acumulado: 75k, ritmo 50% do histórico
    const result = projectMonthlyRevenue(currentSales, historicalSales);
    // Projeção deve ser menor que extrapol. linear pura (ritmo caiu)
    expect(result.projected).toBeGreaterThan(0);
    expect(result.lowerBound).toBeLessThan(result.projected);
  });

  it("intervalo de confiança é mais estreito com histórico do que sem", () => {
    const curr = Array.from({ length: 5 }, (_, i) => makeSale(i + 1, 10_000));
    const withHist    = projectMonthlyRevenue(curr, historicalSales);
    const withoutHist = projectMonthlyRevenue(curr, []);
    const rangeWith    = withHist.upperBound    - withHist.lowerBound;
    const rangeWithout = withoutHist.upperBound - withoutHist.lowerBound;
    expect(rangeWith).toBeLessThanOrEqual(rangeWithout);
  });
});

// ── computeChannelProjection ──────────────────────────────────────────────────

describe("computeChannelProjection", () => {
  const channel: SalesChannel = {
    id: "ch1", name: "Marketplace", color: "#3b82f6", created_at: new Date(),
  };

  function makeRecord(day: number, revenue: number, type: "current" | "historical" = "current"): SalesRecord {
    const now = new Date();
    return {
      id: `r-${day}`,
      channel_id: "ch1",
      day,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      revenue,
      orders: 10,
      type,
      created_at: now,
    };
  }

  it("performanceIndex=100 quando ritmo igual ao histórico", () => {
    const current    = [makeRecord(1, 10_000), makeRecord(2, 10_000)]; // 20k
    const historical = Array.from({ length: 30 }, (_, i) => makeRecord(i + 1, 10_000, "historical")); // 300k
    const result = computeChannelProjection(channel, current, historical, 2, 30);
    // Current (20k) / hist same period (20k) = 1.0 → projected = histFull * 1.0 = 300k
    expect(result.projectedRevenue).toBeCloseTo(300_000);
    expect(result.performanceIndex).toBeCloseTo(100, 0);
  });

  it("sem histórico → extrapol. linear", () => {
    const current = [makeRecord(1, 10_000), makeRecord(5, 10_000)];
    const result  = computeChannelProjection(channel, current, [], 5, 30);
    // weight = 5/30, currentRevenue=20k → projected = 20k / (5/30) = 120k
    expect(result.projectedRevenue).toBeCloseTo(120_000, -3);
  });

  it("ticket médio calculado corretamente", () => {
    const current = [makeRecord(1, 10_000)]; // orders=10, revenue=10k → ticket=1000
    const result  = computeChannelProjection(channel, current, [], 1, 30);
    // projected orders > 0, so ticket should be non-zero
    expect(result.projectedTicket).toBeGreaterThan(0);
  });
});
