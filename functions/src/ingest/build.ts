import { parseAmountToCents } from "../lib/amount";
import { isoWeekId } from "../lib/week";
import type { IngestPayload } from "./schema";

export type IngestRecord =
  | { collection: "entries"; data: EntryDoc; message: string }
  | { collection: "transactions"; data: TransactionDoc; message: string };

export interface EntryDoc {
  kind: "dream" | "note";
  text: string;
  tags: string[];
  source: "action_button";
  createdAt: Date;
  weekId: string;
  analyzed: boolean;
}

export interface TransactionDoc {
  /** Signed: negative for money going out. */
  amountCents: number;
  currency: "EUR";
  date: Date;
  label: string;
  merchant: string | null;
  necessity: "essentiel" | "social" | "superflu" | null;
  source: "manual" | "apple_pay";
  card: string | null;
  /** Filled by the bank sync when it finds the matching bank line. */
  bankTxId: string | null;
  matchedTo: string | null;
  createdAt: Date;
}

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Midday UTC keeps a backdated "YYYY-MM-DD" on the same calendar day in Paris. */
const dayToDate = (day: string | undefined, now: Date) => (day ? new Date(`${day}T12:00:00Z`) : now);

/** Maps a validated Shortcut payload to the Firestore document it creates. Pure, so it is unit-tested. */
export function buildRecord(payload: IngestPayload, now: Date): IngestRecord {
  switch (payload.type) {
    case "dream":
    case "note":
      return {
        collection: "entries",
        data: {
          kind: payload.type,
          text: payload.text,
          tags: payload.tags,
          source: "action_button",
          createdAt: now,
          weekId: isoWeekId(now),
          analyzed: false,
        },
        message: payload.type === "dream" ? "Rêve enregistré" : "Note enregistrée",
      };

    case "expense":
    case "income":
    case "apple_pay": {
      const cents = parseAmountToCents(payload.amount);
      if (cents === 0) throw new Error("Le montant est nul");
      const isIncome = payload.type === "income";
      const transaction: TransactionDoc = {
        amountCents: isIncome ? cents : -cents,
        currency: "EUR",
        date: payload.type === "apple_pay" ? now : dayToDate(payload.date, now),
        label: payload.type === "apple_pay" ? payload.merchant : payload.label,
        merchant: payload.type === "income" ? null : (payload.merchant ?? null),
        necessity: payload.type === "expense" ? (payload.necessity ?? null) : null,
        source: payload.type === "apple_pay" ? "apple_pay" : "manual",
        card: payload.type === "apple_pay" ? (payload.card ?? null) : null,
        bankTxId: null,
        matchedTo: null,
        createdAt: now,
      };
      const verb = isIncome ? "Entrée" : "Dépense";
      return {
        collection: "transactions",
        data: transaction,
        message: `${verb} de ${euros.format(cents / 100)} enregistrée`,
      };
    }
  }
}
