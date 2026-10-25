/** End-of-month balance of an account: "2025-11" → cents. */
export interface BalancePoint {
  month: string;
  cents: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * Rebuilds an account's balance over time from its movements and today's balance:
 * walking back from now, each movement is undone. Returns one point per month,
 * from the month of the oldest movement to the current month, in order.
 */
export function monthlyBalances(items: { date: Date; amountCents: number }[], balanceCents: number, now = new Date()): BalancePoint[] {
  if (items.length === 0) return [{ month: monthKey(now), cents: balanceCents }];
  const sorted = [...items].sort((a, b) => b.date.getTime() - a.date.getTime());
  const oldest = sorted[sorted.length - 1].date;

  const points: BalancePoint[] = [];
  let balance = balanceCents;
  let i = 0;
  // Month cursor starting at the current month, going back to the oldest one.
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  const stop = new Date(oldest.getFullYear(), oldest.getMonth(), 1);
  while (cursor >= stop) {
    const endOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    // Undo everything that happened after this month ended.
    while (i < sorted.length && sorted[i].date >= endOfMonth) balance -= sorted[i++].amountCents;
    points.push({ month: monthKey(cursor), cents: balance });
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return points.reverse();
}

/** Keeps older months from a previous import, and takes the new values where both exist. */
export function mergeHistory(previous: BalancePoint[], next: BalancePoint[]): BalancePoint[] {
  const byMonth = new Map(previous.map((p) => [p.month, p.cents]));
  for (const p of next) byMonth.set(p.month, p.cents);
  return [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([month, cents]) => ({ month, cents }));
}
