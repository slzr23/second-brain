import type { BalancePoint } from "./history";

/** One movement on a crypto platform, whatever the platform. */
export interface CryptoTrade {
  /** Platform id, to merge overlapping exports (Bitstack gives one file per year). */
  id: string;
  platform: string;
  date: Date;
  /** "BTC", "ETH"… */
  asset: string;
  /** Change of the amount held on the platform: + bought or received, − sold or sent out. */
  units: number;
  /** Euros paid (+) or received (−), fees included. 0 for rewards and wallet transfers. */
  euroCents: number;
  /** Asset price in euros at that moment, when the export gives it. */
  price: number | null;
  /** Sent to or received from your own wallet: the coins are still yours. */
  wallet: boolean;
}

export interface PlatformPosition {
  platform: string;
  units: number;
  /** Euros put in minus euros taken out on this platform. */
  investedCents: number;
  /** End-of-month value on the platform, at the last price seen that month. */
  history: BalancePoint[];
}

export interface CryptoPosition {
  asset: string;
  platforms: PlatformPosition[];
  /**
   * Sent from a platform to your own wallet and not received back on any platform
   * of the same import (Bitstack → wallet → Revolut cancels out).
   */
  walletUnits: number;
  walletHistory: BalancePoint[];
  lastPrice: number | null;
  from: Date;
  to: Date;
  trades: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const round8 = (n: number) => Math.round(n * 1e8) / 1e8;

/** Below this, a balance is dust left by rounding: treated as nothing. */
const DUST = 1e-9;

/**
 * Merges exports (duplicates removed) and sums everything up per asset and platform,
 * with one value per month from the first trade to now.
 */
export function cryptoPositions(trades: CryptoTrade[], now = new Date()): CryptoPosition[] {
  const unique = [...new Map(trades.map((t) => [t.id, t])).values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  const assets = [...new Set(unique.map((t) => t.asset))];

  return assets.map((asset) => {
    const list = unique.filter((t) => t.asset === asset);
    const platforms = [...new Set(list.map((t) => t.platform))];
    const units = new Map(platforms.map((p) => [p, 0]));
    const invested = new Map(platforms.map((p) => [p, 0]));
    let wallet = 0;
    let price: number | null = null;
    // Month → amounts at the end of that month.
    const months = new Map<string, { units: Map<string, number>; wallet: number; price: number | null }>();

    for (const t of list) {
      units.set(t.platform, units.get(t.platform)! + t.units);
      invested.set(t.platform, invested.get(t.platform)! + t.euroCents);
      if (t.wallet) wallet -= t.units;
      if (t.price) price = t.price;
      months.set(monthKey(t.date), { units: new Map(units), wallet, price });
    }

    const value = (n: number, p: number | null) => (p && n > DUST ? Math.round(round8(n) * p * 100) : 0);
    const histories = new Map<string, BalancePoint[]>(platforms.map((p) => [p, []]));
    const walletHistory: BalancePoint[] = [];
    const cursor = new Date(list[0].date.getFullYear(), list[0].date.getMonth(), 1);
    let last = { units: new Map(platforms.map((p) => [p, 0])), wallet: 0, price: null as number | null };
    while (cursor <= now) {
      last = months.get(monthKey(cursor)) ?? last;
      for (const p of platforms) histories.get(p)!.push({ month: monthKey(cursor), cents: value(last.units.get(p)!, last.price) });
      walletHistory.push({ month: monthKey(cursor), cents: value(last.wallet, last.price) });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const clean = (n: number) => (Math.abs(n) < DUST ? 0 : round8(n));
    return {
      asset,
      platforms: platforms.map((p) => ({ platform: p, units: clean(units.get(p)!), investedCents: invested.get(p)!, history: histories.get(p)! })),
      walletUnits: clean(wallet),
      walletHistory,
      lastPrice: price,
      from: list[0].date,
      to: list[list.length - 1].date,
      trades: list.length,
    };
  });
}
