import { describe, expect, it } from "vitest";
import { parseAmountToCents } from "../src/lib/amount";

describe("parseAmountToCents", () => {
  it.each([
    [12.5, 1250],
    [-8.9, 890],
    ["12,50 €", 1250],
    ["€12.50", 1250],
    ["1 234,56 €", 123456],
    ["1 234,56 €", 123456], // narrow no-break space, as iOS formats it
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["-8,9", 890],
    ["42", 4200],
    [",5", 50],
  ])("%j → %i cents", (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });

  it("rejects input with no digits", () => {
    expect(() => parseAmountToCents("€")).toThrow(/Montant invalide/);
    expect(() => parseAmountToCents(Number.NaN)).toThrow(/Montant invalide/);
  });
});
