"use client";

import { fmt } from "@/lib/format";
import type { ConsolidatedProjection } from "@/lib/types";

interface Props {
  projection: ConsolidatedProjection;
}

export function ChannelBreakdown({ projection }: Props) {
  const totalChannelProj = projection.channels.reduce((s, c) => s + c.projectedRevenue, 0);

  return (
    <div className="glass-card p-6 flex flex-col">
      <h2 className="text-sm font-bold text-[var(--text-primary)] mb-6 tracking-wide">
        Distribuição por Canal
      </h2>
      <div className="flex-1 space-y-4" role="list" aria-label="Distribuição de receita por canal">
        {projection.channels
          .sort((a, b) => b.projectedRevenue - a.projectedRevenue)
          .map((ch) => {
            const sharePct =
              totalChannelProj > 0 ? (ch.projectedRevenue / totalChannelProj) * 100 : 0;
            return (
              <div key={ch.channelId} className="space-y-1" role="listitem">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ch.channelColor }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{ch.channelName}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[var(--text-muted)]">
                      {sharePct.toFixed(1)}%
                    </span>
                    <span className="font-semibold">{fmt(ch.projectedRevenue)}</span>
                  </span>
                </div>
                <div
                  className="w-full h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={sharePct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${ch.channelName}: ${sharePct.toFixed(1)}%`}
                >
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${sharePct}%`, backgroundColor: ch.channelColor }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
