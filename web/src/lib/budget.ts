import { holdingValueCents, isIncome, type Category, type Holding, type Transaction } from "../data/types";

/**
 * The current account, read the way it is lived: a month runs from one salary to
 * the next (around the 27th), with what came in, where it went, what repeats and
 * what deserves a look. Everything here is pure, so it is unit-tested.
 */

export const CURRENT_ACCOUNT = "Compte courant";
/** Usual pay day, used until the salary of the month has actually arrived. */
export const PAYDAY = 27;

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Lines of the current account: bank lines filed under it, plus what you entered in the app. */
export const inCurrentAccount = (t: Transaction) => !t.account || t.account === CURRENT_ACCOUNT;

/* ---------------------------------- Income ----------------------------------- */

export const INCOME_KINDS = ["salaire", "aides", "remboursements", "autres"] as const;
export type IncomeKind = (typeof INCOME_KINDS)[number];
export const INCOME_LABEL: Record<IncomeKind, string> = {
  salaire: "Salaire",
  aides: "Aides",
  remboursements: "Virements reçus",
  autres: "Autres entrées",
};

const SALARY = /salaire|\bpaie\b|remuneration|apprenti/;
const AIDS = /\bcaf\b|allocation|\bapl\b|prime d.?activite|action logement|\bcpam\b|ameli|france travail|pole emploi|\bbourse\b/;
/** A bank giving back its own fee: it cancels the fee, it is not income. */
const FEE_REFUND = /remise cotis|rem offre|ristourne|remboursement (de )?frais/;

export const isFeeRefund = (t: Transaction) => t.amountCents > 0 && !t.transfer && FEE_REFUND.test(normalize(`${t.label} ${t.merchant ?? ""}`));

const fromPerson = (t: Transaction) => /^(m|mr|mme|ml|m\.)\s/.test(normalize(t.label));

const payersCache = new WeakMap<Transaction[], Set<string>>();
/**
 * Who pays a salary without saying so: a company (not a person, not an allowance)
 * that sends at least 300 € at the end of the month, three months or more.
 */
export function salaryPayers(transactions: Transaction[]): Set<string> {
  const cached = payersCache.get(transactions);
  if (cached) return cached;
  const months = new Map<string, Set<string>>();
  for (const t of transactions) {
    if (t.amountCents < 30_000 || t.transfer || fromPerson(t) || !inCurrentAccount(t)) continue;
    if (AIDS.test(normalize(`${t.label} ${t.merchant ?? ""}`))) continue;
    const day = t.date.getDate();
    if (day < 20 && day > 3) continue;
    const key = merchantKey(t);
    const owner = day >= 20 ? `${t.date.getFullYear()}-${t.date.getMonth()}` : `${t.date.getFullYear()}-${t.date.getMonth() - 1}`;
    months.set(key, (months.get(key) ?? new Set()).add(owner));
  }
  const payers = new Set([...months].filter(([, m]) => m.size >= 3).map(([k]) => k));
  payersCache.set(transactions, payers);
  return payers;
}

/** What an incoming payment is: the salary, an allowance, someone paying you back… */
export function incomeKind(t: Transaction, payers: Set<string> = new Set()): IncomeKind {
  const text = normalize(`${t.label} ${t.merchant ?? ""} ${t.bankCategory ?? ""}`);
  if (SALARY.test(text) || /\bsalaires?\b/.test(text)) return "salaire";
  if (AIDS.test(text) || /aides et allocations/.test(text)) return "aides";
  if (t.amountCents >= 30_000 && payers.has(merchantKey(t))) return "salaire";
  return t.amountCents >= 30_000 && /\bvir(ement)?\b/.test(text) && !fromPerson(t) ? "autres" : "remboursements";
}

/** Money that came in, without transfers between your accounts or banks refunding their own fees. */
export const isEarned = (t: Transaction) => isIncome(t) && !isFeeRefund(t);

