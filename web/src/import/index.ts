import { bitstack } from "./bitstack";
import { revolut } from "./revolut";
import { caisseEpargne } from "./caisseEpargne";
import type { CryptoTrade } from "./crypto";
import { decodeBankFile } from "./csv";
import { isStravaExport, parseStrava } from "./strava";
import type { ImportedActivity } from "../data/types";
import type { BankFormat, ImportedTransaction, ParseContext } from "./types";

export type { ImportedTransaction } from "./types";

/** Bank account exports: they become transactions. */
export const BANK_FORMATS: BankFormat[] = [caisseEpargne];
/** Crypto platform exports: they become holdings in Patrimoine. */
export const CRYPTO_FORMATS = [bitstack, revolut];

export type ParsedFile =
  | { kind: "bank"; format: string; items: ImportedTransaction[] }
  | { kind: "crypto"; format: string; trades: CryptoTrade[] }
  | { kind: "activities"; format: string; activities: ImportedActivity[] };

export async function parseImportFile(buffer: ArrayBuffer, ctx: ParseContext): Promise<ParsedFile> {
  const text = decodeBankFile(buffer);
  if (isStravaExport(text)) return { kind: "activities", format: "Strava", activities: parseStrava(text) };
  const header = text.split(/\r?\n/, 1)[0];
  const bank = BANK_FORMATS.find((f) => f.detect(header));
  if (bank) return { kind: "bank", format: bank.name, items: await bank.parse(text, ctx) };
  const crypto = CRYPTO_FORMATS.find((f) => f.detect(header));
  if (crypto) return { kind: "crypto", format: crypto.name, trades: await crypto.parse(text) };
  throw new Error(
    "Ce fichier n'est pas un export reconnu. Caisse d'Épargne : site web > Télécharger les opérations > format Excel (.csv). Bitstack : export de l'historique en CSV. Revolut : Crypto > … > Relevé > Excel. Strava : le fichier .json préparé par Claude.",
  );
}

/** Bank exports only. */
export async function parseBankFile(buffer: ArrayBuffer, ctx: ParseContext): Promise<{ format: string; items: ImportedTransaction[] }> {
  const parsed = await parseImportFile(buffer, ctx);
  if (parsed.kind !== "bank") throw new Error("Ce fichier n'est pas un relevé bancaire.");
  return parsed;
}

export interface ImportSummary {
  total: number;
  fresh: ImportedTransaction[];
  alreadyThere: number;
  from: Date | null;
  to: Date | null;
  transfers: number;
  sorted: number;
  unsorted: number;
}

/** What the preview shows before anything is written. */
export function summarize(items: ImportedTransaction[], existingIds: Set<string>): ImportSummary {
  const unique = [...new Map(items.map((t) => [t.id, t])).values()];
  const fresh = unique.filter((t) => !existingIds.has(t.id));
  const dates = unique.map((t) => t.date.getTime());
  const expenses = fresh.filter((t) => !t.transfer && t.amountCents < 0);
  return {
    total: unique.length,
    fresh,
    alreadyThere: unique.length - fresh.length,
    from: dates.length ? new Date(Math.min(...dates)) : null,
    to: dates.length ? new Date(Math.max(...dates)) : null,
    transfers: fresh.filter((t) => t.transfer).length,
    sorted: expenses.filter((t) => t.necessity).length,
    unsorted: expenses.filter((t) => !t.necessity).length,
  };
}
