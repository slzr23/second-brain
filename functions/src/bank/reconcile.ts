import { localDateKey } from "../lib/week";
import type { BankLine, Necessity } from "./map";

const DAY = 86_400_000;

/** A transaction already stored, as much of it as the sync needs. */
export interface StoredLine {
  id: string;
  date: Date;
  amountCents: number;
  source: "manual" | "apple_pay" | "bank";
  account: string | null;
  label: string;
  necessity: Necessity | null;
}

/**
 * Lines the CSV import already brought in, under their own ids: same account and
 * amount, dated within 3 days (the export and the API do not use the same date).
 * Each stored line covers one synced line at most.
 */
export function alreadyImported(lines: BankLine[], stored: StoredLine[]): Set<string> {
  const ids = new Set(stored.map((s) => s.id));
  const csv = stored.filter((s) => s.source === "bank" && !s.id.startsWith("eb_"));
  const used = new Set<string>();
  const covered = new Set<string>();
  for (const line of [...lines].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (ids.has(line.id)) continue;
    let best: StoredLine | null = null;
    let bestGap = Infinity;
    for (const s of csv) {
      if (used.has(s.id) || s.account !== line.account || s.amountCents !== line.amountCents) continue;
      const gap = Math.abs(s.date.getTime() - line.date.getTime());
      if (gap <= 3 * DAY && gap < bestGap) {
        best = s;
        bestGap = gap;
      }
    }
    if (best) {
      used.add(best.id);
      covered.add(line.id);
    }
  }
  return covered;
}

/**
 * Same rule as the CSV import (web/src/import/reconcile.ts): an Apple Pay payment, or
 * a line typed in the app (an expense or money received), with the same amount, booked from the day before to 5 days after,
 * the closest in time. Returns bank line id → app entry.
 */
export function matchAppEntries(lines: BankLine[], stored: StoredLine[]): Map<string, StoredLine> {
  const candidates = stored.filter((t) => (t.source === "apple_pay" || t.source === "manual") && !t.account && t.amountCents !== 0);
  const used = new Set<string>();
  const matches = new Map<string, StoredLine>();
  for (const line of [...lines].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (line.transfer) continue;
    let best: StoredLine | null = null;
    let bestGap = Infinity;
    for (const t of candidates) {
      if (used.has(t.id) || t.amountCents !== line.amountCents) continue;
      const lag = line.date.getTime() - t.date.getTime();
      if (lag < -DAY || lag > 5 * DAY) continue;
      if (Math.abs(lag) < bestGap) {
        best = t;
        bestGap = Math.abs(lag);
      }
    }
    if (best) {
      used.add(best.id);
      matches.set(line.id, best);
    }
  }
  return matches;
}

/** Merchant name as compared between lines: "Lyovel Sas" and "LYOVEL SAS" are the same. */
const merchantKey = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

/**
 * A merchant already sorted keeps its category: the latest one given to a line
 * with the same label. Transfers and income are never sorted.
 */
export function sortLikeBefore(lines: BankLine[], stored: StoredLine[]): BankLine[] {
  const known = new Map<string, Necessity>();
  for (const s of [...stored].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (s.necessity && s.amountCents < 0) known.set(merchantKey(s.label), s.necessity);
  }
  return lines.map((l) => (l.necessity || l.transfer || l.amountCents >= 0 ? l : { ...l, necessity: known.get(merchantKey(l.label)) ?? null }));
}

/** The bank line keeps its booking; the app entry brings what you said about it. */
export const mergeAppEntry = (line: BankLine, entry: StoredLine): BankLine => ({
  ...line,
  label: entry.label || line.label,
  necessity: entry.necessity ?? line.necessity,
});

// ---- Balance history, as in web/src/import/history.ts (Paris months) -------------

export interface BalancePoint {
  month: string;
  cents: number;
}

const monthKey = (d: Date) => localDateKey(d).slice(0, 7);

/** Walks back from today's balance, undoing each movement: one point per month. */
export function monthlyBalances(items: { date: Date; amountCents: number }[], balanceCents: number, now = new Date()): BalancePoint[] {
  const current = monthKey(now);
  if (items.length === 0) return [{ month: current, cents: balanceCents }];
  const sorted = [...items].sort((a, b) => b.date.getTime() - a.date.getTime());
  const oldest = monthKey(sorted[sorted.length - 1].date);

  const points: BalancePoint[] = [];
  let balance = balanceCents;
  let i = 0;
  let [y, m] = current.split("-").map(Number);
  for (let month = current; month >= oldest; ) {
    while (i < sorted.length && monthKey(sorted[i].date) > month) balance -= sorted[i++].amountCents;
    points.push({ month, cents: balance });
    m -= 1;
    if (m === 0) [y, m] = [y - 1, 12];
    month = `${y}-${String(m).padStart(2, "0")}`;
  }
  return points.reverse();
}

export function mergeHistory(previous: BalancePoint[], next: BalancePoint[]): BalancePoint[] {
  const byMonth = new Map(previous.map((p) => [p.month, p.cents]));
  for (const p of next) byMonth.set(p.month, p.cents);
  return [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([month, cents]) => ({ month, cents }));
}

/** Same id as web/src/data/types.ts: "Livret A" → "account_livret-a". */
export const accountHoldingId = (account: string) =>
  `account_${account
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
