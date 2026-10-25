import type { BalancePoint } from "./history";

/** One movement on a crypto platform, whatever the platform. */
export interface CryptoTrade {
  /** Platform id, to merge overlapping exports (Bitstack gives one file per year). */
  id: string;
  date: Date;
  /** "BTC", "ETH"… */
  asset: string;
  /** Change of the amount held on the platform: + bought or received, − sold or sent out. */
  units: number;
  /** Euros paid (+) or received (−), fees included. 0 for gifts and wallet transfers. */
  euroCents: number;
  /** Asset price in euros at that moment, when the export gives it. */
  price: number | null;
  /** Sent to or received from your own wallet: the coins are still yours. */
  wallet: boolean;
}

export interface CryptoPosition {
  asset: string;
  /** Held on the platform now. */
  units: number;
  /** Sent to your own wallet and not brought back. */
  walletUnits: number;
  /** Euros put in minus euros taken out. */
  investedCents: number;
  lastPrice: number | null;
  from: Date;
  to: Date;
  trades: number;
  /** End-of-month value on the platform, at the last price seen that month. */
  history: BalancePoint[];
  /** Same, for the coins sitting in your wallet. */
  walletHistory: BalancePoint[];
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const round8 = (n: number) => Math.round(n * 1e8) / 1e8;

/** Merges exports (duplicates removed) and sums everything up per asset. */
export function cryptoPositions(trades: CryptoTrade[], now = new Date()): CryptoPosition[] {
  const unique = [...new Map(trades.map((t) => [t.id, t])).values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  const assets = [...new Set(unique.map((t) => t.asset))];

  return assets.map((asset) => {
    const list = unique.filter((t) => t.asset === asset);
    let units = 0;
    let walletUnits = 0;
    let invested = 0;
    let price: number | null = null;
    const months = new Map<string, { units: number; walletUnits: number; price: number | null }>();

    for (const t of list) {
      units += t.units;
      if (t.wallet) walletUnits -= t.units;
      invested += t.euroCents;
      if (t.price) price = t.price;
      months.set(monthKey(t.date), { units, walletUnits, price });
    }

    // One point per month from the first trade to now, carrying values over quiet months.
    const history: BalancePoint[] = [];
    const walletHistory: BalancePoint[] = [];
    const value = (n: number, p: number | null) => (p ? Math.round(round8(n) * p * 100) : 0);
    const cursor = new Date(list[0].date.getFullYear(), list[0].date.getMonth(), 1);
    let last = { units: 0, walletUnits: 0, price: null as number | null };
    while (cursor <= now) {
      last = months.get(monthKey(cursor)) ?? last;
      history.push({ month: monthKey(cursor), cents: value(last.units, last.price) });
      walletHistory.push({ month: monthKey(cursor), cents: value(last.walletUnits, last.price) });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return {
      asset,
      units: round8(units),
      walletUnits: round8(walletUnits),
      investedCents: invested,
      lastPrice: price,
      from: list[0].date,
      to: list[list.length - 1].date,
      trades: list.length,
      history,
      walletHistory,
    };
  });
}