/* ------------------------------- Pay periods --------------------------------- */

export interface Period {
  start: Date;
  /** Exclusive: the start of the next period. */
  end: Date;
}

/**
 * Where each month's pay period starts: the day the salary actually arrived
 * (banks pay earlier when the 27th is a weekend), or the 27th when it is unknown.
 * A salary paid early in a month belongs to the previous month's period.
 */
function anchors(transactions: Transaction[]): Map<string, Date> {
  const byMonth = new Map<string, Date>();
  const payers = salaryPayers(transactions);
  for (const t of transactions) {
    if (!isEarned(t) || t.amountCents < 30_000 || incomeKind(t, payers) !== "salaire") continue;
    const d = startOfDay(t.date);
    const owner = d.getDate() >= 15 ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const key = `${owner.getFullYear()}-${owner.getMonth()}`;
    const known = byMonth.get(key);
    if (!known || d < known) byMonth.set(key, d);
  }
  return byMonth;
}

const anchorOf = (known: Map<string, Date>, year: number, month: number) => {
  const first = new Date(year, month, 1);
  return known.get(`${first.getFullYear()}-${first.getMonth()}`) ?? new Date(first.getFullYear(), first.getMonth(), PAYDAY);
};

/** The last `count` pay periods, oldest first; the last one is the period in progress. */
export function payPeriods(transactions: Transaction[], count: number, now = new Date()): Period[] {
  const known = anchors(transactions);
  // The period in progress started at this month's anchor if it has passed, else at last month's.
  let y = now.getFullYear();
  let m = now.getMonth();
  if (anchorOf(known, y, m) > now) m -= 1;
  return Array.from({ length: count }, (_, i) => {
    const k = m - (count - 1 - i);
    return { start: anchorOf(known, y, k), end: anchorOf(known, y, k + 1) };
  });
}

const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
/** "27 oct. → 26 nov." */
export const periodLabel = (p: Period) => `${shortDate.format(p.start)} → ${shortDate.format(new Date(p.end.getTime() - DAY))}`;

const inPeriod = (t: Transaction, p: Period) => t.date >= p.start && t.date < p.end;

/* -------------------------------- Summaries ---------------------------------- */

export type CategoryKey = Category | "none";

export interface PeriodSummary {
  period: Period;
  earnedCents: number;
  earnedByKind: Record<IncomeKind, number>;
  /** Positive cents, net of the bank refunding its own fees. */
  spentCents: number;
  byCategory: Partial<Record<CategoryKey, number>>;
  /** Put on savings accounts, minus what was taken back from them. */
  savedCents: number;
  transactions: Transaction[];
}

const FEES = /commission|frais|agios|interets? debiteur|com cb int|cotisation/;
const isFee = (t: Transaction) => t.amountCents < 0 && !t.transfer && FEES.test(normalize(`${t.label} ${t.merchant ?? ""}`));

export function summarize(transactions: Transaction[], period: Period): PeriodSummary {
  const list = transactions.filter((t) => inCurrentAccount(t) && inPeriod(t, period));
  const earnedByKind: Record<IncomeKind, number> = { salaire: 0, aides: 0, remboursements: 0, autres: 0 };
  const byCategory: Partial<Record<CategoryKey, number>> = {};
  let spent = 0;
  let saved = 0;
  const payers = salaryPayers(transactions);
  // Fees and their refunds land in the same category, so a refunded fee nets to zero.
  const feeCategory = list.find(isFee)?.category ?? "autres";

  for (const t of list) {
    if (t.transfer === "savings") saved -= t.amountCents;
    else if (t.transfer) continue;
    else if (isFeeRefund(t)) {
      spent -= t.amountCents;
      byCategory[feeCategory] = (byCategory[feeCategory] ?? 0) - t.amountCents;
    } else if (t.amountCents > 0) earnedByKind[incomeKind(t, payers)] += t.amountCents;
    else {
      spent -= t.amountCents;
      const key: CategoryKey = t.category ?? "none";
      byCategory[key] = (byCategory[key] ?? 0) - t.amountCents;
    }
  }
  for (const key of Object.keys(byCategory) as CategoryKey[]) if ((byCategory[key] ?? 0) <= 0) delete byCategory[key];

  return {
    period,
    earnedCents: Object.values(earnedByKind).reduce((a, b) => a + b, 0),
    earnedByKind,
    spentCents: Math.max(0, spent),
    byCategory,
    savedCents: saved,
    transactions: list,
  };
}

