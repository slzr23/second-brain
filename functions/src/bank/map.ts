import { createHash } from "node:crypto";
import type { ApiAccount, ApiBalance, ApiTransaction } from "./client";

export type Necessity = "essentiel" | "social" | "superflu";
export type TransferKind = "savings" | "internal";

/**
 * One bank line, stored in users/{uid}/transactions/{id} with source "bank",
 * exactly like a line imported from a CSV export (web/src/import/types.ts).
 */
export interface BankLine {
  id: string;
  account: string;
  date: Date;
  label: string;
  amountCents: number;
  bankCategory: string | null;
  bankSubcategory: string | null;
  operationType: string | null;
  transfer: TransferKind | null;
  necessity: Necessity | null;
}

/** A linked account and the name it has in the app ("Compte courant", "Livret A"). */
export interface LinkedAccount {
  uid: string;
  iban: string | null;
  account: string;
}

export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/** The app files lines under the account names used by the CSV import. */
export function accountName(a: ApiAccount): string {
  const text = normalize(`${a.name ?? ""} ${a.product ?? ""}`);
  if (/LIVRET A\b/.test(text)) return "Livret A";
  if (a.cash_account_type === "CACC" || /COMPTE (COURANT|CHEQUE|DE DEPOT)/.test(text)) return "Compte courant";
  return (a.product || a.name || "Compte").trim();
}

/** Same id as `stableId` in the web import: prefix and the first 24 hex of a SHA-1. */
const stableId = (prefix: string, key: string) => `${prefix}_${createHash("sha1").update(key).digest("hex").slice(0, 24)}`;

/** "12.50" → 1250, without floating point surprises. */
export function amountToCents(amount: string): number {
  const [int, frac = ""] = amount.replace("-", "").split(".");
  return Number(int) * 100 + Number((frac + "00").slice(0, 2));
}

/** Calendar day at midday UTC: stays on the same day in Paris. */
const dayToDate = (day: string) => new Date(`${day}T12:00:00Z`);

/**
 * A card payment is booked days after the purchase; the purchase day is only in
 * the text, "… FACT 081026 …" (dd mm yy). The CSV export dates lines by it too.
 */
export function purchaseDay(text: string, booked: string): string | null {
  const m = /\bFACT\s+(\d{2})(\d{2})(\d{2})\b/.exec(text);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const day = `20${yy}-${mm}-${dd}`;
  const t = Date.parse(`${day}T12:00:00Z`);
  // Sanity: a real date, up to 45 days before the booking.
  const gap = (Date.parse(`${booked}T12:00:00Z`) - t) / 86_400_000;
  return Number.isFinite(t) && gap >= 0 && gap <= 45 ? day : null;
}

/** Card, transfer and direct debit prefixes the bank puts before the merchant. */
const PREFIXES = /^(CB|CARTE|PAIEMENT (PAR )?CB|PRLV( SEPA)?|VIR( SEPA| INST| INSTANTANE)*( RECU| EMIS)?|VIREMENT( SEPA)?( RECU| EMIS)?|RETRAIT( DAB)?)\b[\s:]*/;
/** Card details after the merchant: "FACT 051126 344336******6", "05/11", "CARTE 1234". */
const SUFFIXES = /(\s+FACT\s+\d{6}\b.*|\s+(CARTE|DU)\s*\S*|\s+\d{2}\/\d{2}(\/\d{2,4})?|\s+[X*\d]*[X*]{2,}[X*\d]*)+$/;

