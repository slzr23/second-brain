import { holdingValueCents, isSpending, type Holding, type Transaction } from "../data/types";

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/* ---------------------------------- Accounts --------------------------------- */

export interface AccountGroup {
  name: string;
  cents: number;
  holdings: Holding[];
  /** Sum of what was put in, when every line of the account knows it. */
  investedCents: number | null;
}

/** Holdings grouped by account ("Livret A", "PEE Amundi", "Crypto"…), biggest first. */
export function accountGroups(holdings: Holding[]): AccountGroup[] {
  const names = [...new Set(holdings.map((h) => h.group))];
  return names
    .map((name) => {
      const list = holdings.filter((h) => h.group === name).sort((a, b) => holdingValueCents(b) - holdingValueCents(a));
      const invested = list.filter((h) => h.investedCents && h.investedCents > 0);
      return {
        name,
        holdings: list,
        cents: list.reduce((sum, h) => sum + holdingValueCents(h), 0),
        investedCents: invested.length ? invested.reduce((sum, h) => sum + (h.investedCents ?? 0), 0) : null,
      };
    })
    .filter((g) => g.holdings.some((h) => h.units > 0 && h.unitPrice > 0))
    .sort((a, b) => b.cents - a.cents);
}

/* --------------------------------- Net worth --------------------------------- */

export interface NetWorthPoint {
  month: string;
  total: number;
  /** Value of each account that month, by account name. */
  byGroup: Record<string, number>;
}

/**
 * Month-by-month value of every account, from the oldest known month to now.
 * Lines with a history use it (carried over quiet months); lines without one
 * (typed by hand) only count from the current month. The current month always
 * uses today's values.
 */
export function netWorthSeries(holdings: Holding[], now = new Date()): NetWorthPoint[] {
  const current = monthKey(now);
  const months = new Set<string>([current]);
  for (const h of holdings) for (const p of h.history) if (p.month <= current) months.add(p.month);
  const sorted = [...months].sort();

  return sorted.map((month) => {
    const byGroup: Record<string, number> = {};
    for (const h of holdings) {
      let cents = 0;
      if (month === current) cents = holdingValueCents(h);
      else if (h.history.length) {
        const known = h.history.filter((p) => p.month <= month);
        cents = known.length ? known[known.length - 1].cents : 0;
      }
      byGroup[h.group] = (byGroup[h.group] ?? 0) + cents;
    }
    return { month, total: Object.values(byGroup).reduce((a, b) => a + b, 0), byGroup };
  });
}

/* --------------------------------- Spending ---------------------------------- */

/** Spending of each day of a month, in positive cents (index 0 = the 1st). */
export function dailySpending(transactions: Transaction[], year: number, month: number): number[] {
  const days = Array.from({ length: daysIn(year, month) }, () => 0);
  for (const t of transactions) {
    if (!isSpending(t) || t.date.getFullYear() !== year || t.date.getMonth() !== month) continue;
    days[t.date.getDate() - 1] -= t.amountCents;
  }
  return days;
}

export const cumulative = (values: number[]) => {
  let total = 0;
  return values.map((v) => (total += v));
};

/** Total spent in each of the last `count` months, oldest first, current month last. */
export function monthlySpending(transactions: Transaction[], count: number, now = new Date()): { month: string; date: Date; cents: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    const cents = dailySpending(transactions, date.getFullYear(), date.getMonth()).reduce((a, b) => a + b, 0);
    return { month: monthKey(date), date, cents };
  });
}

/**
 * Average of the previous `count` months, as a running total day by day, to draw
 * "where you usually are on the 12th". Shorter months keep their final total.
 */
export function averageCumulative(transactions: Transaction[], count: number, now = new Date()): number[] {
  const length = daysIn(now.getFullYear(), now.getMonth());
  const runs = Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (i + 1), 1);
    return cumulative(dailySpending(transactions, date.getFullYear(), date.getMonth()));
  });
  return Array.from({ length }, (_, day) =>
    Math.round(runs.reduce((sum, run) => sum + run[Math.min(day, run.length - 1)], 0) / count),
  );
}

/** Where this month stands against the usual pace, at the same day: +12 means 12 % more. */
export function paceVsAverage(transactions: Transaction[], now = new Date()): { spent: number; usual: number; pct: number | null } {
  const day = now.getDate() - 1;
  const spent = cumulative(dailySpending(transactions, now.getFullYear(), now.getMonth()))[day];
  const usual = averageCumulative(transactions, 3, now)[day];
  return { spent, usual, pct: usual > 0 ? Math.round(((spent - usual) / usual) * 100) : null };
}