/** "+12 %" against the previous value; null when there is nothing to compare with. */
export const changePct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** Average over complete periods (the one in progress, and any only partly imported, are left out). */
export function averages(summaries: PeriodSummary[], transactions: Transaction[] = []) {
  // A period that started before the oldest known line is only partly known: left out.
  const oldest = transactions.filter(inCurrentAccount).reduce<Date | null>((min, t) => (!min || t.date < min ? t.date : min), null);
  const done = summaries.slice(0, -1).filter((s) => s.transactions.length > 0 && (!oldest || s.period.start >= startOfDay(oldest)));
  const n = done.length || 1;
  const byCategory: Partial<Record<CategoryKey, number>> = {};
  for (const s of done) for (const [k, v] of Object.entries(s.byCategory) as [CategoryKey, number][]) byCategory[k] = (byCategory[k] ?? 0) + v / n;
  return {
    periods: done.length,
    earnedCents: Math.round(done.reduce((a, s) => a + s.earnedCents, 0) / n),
    spentCents: Math.round(done.reduce((a, s) => a + s.spentCents, 0) / n),
    byCategory,
  };
}

/* ----------------------------- Recurring spending ---------------------------- */

/** "CB NETFLIX.COM FACT 221026" and "NETFLIX.COM" are the same merchant. */
export function merchantKey(t: Pick<Transaction, "label" | "merchant">): string {
  return normalize(t.merchant || t.label)
    .replace(/^(cb|carte|prlv( sepa)?|prelevement|vir(ement)?( sepa)?( vers)?|paiement)\s+/g, "")
    .replace(/\bfact\s*\d+/g, "")
    .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, "")
    .replace(/[^a-z ]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");
}

export interface Recurring {
  key: string;
  label: string;
  category: Category | null;
  /** Last amount, positive. */
  amountCents: number;
  /** Amount before it went up, when it did. */
  previousCents: number | null;
  /** Usual day of the month. */
  day: number;
  lastDate: Date;
  /** Next expected debit. */
  next: Date;
  yearlyCents: number;
  necessity: Transaction["necessity"];
}

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Payments that come back every month for about the same amount: rent, phone,
 * subscriptions, bank package… Seen in at least 3 of the last 4 months, about once
 * a month. One merchant can hold several (two subscriptions billed by Apple).
 */
