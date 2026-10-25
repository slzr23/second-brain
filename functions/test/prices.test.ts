import { describe, expect, it } from "vitest";
import { parseYahooChart } from "../src/prices/quotes";
import { revalue, snapshot, valueCents } from "../src/prices/revalue";

describe("revalue", () => {
  it("anchors the base on the first quote after an edit, without moving the price", () => {
    const next = revalue({ symbol: "AIR.PA", baseUnitPrice: 193.96, baseQuote: null }, 194.4);
    expect(next.unitPrice).toBe(193.96);
    expect(next.tracker.baseQuote).toBe(194.4);
  });

  it("moves a fund price by the share's variation since the base", () => {
    // The fund is worth 193.96 when the share is at 194.40; the share gains 5 %.
    const next = revalue({ symbol: "AIR.PA", baseUnitPrice: 193.96, baseQuote: 194.4 }, 204.12);
    expect(next.unitPrice).toBeCloseTo(203.658, 3);
    expect(next.tracker).toEqual({ symbol: "AIR.PA", baseUnitPrice: 193.96, baseQuote: 194.4 });
  });

  it("does not drift when refreshed with the same quote every day", () => {
    let tracker = { symbol: "AIR.PA", baseUnitPrice: 193.85, baseQuote: null as number | null };
    let price = 0;
    for (let day = 0; day < 30; day++) ({ unitPrice: price, tracker } = revalue(tracker, 190));
    expect(price).toBe(193.85);
  });

  it("rejects a missing or zero quote", () => {
    expect(() => revalue({ symbol: "AIR.PA", baseUnitPrice: 1, baseQuote: 1 }, 0)).toThrow(/Cours invalide/);
  });
});

describe("net worth", () => {
  it("values holdings in cents and sums them per group", () => {
    expect(valueCents(10.2027, 193.96)).toBe(197_892);
    expect(
      snapshot([
        { group: "PEE", units: 10.2027, unitPrice: 193.96 },
        { group: "PEE", units: 2.271, unitPrice: 193.85 },
        { group: "Livret A", units: 1, unitPrice: 1500 },
      ]),
    ).toEqual({ totalCents: 197_892 + 44_023 + 150_000, byGroup: { PEE: 197_892 + 44_023, "Livret A": 150_000 } });
  });
});

describe("parseYahooChart", () => {
  it("reads the market price, currency and time", () => {
    const body = { chart: { result: [{ meta: { regularMarketPrice: 194.4, currency: "EUR", regularMarketTime: 1_793_000_000 } }] } };
    expect(parseYahooChart("AIR.PA", body)).toEqual({
      symbol: "AIR.PA",
      price: 194.4,
      currency: "EUR",
      at: new Date(1_793_000_000_000),
    });
  });

  it("fails clearly on an unknown symbol", () => {
    expect(() => parseYahooChart("NOPE", { chart: { result: null, error: { code: "Not Found" } } })).toThrow(/Pas de cours pour NOPE/);
  });
});