/** "CB CARREFOUR CITY FACT 051126 344336******6" → "Carrefour City". */
export function cleanLabel(raw: string): string {
  const core =
    normalize(raw)
      .replace(PREFIXES, "")
      .replace(SUFFIXES, "")
      .replace(/^[*\s]+/, "")
      .trim() || normalize(raw);
  return core
    .toLowerCase()
    .replace(/(^|[\s'(/-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase())
    .replace(/\b(Sncf|Ratp|Edf|Caf|Cpam|Sfr|Ds|Slc)\b/g, (w) => w.toUpperCase());
}

/** Kind of operation in the words of the CSV export, for the rules shared with it. */
function operationType(text: string, code: string | null): string | null {
  if (/^(VIR|VIREMENT)\b/.test(text)) return "VIREMENT";
  if (/^PRLV\b/.test(text)) return "PRELEVEMENT";
  if (/^(CB|CARTE|PAIEMENT)\b/.test(text)) return "CARTE";
  if (/^RETRAIT\b/.test(text)) return "RETRAIT";
  if (/^(FRAIS|COTIS|COMMISSION)\b/.test(text)) return "FRAIS";
  return code ? normalize(code) : null;
}

// ---- Rules kept in step with web/src/import/classify.ts --------------------------

const SAVINGS = /\bLIVRET\b|CPT DEPOT PART|\bLDDS?\b|\bPEL\b|BITSTACK|BOURSORAMA|AMUNDI|TRADE REPUBLIC|\bPEA\b/;
const OWN_ACCOUNTS = /\bREVOLUT\b/;
const FRIENDS = /\bWERO\b|\bLYDIA\b|\bPAYLIB\b/;
/** A loan paid out ("BPCE FINANCEMENT"): borrowed money, not income. */
const LOAN = /\bFINANCEMENT\b|\bDEBLOCAGE\b|\bDECAISSEMENT PRET\b/;

function hasAllWords(label: string, name: string): boolean {
  const words = normalize(name)
    .split(/[^A-Z]+/)
    .filter((w) => w.length >= 3);
  return words.length > 0 && words.every((w) => new RegExp(`\\b${w}\\b`).test(label));
}

export interface ClassifyContext {
  ownerName: string | null;
  /** IBANs of the linked accounts, with their app name. */
  ownIbans: Map<string, string>;
}

function detectTransfer(text: string, type: string | null, counterpartIban: string | null, ctx: ClassifyContext, amountCents: number): TransferKind | null {
  if (amountCents > 0 && LOAN.test(text)) return "internal";
  const own = counterpartIban ? ctx.ownIbans.get(counterpartIban) : undefined;
  if (own) return own === "Compte courant" ? "internal" : "savings";
  if (SAVINGS.test(text)) return "savings";
  if (OWN_ACCOUNTS.test(text) && type !== "FRAIS") return "internal";
  if (ctx.ownerName && type === "VIREMENT" && hasAllWords(text, ctx.ownerName)) return "internal";
  return null;
}

function guessNecessity(text: string, amountCents: number): Necessity | null {
  if (amountCents >= 0) return null;
  if (FRIENDS.test(text)) return "social";
  return null;
}

// ----------------------------------------------------------------------------------

/**
 * Booked lines of one account, ready to store. Pending lines are left out: their
 * reference and date can still change, they come back once booked.
 */
export function toBankLines(items: ApiTransaction[], account: string, ctx: ClassifyContext): BankLine[] {
  const seen = new Map<string, number>();
  const out: BankLine[] = [];
  for (const t of items) {
    if (t.status !== "BOOK") continue;
    const cents = amountToCents(t.transaction_amount.amount);
    if (!cents) continue;
    const debit = t.credit_debit_indicator === "DBIT";
    const amountCents = debit ? -cents : cents;
    const booked = t.booking_date || t.value_date || t.transaction_date;
    if (!booked) continue;
    const remittance = (t.remittance_information ?? []).join(" ").trim();
    const day = purchaseDay(normalize(remittance), booked) ?? t.transaction_date ?? booked;

    const counterpart = (debit ? t.creditor?.name : t.debtor?.name)?.trim() || "";
    const counterpartIban = (debit ? t.creditor_account?.iban : t.debtor_account?.iban) ?? null;
    const text = normalize([remittance, counterpart, t.bank_transaction_code?.description ?? ""].join(" "));
    const type = operationType(normalize(remittance), t.bank_transaction_code?.description ?? null);

    // Without a bank reference, identical lines on the same day get a running number.
    const content = [booked, normalize(remittance), amountCents].join("|");
    const n = (seen.get(content) ?? 0) + 1;
    seen.set(content, n);
    const key = t.entry_reference ? `ref|${t.entry_reference}` : `${content}|${n}`;

    const transfer = detectTransfer(text, type, counterpartIban, ctx, amountCents);
    out.push({
      id: stableId("eb", `${normalize(account)}|${key}`),
      account,
      date: dayToDate(day),
      label: cleanLabel(counterpart || remittance || t.bank_transaction_code?.description || "Opération"),
      amountCents,
      bankCategory: null,
      bankSubcategory: null,
      operationType: type,
      transfer,
      necessity: transfer ? null : guessNecessity(text, amountCents),
    });
  }
  return out;
}

/** Booked balance first, as the lines are booked ones; then whatever the bank gives. */
const BALANCE_ORDER = ["CLBD", "ITBD", "XPCD", "ITAV", "CLAV", "OPBD"];

export function pickBalanceCents(balances: ApiBalance[]): number | null {
  if (balances.length === 0) return null;
  const rank = (b: ApiBalance) => {
    const i = BALANCE_ORDER.indexOf(b.balance_type);
    return i < 0 ? BALANCE_ORDER.length : i;
  };
  const best = [...balances].sort((a, b) => rank(a) - rank(b))[0];
  const cents = amountToCents(best.balance_amount.amount);
  return best.balance_amount.amount.trim().startsWith("-") ? -cents : cents;
}
