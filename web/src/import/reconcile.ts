import type { Transaction } from "../data/types";
import type { ImportedTransaction } from "./types";

const DAY = 86_400_000;

/**
 * Finds, for bank lines, the same spending already entered in the app: an Apple
 * Pay payment caught by the Wallet automation, or an expense typed with the
 * Action Button. Same amount, and the bank books it from the day before (time
 * zones) to 5 days after. Each app entry matches one bank line at most, the
 * closest in time.
 */
export function matchAppEntries(bankItems: ImportedTransaction[], transactions: Transaction[]): Map<string, Transaction> {
  const candidates = transactions.filter((t) => (t.source === "apple_pay" || t.source === "manual") && !t.account && t.amountCents < 0);
  const used = new Set<string>();
  const matches = new Map<string, Transaction>();

  for (const item of [...bankItems].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (item.transfer || item.amountCents >= 0) continue;
    let best: Transaction | null = null;
    let bestGap = Infinity;
    for (const t of candidates) {
      if (used.has(t.id) || t.amountCents !== item.amountCents) continue;
      const lag = item.date.getTime() - t.date.getTime();
      if (lag < -DAY || lag > 5 * DAY) continue;
      if (Math.abs(lag) < bestGap) {
        best = t;
        bestGap = Math.abs(lag);
      }
    }
    if (best) {
      used.add(best.id);
      matches.set(item.id, best);
    }
  }
  return matches;
}

/**
 * The bank line takes over: it has the exact booking and the stable id, while
 * the app entry brings what you said about it (its label and its category).
 */
export function mergeAppEntry(item: ImportedTransaction, entry: Transaction): ImportedTransaction {
  return { ...item, label: entry.label || item.label, necessity: entry.necessity ?? item.necessity };
}
