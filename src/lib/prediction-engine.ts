import type {
  SalesChannel,
  SalesRecord,
  ChannelProjection,
  ConsolidatedProjection,
  DailyChartPoint,
  DailySale,
} from "./types";

/** Number of days in a given month/year */
export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/** Seasonal weight = elapsed days / total days */
export function seasonalWeight(currentDay: number, totalDays: number): number {
  if (totalDays === 0) return 0;
  return Math.min(currentDay / totalDays, 1);
}

/** Project revenue from partial month */
export function projectValue(currentValue: number, weight: number): number {
  if (weight === 0) return 0;
  return currentValue / weight;
}

/** Compute projection for a single channel */
export function computeChannelProjection(
  channel: SalesChannel,
  currentSales: SalesRecord[],
  historicalSales: SalesRecord[],
  currentDay: number,
  totalDays: number
): ChannelProjection {
  const weight = seasonalWeight(currentDay, totalDays);

  const currentRevenue = currentSales.reduce((sum, s) => sum + s.revenue, 0);
  const currentOrders = currentSales.reduce((sum, s) => sum + s.orders, 0);

  const historicalRevenue = historicalSales.reduce((sum, s) => sum + s.revenue, 0);
  const historicalOrders = historicalSales.reduce((sum, s) => sum + s.orders, 0);

  // Historical accumulated for the same elapsed days (for performance ratio)
  const histRevenueForSamePeriod = historicalSales
    .filter((s) => s.day <= currentDay)
    .reduce((sum, s) => sum + s.revenue, 0);
  const histOrdersForSamePeriod = historicalSales
    .filter((s) => s.day <= currentDay)
    .reduce((sum, s) => sum + s.orders, 0);

  let projectedRevenue: number;
  let projectedOrders: number;

  if (histRevenueForSamePeriod > 0 && historicalRevenue > 0) {
    // Scale historical full month by current vs historical pace ratio
    projectedRevenue = historicalRevenue * (currentRevenue / histRevenueForSamePeriod);
  } else {
    projectedRevenue = projectValue(currentRevenue, weight);
  }

  if (histOrdersForSamePeriod > 0 && historicalOrders > 0) {
    projectedOrders = historicalOrders * (currentOrders / histOrdersForSamePeriod);
  } else {
    projectedOrders = projectValue(currentOrders, weight);
  }

  const projectedTicket = projectedOrders > 0 ? projectedRevenue / projectedOrders : 0;
  const historicalTicket = historicalOrders > 0 ? historicalRevenue / historicalOrders : 0;

  const performanceIndex =
    historicalRevenue > 0 ? (projectedRevenue / historicalRevenue) * 100 : 0;

  return {
    channelId: channel.id,
    channelName: channel.name,
    channelColor: channel.color,
    currentRevenue,
    projectedRevenue,
    historicalRevenue,
    currentOrders,
    projectedOrders,
    historicalOrders,
    projectedTicket,
    historicalTicket,
    performanceIndex,
  };
}

/** Compute consolidated projection across all channels */
export function computeConsolidatedProjection(
  channels: SalesChannel[],
  allCurrentSales: SalesRecord[],
  allHistoricalSales: SalesRecord[],
  referenceMonth: number,
  referenceYear: number,
  currentDay?: number
): ConsolidatedProjection {
  const totalDays = daysInMonth(referenceMonth, referenceYear);
  const today = currentDay ?? new Date().getDate();
  const weight = seasonalWeight(today, totalDays);

  const channelProjections = channels.map((ch) => {
    const chCurrent = allCurrentSales.filter((s) => s.channel_id === ch.id);
    const chHistorical = allHistoricalSales.filter((s) => s.channel_id === ch.id);
    return computeChannelProjection(ch, chCurrent, chHistorical, today, totalDays);
  });

  const totalCurrentRevenue = channelProjections.reduce((s, c) => s + c.currentRevenue, 0);
  const totalProjectedRevenue = channelProjections.reduce((s, c) => s + c.projectedRevenue, 0);
  const totalHistoricalRevenue = channelProjections.reduce((s, c) => s + c.historicalRevenue, 0);
  const totalCurrentOrders = channelProjections.reduce((s, c) => s + c.currentOrders, 0);
  const totalProjectedOrders = channelProjections.reduce((s, c) => s + c.projectedOrders, 0);
  const totalHistoricalOrders = channelProjections.reduce((s, c) => s + c.historicalOrders, 0);

  const projectedTicket = totalProjectedOrders > 0 ? totalProjectedRevenue / totalProjectedOrders : 0;
  const historicalTicket = totalHistoricalOrders > 0 ? totalHistoricalRevenue / totalHistoricalOrders : 0;

  return {
    totalCurrentRevenue,
    totalProjectedRevenue,
    totalHistoricalRevenue,
    totalCurrentOrders,
    totalProjectedOrders,
    totalHistoricalOrders,
    projectedTicket,
    historicalTicket,
    channels: channelProjections,
    currentDay: today,
    totalDays,
    seasonalWeight: weight,
  };
}

