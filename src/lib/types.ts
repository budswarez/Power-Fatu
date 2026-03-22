export interface SalesChannel {
  id: string;
  name: string;
  color: string;
  created_at: Date;
}

export interface DailySale {
  id: string;
  channel_id: string;
  date: Date;
  amount: number;
  order_count?: number | null;
}

export interface SalesRecord {
  id: string;
  channel_id: string;
  day: number;
  month: number;
  year: number;
  revenue: number;
  orders: number;
  type: "historical" | "current";
  created_at: Date;
}

export interface ChannelProjection {
  channelId: string;
  channelName: string;
  channelColor: string;
  currentRevenue: number;
  projectedRevenue: number;
  historicalRevenue: number;
  currentOrders: number;
  projectedOrders: number;
  historicalOrders: number;
  projectedTicket: number;
  historicalTicket: number;
  performanceIndex: number;
}

export interface ConsolidatedProjection {
  totalCurrentRevenue: number;
  totalProjectedRevenue: number;
  totalHistoricalRevenue: number;
  totalCurrentOrders: number;
  totalProjectedOrders: number;
  totalHistoricalOrders: number;
  projectedTicket: number;
  historicalTicket: number;
  channels: ChannelProjection[];
  currentDay: number;
  totalDays: number;
  seasonalWeight: number;
}

export interface DailyChartPoint {
  day: number;
  historical: number;
  current: number;
  projected: number;
}
