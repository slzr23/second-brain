/**
 * A holding whose value follows a market quote: an employee-savings fund invested
 * in Airbus shares, a crypto amount, an ETF…
 *
 * The unit price is rebased on the last price the user typed (for instance the
 * Amundi "valeur de part"), then moved by the quote's variation since then:
 *   unitPrice = baseUnitPrice × quote / baseQuote
 * So a fund whose price differs slightly from the share still tracks it exactly.
 */
export interface Tracker {
  symbol: string;
  baseUnitPrice: number;
  /** Quote when the base was set; null until the first refresh after an edit. */
  baseQuote: number | null;
}

export interface Revalued {
  unitPrice: number;
  tracker: Tracker;
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

export function revalue(tracker: Tracker, quote: number): Revalued {
  if (!Number.isFinite(quote) || quote <= 0) throw new Error(`Cours invalide pour ${tracker.symbol} : ${quote}`);
  if (tracker.baseQuote === null || tracker.baseQuote <= 0) {
    // First refresh since the user set the price: anchor the base on today's quote.
    return { unitPrice: tracker.baseUnitPrice, tracker: { ...tracker, baseQuote: quote } };
  }
  return { unitPrice: round((tracker.baseUnitPrice * quote) / tracker.baseQuote, 4), tracker };
}

export const valueCents = (units: number, unitPrice: number) => Math.round(units * unitPrice * 100);

export interface HoldingValue {
  group: string;
  units: number;
  unitPrice: number;
}

/** Daily net-worth snapshot, in cents, in total and per group ("PEE Amundi", "Crypto"…). */
export function snapshot(holdings: HoldingValue[]): { totalCents: number; byGroup: Record<string, number> } {
  const byGroup: Record<string, number> = {};
  for (const h of holdings) byGroup[h.group] = (byGroup[h.group] ?? 0) + valueCents(h.units, h.unitPrice);
  return { totalCents: Object.values(byGroup).reduce((a, b) => a + b, 0), byGroup };
}
