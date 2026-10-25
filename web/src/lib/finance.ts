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

/* ------------------------------- Time ranges --------------------------------- */

export const RANGES = [
  { id: "1S", label: "1S", days: 7 },
  { id: "1M", label: "1M", days: 31 },
  { id: "3M", label: "3M", days: 92 },
  { id: "6M", label: "6M", days: 183 },
  { id: "1A", label: "1A", days: 366 },
  { id: "5A", label: "5A", days: 1827 },
  { id: "10A", label: "10A", days: 3653 },
  { id: "Tout", label: "Tout", days: null },
] as const;
export type Range = (typeof RANGES)[number]["id"];

/** Up to 6 months, one point a day; beyond, one point a month. */
export const isDaily = (range: Range) => {
  const days = RANGES.find((r) => r.id === range)!.days;
  return days !== null && days <= 183;
};

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Oldest date any account knows about. */
export function firstDataDate(holdings: Holding[], now = new Date()): Date {
  const months = holdings.flatMap((h) => h.history.map((p) => p.month)).sort();
  return months.length ? new Date(Number(months[0].slice(0, 4)), Number(months[0].slice(5, 7)) - 1, 1) : now;
}

/**
 * The ranges worth offering: short ones always, long ones only when the data goes
 * back further than the range below (no "10 ans" for three years of history).
 * Hours and days are left out: values change at most once a day.
 */
export function availableRanges(holdings: Holding[], now = new Date()): Range[] {
  const span = (now.getTime() - firstDataDate(holdings, now).getTime()) / 86_400_000;
  return RANGES.filter((r, i) => r.days === null || i <= 4 || span > RANGES[i - 1].days!).map((r) => r.id);
}

export interface ValuePoint {
  key: string;
  date: Date;
  total: number;
  byGroup: Record<string, number>;
}

/** Daily values stored each evening by the server (users/{uid}/netWorth/{day}). */
export interface DaySnapshot {
  day: string;
  byGroup: Record<string, number>;
}

/**
 * Value of each account over the chosen range.
 * Daily points, for each account and day, take the first source that knows:
 *  1. today's live value;
 *  2. the evening snapshot of that day;
 *  3. for a bank account, its balance rebuilt from the movements after that day;
 *  4. otherwise the month's value from the account's history.
 * Longer ranges use the monthly series.
 */
export function valueSeries(holdings: Holding[], transactions: Transaction[], snapshots: DaySnapshot[], range: Range, now = new Date()): ValuePoint[] {
  const spec = RANGES.find((r) => r.id === range)!;
  if (!isDaily(range)) {
    const from = spec.days === null ? null : monthKey(new Date(now.getTime() - spec.days * 86_400_000));
    return netWorthSeries(holdings, now)
      .filter((p) => from === null || p.month >= from)
      .map((p) => ({ key: p.month, date: new Date(Number(p.month.slice(0, 4)), Number(p.month.slice(5, 7)) - 1, 1), total: p.total, byGroup: p.byGroup }));
  }

  const groups = [...new Set(holdings.map((h) => h.group))];
  const byDay = new Map(snapshots.map((s) => [s.day, s.byGroup]));
  const today = dayKey(now);
  const live = (group: string) => holdings.filter((h) => h.group === group).reduce((sum, h) => sum + holdingValueCents(h), 0);
  const isBank = (group: string) => holdings.some((h) => h.group === group && h.id.startsWith("account_"));
  const bankMoves = new Map(groups.filter(isBank).map((g) => [g, transactions.filter((t) => t.account === g)]));

  const points: ValuePoint[] = [];
  for (let back = spec.days! - 1; back >= 0; back--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const key = dayKey(date);
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const month = monthKey(date);
    const byGroup: Record<string, number> = {};
    for (const group of groups) {
      if (key === today) byGroup[group] = live(group);
      else if (byDay.get(key)?.[group] !== undefined) byGroup[group] = byDay.get(key)![group];
      else if (bankMoves.has(group)) {
        byGroup[group] = live(group) - bankMoves.get(group)!.filter((t) => t.date >= endOfDay).reduce((sum, t) => sum + t.amountCents, 0);
      } else {
        byGroup[group] = holdings
          .filter((h) => h.group === group)
          .reduce((sum, h) => {
            if (month === monthKey(now)) return sum + holdingValueCents(h);
            const known = h.history.filter((p) => p.month <= month);
            return sum + (known.length ? known[known.length - 1].cents : 0);
          }, 0);
      }
    }
    points.push({ key, date, total: Object.values(byGroup).reduce((a, b) => a + b, 0), byGroup });
  }
  return points;
}

/* ----------------------------- Spending buckets ------------------------------ */

export type SpendUnit = "week" | "month" | "year";

/** Total spent per week (12 last), month (12 last) or year (all), oldest first. */
export function spendingBuckets(transactions: Transaction[], unit: SpendUnit, now = new Date()): { key: string; date: Date; cents: number }[] {
  const spending = transactions.filter(isSpending);
  const startOf = (d: Date) => {
    if (unit === "year") return new Date(d.getFullYear(), 0, 1);
    if (unit === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    return monday;
  };
  const step = (d: Date, n: number) =>
    unit === "year" ? new Date(d.getFullYear() + n, 0, 1) : unit === "month" ? new Date(d.getFullYear(), d.getMonth() + n, 1) : new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n);

  const current = startOf(now);
  const oldest = spending.length ? startOf(new Date(Math.min(...spending.map((t) => t.date.getTime())))) : current;
  // Twelve weeks or months back at most, but never before the first known expense.
  let first = unit === "year" ? oldest : step(current, -11);
  if (oldest > first) first = oldest;

  const buckets: { key: string; date: Date; cents: number }[] = [];
  for (let d = first; d <= current; d = step(d, 1)) {
    const end = step(d, 1);
    buckets.push({ key: dayKey(d), date: d, cents: spending.filter((t) => t.date >= d && t.date < end).reduce((sum, t) => sum - t.amountCents, 0) });
  }
  return buckets;
}