/** Build daily cumulative chart data */
export function buildDailyChartData(
  currentSales: SalesRecord[],
  historicalSales: SalesRecord[],
  totalDays: number
): DailyChartPoint[] {
  const points: DailyChartPoint[] = [];
  let cumulativeCurrent = 0;
  let cumulativeHistorical = 0;

  for (let d = 1; d <= totalDays; d++) {
    const dayCurrent = currentSales
      .filter((s) => s.day === d)
      .reduce((sum, s) => sum + s.revenue, 0);
    const dayHistorical = historicalSales
      .filter((s) => s.day === d)
      .reduce((sum, s) => sum + s.revenue, 0);

    cumulativeCurrent += dayCurrent;
    cumulativeHistorical += dayHistorical;

    points.push({
      day: d,
      historical: cumulativeHistorical,
      current: cumulativeCurrent,
      projected: null,
    });
  }

  // Fill projected line: from last actual day, extrapolate linearly
  const lastActualDay = Math.max(
    0,
    ...currentSales.map((s) => s.day)
  );
  if (lastActualDay > 0 && lastActualDay < totalDays) {
    const rate = cumulativeCurrent / lastActualDay;
    for (let d = lastActualDay; d <= totalDays; d++) {
      const idx = d - 1;
      if (points[idx]) {
        points[idx].projected = rate * d;
      }
    }
  }

  return points;
}

export interface ProjectionResult {
  projected: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  dailyAverage: number;
  accumulatedTotal: number;
  targetMet?: boolean;
  daysElapsed: number;
}

export function projectMonthlyRevenue(
  currentSales: DailySale[],
  historicalSales: DailySale[],
  target?: number
): ProjectionResult {
  const accumulatedTotal = currentSales.reduce((sum, s) => sum + s.amount, 0);

  const daysWithSales = new Set(currentSales.map((s) => new Date(s.date).getDate())).size;
  const daysElapsed = Math.max(1, daysWithSales);
  const dailyAverage = accumulatedTotal / daysElapsed;

  const now = new Date();
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const confidence = Math.min(daysElapsed / totalDays, 1);

  let projected: number;
  let margin: number;

  if (historicalSales.length > 0) {
    // Find the most recent complete historical month
    const latestHistDate = historicalSales.reduce((latest, s) => {
      const d = new Date(s.date);
      return d > latest ? d : latest;
    }, new Date(0));
    const latestMonth = latestHistDate.getMonth();
    const latestYear = latestHistDate.getFullYear();

    const baselineSales = historicalSales.filter((s) => {
      const d = new Date(s.date);
      return d.getMonth() === latestMonth && d.getFullYear() === latestYear;
    });

    // Historical accumulated for the same elapsed days
    const baselineForSamePeriod = baselineSales
      .filter((s) => new Date(s.date).getDate() <= daysElapsed)
      .reduce((sum, s) => sum + s.amount, 0);

    const baselineFullMonth = baselineSales.reduce((sum, s) => sum + s.amount, 0);

    if (baselineForSamePeriod > 0 && baselineFullMonth > 0) {
      // Performance ratio: current pace vs same period last month
      const performanceRatio = accumulatedTotal / baselineForSamePeriod;
      projected = baselineFullMonth * performanceRatio;
    } else {
      projected = dailyAverage * totalDays;
    }

    // Tighter interval when historical data anchors the projection
    margin = 0.10 * (1 - confidence);
  } else {
    // No historical data: pure linear extrapolation
    projected = dailyAverage * totalDays;
    margin = 0.15 * (1 - confidence);
  }

  const lowerBound = projected * (1 - margin);
  const upperBound = projected * (1 + margin);

  let targetMet;
  if (target !== undefined && target > 0) {
    targetMet = projected >= target;
  }

  return {
    projected,
    lowerBound,
    upperBound,
    confidence,
    dailyAverage,
    accumulatedTotal,
    targetMet,
    daysElapsed,
  };
}
