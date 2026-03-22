import type { SalesChannel } from "./types";

export function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Compact currency for tight spaces (tables, mobile). Examples: R$ 1,1Mi · R$ 800Mil · R$ 950 */
export function fmtCompact(v: number): string {
  if (v >= 1_000_000) {
    return `R$\u00A0${(v / 1_000_000).toFixed(1).replace(".", ",")}Mi`;
  }
  if (v >= 1_000) {
    const decimals = v < 10_000 ? 1 : 0;
    return `R$\u00A0${(v / 1_000).toFixed(decimals).replace(".", ",")}Mil`;
  }
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function getChannelName(channels: SalesChannel[], id: string): string {
  return channels.find((c) => c.id === id)?.name ?? "—";
}

export function getChannelColor(channels: SalesChannel[], id: string): string {
  return channels.find((c) => c.id === id)?.color ?? "#666";
}