export function recurringSpending(transactions: Transaction[], now = new Date()): Recurring[] {
  const since = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const spending = transactions.filter((t) => inCurrentAccount(t) && t.amountCents < 0 && !t.transfer && t.date >= since && t.date <= now);
  const byKey = new Map<string, Transaction[]>();
  for (const t of spending) {
    const key = merchantKey(t);
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), t]);
  }

  const found: Recurring[] = [];
  for (const [key, list] of byKey) {
    // Split one merchant into amount clusters (2,99 € and 9,99 € at Apple are two things).
    const clusters: Transaction[][] = [];
    for (const t of [...list].sort((a, b) => b.amountCents - a.amountCents)) {
      // Smallest first, so each cluster grows upward by at most 25 %.
      const last = clusters[clusters.length - 1];
      if (last && Math.abs(t.amountCents) <= Math.abs(median(last.map((x) => x.amountCents))) * 1.25) last.push(t);
      else clusters.push([t]);
    }
    for (const cluster of clusters) {
      const months = new Set(cluster.map((t) => `${t.date.getFullYear()}-${t.date.getMonth()}`));
      if (months.size < 3 || cluster.length > months.size * 1.5) continue;
      // A subscription costs the same (±10 %) on about the same day; shopping does not.
      const amounts = cluster.map((t) => -t.amountCents);
      const mid = median(amounts);
      if (amounts.some((a) => Math.abs(a - mid) > mid * 0.1)) continue;
      const days = cluster.map((t) => t.date.getDate());
      const spread = Math.max(...days) - Math.min(...days);
      if (spread > 6 && spread < 25) continue; // 30th → 2nd wraps around the month end
      const byDate = [...cluster].sort((a, b) => a.date.getTime() - b.date.getTime());
      const last = byDate[byDate.length - 1];
      // A bank package the bank gives back each month costs nothing: not listed.
      const refunded = transactions.some((t) => isFeeRefund(t) && t.amountCents === -last.amountCents && Math.abs(t.date.getTime() - last.date.getTime()) <= 3 * DAY);
      if (refunded) continue;
      const before = byDate[byDate.length - 2];
      const amount = -last.amountCents;
      const day = median(cluster.map((t) => t.date.getDate()));
      const paidThisMonth = last.date.getFullYear() === now.getFullYear() && last.date.getMonth() === now.getMonth();
      let next = new Date(now.getFullYear(), now.getMonth() + (paidThisMonth ? 1 : 0), day);
      if (next < startOfDay(now)) next = new Date(now.getFullYear(), now.getMonth() + 1, day);
      found.push({
        key: `${key}:${Math.round(amount / 100)}`,
        label: last.merchant || last.label,
        category: last.category,
        amountCents: amount,
        previousCents: before && amount - -before.amountCents >= Math.max(50, -before.amountCents * 0.03) ? -before.amountCents : null,
        day,
        lastDate: last.date,
        next,
        yearlyCents: amount * 12,
        necessity: last.necessity,
      });
    }
  }
  return found.sort((a, b) => b.amountCents - a.amountCents);
}

/* ---------------------------- Left before payday ----------------------------- */

export interface Runway {
  /** Balance today, null when the account balance is unknown. */
  balanceCents: number | null;
  upcoming: Recurring[];
  upcomingCents: number;
  leftCents: number | null;
  payday: Date;
  daysToPayday: number;
}

/**
 * What is left until the next salary: today's balance (last synced balance, minus
 * what you paid since and entered in the app) minus the recurring debits still
 * expected before payday.
 */
export function runway(holdings: Holding[], transactions: Transaction[], recurring: Recurring[], period: Period, now = new Date()): Runway {
  const account = holdings.filter((h) => h.group === CURRENT_ACCOUNT);
  let balance: number | null = null;
  if (account.length) {
    balance = account.reduce((sum, h) => sum + holdingValueCents(h), 0);
    const asOf = account[0].priceDate;
    if (asOf) for (const t of transactions) if (!t.account && t.source !== "bank" && t.date > asOf && !t.transfer) balance += t.amountCents;
  }
  const upcoming = recurring.filter((r) => r.next > now && r.next < period.end);
  const upcomingCents = upcoming.reduce((sum, r) => sum + r.amountCents, 0);
  return {
    balanceCents: balance,
    upcoming,
    upcomingCents,
    leftCents: balance === null ? null : balance - upcomingCents,
    payday: period.end,
    daysToPayday: Math.max(0, Math.ceil((period.end.getTime() - now.getTime()) / DAY)),
  };
}

/* ------------------------------ Things to watch ------------------------------ */

export interface Alert {
  kind: "fees" | "duplicate" | "rising" | "overdraft";
  title: string;
  detail: string;
  cents: number;
}

const FEE_KINDS: [RegExp, string][] = [
  [/commission intervention|commission d.?intervention/, "commissions d'intervention (découvert)"],
  [/com cb int|etranger|change/, "frais de carte à l'étranger ou en devise"],
  [/interets? debiteur|agios/, "intérêts de découvert"],
];

