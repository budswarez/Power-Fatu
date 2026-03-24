import React from "react";
import { render, screen } from "@testing-library/react";
import { ChannelBreakdown } from "../../components/channel-breakdown";
import type { ConsolidatedProjection } from "../types";

const mockProjection: ConsolidatedProjection = {
  totalCurrentRevenue: 100000,
  totalProjectedRevenue: 200000,
  totalHistoricalRevenue: 180000,
  totalCurrentOrders: 100,
  totalProjectedOrders: 200,
  totalHistoricalOrders: 180,
  projectedTicket: 1000,
  historicalTicket: 1000,
  currentDay: 15,
  totalDays: 30,
  seasonalWeight: 0.5,
  channels: [
    {
      channelId: "ch1",
      channelName: "Marketplace",
      channelColor: "#3b82f6",
      currentRevenue: 60000,
      projectedRevenue: 120000,
      historicalRevenue: 100000,
      currentOrders: 60,
      projectedOrders: 120,
      historicalOrders: 100,
      projectedTicket: 1000,
      historicalTicket: 1000,
      performanceIndex: 1.0,
    },
    {
      channelId: "ch2",
      channelName: "App",
      channelColor: "#10b981",
      currentRevenue: 40000,
      projectedRevenue: 80000,
      historicalRevenue: 80000,
      currentOrders: 40,
      projectedOrders: 80,
      historicalOrders: 80,
      projectedTicket: 1000,
      historicalTicket: 1000,
      performanceIndex: 1.0,
    },
  ],
};

describe("ChannelBreakdown", () => {
  it("renders channel names", () => {
    render(<ChannelBreakdown projection={mockProjection} />);
    expect(screen.getByText("Marketplace")).toBeInTheDocument();
    expect(screen.getByText("App")).toBeInTheDocument();
  });

  it("renders heading", () => {
    render(<ChannelBreakdown projection={mockProjection} />);
    expect(screen.getByText("Distribuição por Canal")).toBeInTheDocument();
  });

  it("renders correct share percentages", () => {
    render(<ChannelBreakdown projection={mockProjection} />);
    // Marketplace = 120k / 200k = 60%
    expect(screen.getByText("60.0%")).toBeInTheDocument();
    // App = 80k / 200k = 40%
    expect(screen.getByText("40.0%")).toBeInTheDocument();
  });

  it("sorts channels by projected revenue descending", () => {
    render(<ChannelBreakdown projection={mockProjection} />);
    const listItems = screen.getAllByRole("listitem");
    // Marketplace (120k) should come first
    expect(listItems[0]).toHaveTextContent("Marketplace");
  });

  it("renders progressbar roles with correct aria attributes", () => {
    render(<ChannelBreakdown projection={mockProjection} />);
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("aria-valuenow", "60");
    expect(bars[1]).toHaveAttribute("aria-valuenow", "40");
  });
});
