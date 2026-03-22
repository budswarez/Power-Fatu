import type { SalesChannel } from "./types";

export function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function getChannelName(channels: SalesChannel[], id: string): string {
  return channels.find((c) => c.id === id)?.name ?? "—";
}

export function getChannelColor(channels: SalesChannel[], id: string): string {
  return channels.find((c) => c.id === id)?.color ?? "#666";
}
