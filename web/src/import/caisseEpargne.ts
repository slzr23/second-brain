import { detectTransfer, guessNecessity } from "./classify";
import { frenchAmountToCents, frenchDate, normalize, parseCsv, stableId } from "./csv";
import type { BankFormat, ImportedTransaction } from "./types";

const REQUIRED = ["Date de comptabilisation", "Libelle simplifie", "Libelle operation", "Debit", "Credit"];

/**
 * "Télécharger les opérations" export of the Caisse d'Épargne website (Excel/CSV, ";").
 * Columns: Date de comptabilisation; Libelle simplifie; Libelle operation; Reference;
 * Informations complementaires; Type operation; Categorie; Sous categorie; Debit; Credit;
 * Date operation; Date de valeur; Pointage operation
 */
export const caisseEpargne: BankFormat = {
  name: "Caisse d'Épargne",

  detect(headerLine) {
    return REQUIRED.every((column) => headerLine.includes(column));
  },

  async parse(text, { account, ownerName }) {
    const [header, ...rows] = parseCsv(text, ";");
    const col = (name: string) => header.findIndex((h) => h.trim() === name);
    const at = {
      booked: col("Date de comptabilisation"),
      short: col("Libelle simplifie"),
      full: col("Libelle operation"),
      ref: col("Reference"),
      type: col("Type operation"),
      category: col("Categorie"),
      subcategory: col("Sous categorie"),
      debit: col("Debit"),
      credit: col("Credit"),
      operated: col("Date operation"),
    };
    const get = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    // Lines without a bank reference are identified by their content; identical lines
    // on the same day (two coffees at the same place) get a running number.
    const seen = new Map<string, number>();

    const out: ImportedTransaction[] = [];
    for (const row of rows) {
      const amount = get(row, at.debit) || get(row, at.credit);
      if (!amount) continue;
      const amountCents = frenchAmountToCents(amount);
      const label = get(row, at.short) || get(row, at.full);
      const booked = get(row, at.booked);
      const line = {
        label: `${label} ${get(row, at.full)}`,
        amountCents,
        bankCategory: get(row, at.category) || null,
        bankSubcategory: get(row, at.subcategory) || null,
        operationType: get(row, at.type) || null,
      };

      const ref = get(row, at.ref);
      const content = [booked, get(row, at.operated), normalize(get(row, at.full)), amountCents].join("|");
      const n = (seen.get(content) ?? 0) + 1;
      seen.set(content, n);
      const key = ref ? `ref|${ref}` : `${content}|${n}`;

      out.push({
        id: await stableId("ce", `${normalize(account)}|${key}`),
        account,
        date: frenchDate(get(row, at.operated) || booked),
        label: tidyLabel(label),
        amountCents,
        bankCategory: line.bankCategory,
        bankSubcategory: line.bankSubcategory,
        operationType: line.operationType,
        transfer: detectTransfer(line, ownerName),
        necessity: null,
      });
      const last = out[out.length - 1];
      last.necessity = last.transfer ? null : guessNecessity(line);
    }
    return out;
  },
};

/** "MARTIN CREATEUR DE PLAISIR" → "Martin Createur De Plaisir"; keeps short acronyms ("SNCF"). */
function tidyLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|[\s'(/-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase())
    .replace(/\b(Sncf|Ratp|Edf|Caf|Cpam|Sfr|Ds|Slc)\b/g, (w) => w.toUpperCase());
}
