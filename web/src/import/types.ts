import type { Necessity } from "../data/types";

/** "savings": to or from a savings product (Livret A, Bitstack…). "internal": between your own current accounts. */
export type TransferKind = "savings" | "internal";

/** One bank line, ready to be stored in users/{uid}/transactions/{id}. */
export interface ImportedTransaction {
  /** Stable across imports of overlapping files, so nothing is ever stored twice. */
  id: string;
  account: string;
  date: Date;
  label: string;
  /** Signed: negative for money going out. */
  amountCents: number;
  bankCategory: string | null;
  bankSubcategory: string | null;
  operationType: string | null;
  transfer: TransferKind | null;
  necessity: Necessity | null;
}

/** A bank format the import screen recognises. */
export interface BankFormat {
  name: string;
  /** True when the file's first line looks like this format. */
  detect(headerLine: string): boolean;
  parse(text: string, ctx: ParseContext): Promise<ImportedTransaction[]>;
}

export interface ParseContext {
  /** Name the lines are filed under: "Compte courant", "Livret A"… */
  account: string;
  /** Account holder's name, to spot transfers to yourself in another bank. */
  ownerName: string | null;
}
