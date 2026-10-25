import { caisseEpargne } from "./caisseEpargne";
import { decodeBankFile } from "./csv";
import type { BankFormat, ImportedTransaction, ParseContext } from "./types";

export type { ImportedTransaction } from "./types";

/** Every bank format the import screen understands. Add Revolut, Bitstack… here. */
export const FORMATS: BankFormat[] = [caisseEpargne];

export interface ParsedFile {
  format: string;
  items: ImportedTransaction[];
}

export async function parseBankFile(buffer: ArrayBuffer, ctx: ParseContext): Promise<ParsedFile> {
  const text = decodeBankFile(buffer);
  const header = text.split(/\r?\n/, 1)[0];
  const format = FORMATS.find((f) => f.detect(header));
  if (!format) {
    throw new Error("Ce fichier n'est pas un export reconnu. Pour la Caisse d'Épargne : site web > Télécharger les opérations > format Excel (.csv).");
  }
  return { format: format.name, items: await format.parse(text, ctx) };
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
  const fresh = items.filter((t) => !existingIds.has(t.id));
  const dates = items.map((t) => t.date.getTime());
  const expenses = fresh.filter((t) => !t.transfer && t.amountCents < 0);
  return {
    total: items.length,
    fresh,
    alreadyThere: items.length - fresh.length,
    from: dates.length ? new Date(Math.min(...dates)) : null,
    to: dates.length ? new Date(Math.max(...dates)) : null,
    transfers: fresh.filter((t) => t.transfer).length,
    sorted: expenses.filter((t) => t.necessity).length,
    unsorted: expenses.filter((t) => !t.necessity).length,
  };
}
