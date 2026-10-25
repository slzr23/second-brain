import type { BalancePoint } from "../import/history";
import type { ImportedTransaction } from "../import/types";

/** Client-side shapes of the Firestore documents (see README > Modèle de données). */

export type EntryKind = "dream" | "note";

export interface Entry {
  id: string;
  kind: EntryKind;
  text: string;
  tags: string[];
  createdAt: Date;
}

export interface DreamReport {
  weekId: string;
  summary: string;
  themes: { name: string; count: number }[];
}

export const NECESSITIES = ["essentiel", "social", "superflu"] as const;
export type Necessity = (typeof NECESSITIES)[number];
export const NECESSITY_LABEL: Record<Necessity, string> = {
  essentiel: "Essentiel",
  social: "Social",
  superflu: "Superflu",
};

export interface Transaction {
  id: string;
  /** Signed: negative for money going out. */
  amountCents: number;
  date: Date;
  label: string;
  merchant: string | null;
  necessity: Necessity | null;
  source: "manual" | "apple_pay" | "bank";
  /** Bank account it comes from, for imported lines ("Compte courant"). */
  account: string | null;
  /** Money moved between your own accounts: never counted as spending or income. */
  transfer: "savings" | "internal" | null;
  bankCategory: string | null;
}

/** Spending and income ignore money that only moves between your own accounts. */
export const isSpending = (t: Transaction) => t.amountCents < 0 && !t.transfer;
export const isIncome = (t: Transaction) => t.amountCents > 0 && !t.transfer;

export interface NewTransaction {
  amountCents: number;
  label: string;
  necessity: Necessity | null;
}

/** A market quote a holding can follow (Yahoo Finance symbols). */
export const TRACKERS = [
  { symbol: "AIR.PA", label: "Action Airbus" },
  { symbol: "BTC-EUR", label: "Bitcoin" },
  { symbol: "ETH-EUR", label: "Ether" },
] as const;

/**
 * Crypto quoted in euros: the unit price is the quote itself. Other trackers (a fund
 * following a share) keep their own price and only move with the quote's variation.
 */
export const isDirectTracker = (symbol: string) => /-EUR$/.test(symbol);

export const trackerFor = (symbol: string | null, unitPrice: number) =>
  symbol ? { symbol, baseUnitPrice: unitPrice, baseQuote: isDirectTracker(symbol) ? unitPrice : null } : null;

/** A savings account or an investment line: Livret A, a PEE fund, some bitcoin… */
export interface Holding {
  id: string;
  /** Where it is held: "PEE Amundi", "Crypto", "Livret A"… */
  group: string;
  name: string;
  /** 1 for a plain balance (then unitPrice is the balance). */
  units: number;
  /** Euros per unit. */
  unitPrice: number;
  priceDate: Date | null;
  priceSource: "manual" | "auto";
  tracker: { symbol: string; baseUnitPrice: number; baseQuote: number | null } | null;
  /** Imported accounts and crypto: end-of-month values rebuilt from the history. */
  history: BalancePoint[];
  /** Euros put in minus taken out, when known: shows the gain. */
  investedCents: number | null;
}

/** A holding computed by an import (a crypto platform, a bank account). */
export interface ComputedHolding {
  group: string;
  name: string;
  units: number;
  unitPrice: number;
  trackerSymbol: string | null;
  investedCents: number | null;
  history: BalancePoint[];
}

/** Id of the holding that carries a bank account's balance ("Livret A" → "account_livret-a"). */
export const accountHoldingId = (account: string) =>
  `account_${account
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

export interface HoldingInput {
  group: string;
  name: string;
  units: number;
  unitPrice: number;
  trackerSymbol: string | null;
}

export const holdingValueCents = (h: Pick<Holding, "units" | "unitPrice">) => Math.round(h.units * h.unitPrice * 100);

export interface Activity {
  id: string;
  name: string;
  date: Date;
  distanceM: number;
  durationS: number;
  avgHr: number | null;
  /** Seconds per km. */
  paceSecKm: number;
  report: { summary: string } | null;
}

export interface WeekStats {
  volumeKm: number;
  goalKm: number;
  runs: number;
  durationS: number;
  avgRestHr: number | null;
  /** Kilometres run each day, Monday first. */
  byDayKm: number[];
  /** Seconds spent in Z1…Z5. */
  timeInZones: number[];
}

export interface DataSource {
  loading: boolean;
  entries: Entry[];
  dreamReport: DreamReport | null;
  transactions: Transaction[];
  activities: Activity[];
  week: WeekStats | null;
  holdings: Holding[];
  addEntry(kind: EntryKind, text: string): Promise<void>;
  addTransaction(transaction: NewTransaction): Promise<void>;
  tagTransaction(id: string, necessity: Necessity): Promise<void>;
  /** Creates the holding when `id` is null. */
  saveHolding(id: string | null, input: HoldingInput): Promise<void>;
  /** First and last name of the account holder, used to spot transfers to yourself. */
  ownerName: string | null;
  /** Ids of the lines already stored for this account, to import only new ones. */
  existingTransactionIds(account: string): Promise<Set<string>>;
  importTransactions(items: ImportedTransaction[], onProgress?: (done: number) => void): Promise<void>;
  /** Stores a bank account's balance and its history in Patrimoine. */
  saveAccountBalance(account: string, balanceCents: number, history: BalancePoint[]): Promise<void>;
  /** Every stored movement of a bank account (not only the recent ones), to rebuild its balance history. */
  accountMovements(account: string): Promise<{ date: Date; amountCents: number }[]>;
  /** Creates or replaces a holding computed by an import, under a stable id. */
  saveComputedHolding(id: string, holding: ComputedHolding): Promise<void>;
  deleteHolding(id: string): Promise<void>;
  /** Removes an account everywhere: its lines in Patrimoine and its imported movements. */
  deleteAccount(name: string): Promise<void>;
}
