import { fmt, fmtCompact, getChannelName, getChannelColor } from "../format";
import type { SalesChannel } from "../types";

const mockChannels: SalesChannel[] = [
  { id: "ch1", name: "Marketplace", color: "#3b82f6", created_at: new Date() },
  { id: "ch2", name: "App",         color: "#10b981", created_at: new Date() },
];

// ── fmt ──────────────────────────────────────────────────────────────────────

describe("fmt", () => {
  it("formata valor em BRL completo", () => {
    expect(fmt(1234.56)).toContain("1.234,56");
  });

  it("formata zero", () => {
    expect(fmt(0)).toContain("0,00");
  });

  it("formata valor grande", () => {
    expect(fmt(1_000_000)).toContain("1.000.000,00");
  });
});

// ── fmtCompact ───────────────────────────────────────────────────────────────

describe("fmtCompact", () => {
  it("≥1Mi → formato Mi", () => {
    expect(fmtCompact(1_234_567)).toBe("R$\u00A01,2Mi");
  });

  it("1,0Mi exato", () => {
    expect(fmtCompact(1_000_000)).toBe("R$\u00A01,0Mi");
  });

  it("800_000 → 800Mil", () => {
    expect(fmtCompact(800_000)).toBe("R$\u00A0800Mil");
  });

  it("1_500 → 1,5Mil (com decimal)", () => {
    expect(fmtCompact(1_500)).toBe("R$\u00A01,5Mil");
  });

  it("10_000 → sem decimal", () => {
    expect(fmtCompact(10_000)).toBe("R$\u00A010Mil");
  });

  it("< 1_000 → formato BRL completo", () => {
    expect(fmtCompact(950)).toContain("950,00");
  });

  it("zero → R$ 0,00", () => {
    expect(fmtCompact(0)).toContain("0,00");
  });
});

// ── getChannelName ────────────────────────────────────────────────────────────

describe("getChannelName", () => {
  it("retorna o nome quando canal existe", () => {
    expect(getChannelName(mockChannels, "ch1")).toBe("Marketplace");
    expect(getChannelName(mockChannels, "ch2")).toBe("App");
  });

  it("retorna — quando canal não existe", () => {
    expect(getChannelName(mockChannels, "ch99")).toBe("—");
  });

  it("retorna — em lista vazia", () => {
    expect(getChannelName([], "ch1")).toBe("—");
  });
});

// ── getChannelColor ───────────────────────────────────────────────────────────

describe("getChannelColor", () => {
  it("retorna a cor quando canal existe", () => {
    expect(getChannelColor(mockChannels, "ch1")).toBe("#3b82f6");
  });

  it("retorna #666 quando canal não existe", () => {
    expect(getChannelColor(mockChannels, "ch99")).toBe("#666");
  });
});
