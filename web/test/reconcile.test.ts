import { describe, expect, it } from "vitest";
import { matchAppEntries, mergeAppEntry } from "../src/import/reconcile";
import type { Transaction } from "../src/data/types";
import type { ImportedTransaction } from "../src/import/types";

const bank = (id: string, date: Date, euros: number, transfer: ImportedTransaction["transfer"] = null): ImportedTransaction => ({
  id,
  account: "Compte courant",
  date,
  label: "Cb Boulangerie Paul",
  amountCents: Math.round(euros * 100),
  bankCategory: null,
  bankSubcategory: null,
  operationType: null,
  transfer,
  necessity: null,
});
const app = (id: string, date: Date, euros: number, source: Transaction["source"], extra: Partial<Transaction> = {}): Transaction => ({
  id,
  date,
  amountCents: Math.round(euros * 100),
  label: "Paul",
  merchant: null,
  necessity: null,
  source,
  account: null,
  transfer: null,
  bankCategory: null,
  ...extra,
});

describe("bank lines vs app entries", () => {
  it("matches the same amount booked a few days later, the closest first", () => {
    const payments = [app("a", new Date(2026, 9, 28, 8), -4.2, "apple_pay"), app("b", new Date(2026, 9, 29, 8), -4.2, "apple_pay")];
    const lines = [bank("l1", new Date(2026, 9, 30, 12), -4.2), bank("l2", new Date(2026, 9, 31, 12), -4.2)];
    const m = matchAppEntries(lines, payments);
    expect(m.get("l1")?.id).toBe("b");
    expect(m.get("l2")?.id).toBe("a");
  });

  it("ignores other amounts, old entries, transfers and bank lines already stored", () => {
    const entries = [app("a", new Date(2026, 9, 20), -4.2, "apple_pay"), app("b", new Date(2026, 9, 29), -9, "manual"), app("c", new Date(2026, 9, 29), -50, "bank", { account: "Compte courant" })];
    const lines = [bank("l1", new Date(2026, 9, 30, 12), -4.2), bank("l2", new Date(2026, 9, 30, 12), -9, "internal"), bank("l3", new Date(2026, 9, 30, 12), -50)];
    expect(matchAppEntries(lines, entries).size).toBe(0);
  });

  it("keeps what was said in the app: label and category", () => {
    const merged = mergeAppEntry(bank("l1", new Date(2026, 9, 30), -12.5), app("a", new Date(2026, 9, 29), -12.5, "manual", { label: "Kebab", necessity: "social" }));
    expect(merged).toMatchObject({ id: "l1", label: "Kebab", necessity: "social", amountCents: -1250 });
  });
});