/**
 * What a careful look at the account would point out: bank fees that add up,
 * a payment taken twice, a subscription that went up, an overdraft coming.
 */
export function alerts(transactions: Transaction[], recurring: Recurring[], run: Runway, now = new Date()): Alert[] {
  const out: Alert[] = [];
  const account = transactions.filter(inCurrentAccount);

  if (run.leftCents !== null && run.leftCents < 0) {
    out.push({
      kind: "overdraft",
      title: "Découvert probable avant la paie",
      detail: `Il manquera environ ${euros(-run.leftCents)} après les prélèvements prévus. Un virement depuis le Livret A éviterait les commissions.`,
      cents: run.leftCents,
    });
  }

  // Fees over the last 12 months, net of what the bank gave back.
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const fees = account.filter((t) => isFee(t) && t.date >= yearAgo);
  const refunds = account.filter((t) => isFeeRefund(t) && t.date >= yearAgo).reduce((s, t) => s + t.amountCents, 0);
  const totalFees = fees.reduce((s, t) => s - t.amountCents, 0) - refunds;
  if (totalFees >= 500) {
    // What kind of fees, when the bank says so; else by label ("Frais bancaires"…).
    let parts = FEE_KINDS.map(([re, name]) => {
      const cents = fees.filter((t) => re.test(normalize(`${t.label} ${t.merchant ?? ""}`))).reduce((s, t) => s - t.amountCents, 0);
      return cents > 0 ? `${euros(cents)} de ${name}` : null;
    }).filter(Boolean) as string[];
    if (!parts.length) {
      const byLabel = new Map<string, number>();
      for (const t of fees) byLabel.set(t.label, (byLabel.get(t.label) ?? 0) - t.amountCents);
      // Refunds cancel the package fee they answer.
      const package_ = [...byLabel.keys()].find((l) => /cotis/.test(normalize(l)));
      if (package_) byLabel.set(package_, byLabel.get(package_)! - refunds);
      parts = [...byLabel]
        .filter(([, c]) => c > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([l, c]) => `${l} : ${euros(c)}`);
    }
    out.push({
      kind: "fees",
      title: `${euros(totalFees)} de frais bancaires en 12 mois`,
      detail: `${parts.join(" · ")}. Les commissions viennent souvent d'un découvert, les petits frais de paiements à l'étranger ou en dollars.`,
      cents: -totalFees,
    });
  }

  // Same merchant, same amount, within 2 days: maybe charged twice.
  const recent = account.filter((t) => t.amountCents <= -500 && !t.transfer && now.getTime() - t.date.getTime() < 45 * DAY);
  const seen = new Set<string>();
  for (const a of recent) {
    for (const b of recent) {
      if (a.id >= b.id || a.amountCents !== b.amountCents || merchantKey(a) !== merchantKey(b)) continue;
      if (Math.abs(a.date.getTime() - b.date.getTime()) > 2 * DAY || seen.has(a.id) || seen.has(b.id)) continue;
      seen.add(a.id).add(b.id);
      out.push({
        kind: "duplicate",
        title: `Payé deux fois ? ${a.merchant || a.label}`,
        detail: `${euros(-a.amountCents)} débités le ${shortDate.format(a.date)} et le ${shortDate.format(b.date)}`,
        cents: a.amountCents,
      });
    }
  }

  for (const r of recurring.filter((r) => r.previousCents !== null)) {
    out.push({
      kind: "rising",
      title: `${r.label} a augmenté`,
      detail: `${euros(r.previousCents!)} → ${euros(r.amountCents)} par mois, soit ${euros((r.amountCents - r.previousCents!) * 12)} de plus par an.`,
      cents: -(r.amountCents - r.previousCents!),
    });
  }
  return out;
}

const euroFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const euros = (cents: number) => euroFmt.format(cents / 100);
