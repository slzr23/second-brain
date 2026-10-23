import { describe, expect, it } from "vitest";
import { buildRecord } from "../src/ingest/build";
import { ingestPayload } from "../src/ingest/schema";

const now = new Date("2026-10-23T20:45:00Z");
const build = (body: unknown) => buildRecord(ingestPayload.parse(body), now);

describe("ingest payload → Firestore record", () => {
  it("stores a dream with normalized tags and its week", () => {
    const record = build({ type: "dream", text: "  Je volais au-dessus de Rouen ", tags: "Vol, lucide,vol" });
    expect(record.collection).toBe("entries");
    expect(record.data).toMatchObject({
      kind: "dream",
      text: "Je volais au-dessus de Rouen",
      tags: ["vol", "lucide"],
      weekId: "2026-W43",
      analyzed: false,
    });
    expect(record.message).toBe("Rêve enregistré");
  });

  it("stores an expense as a negative amount", () => {
    const record = build({ type: "expense", amount: "12,50 €", label: "Bière avec les potes", necessity: "social" });
    expect(record.collection).toBe("transactions");
    expect(record.data).toMatchObject({ amountCents: -1250, necessity: "social", source: "manual" });
    expect(record.message).toMatch(/^Dépense de 12,50\s€ enregistrée$/);
  });

  it("stores income as a positive amount, even if typed with a minus", () => {
    const record = build({ type: "income", amount: "-900", label: "Salaire alternance" });
    expect(record.data).toMatchObject({ amountCents: 90000, necessity: null, merchant: null });
  });

  it("backdates an expense to midday of the given day", () => {
    const record = build({ type: "expense", amount: 8, label: "Kebab", date: "2026-10-22" });
    expect(record.data).toMatchObject({ date: new Date("2026-10-22T12:00:00Z") });
  });

  it("stores an Apple Pay payment without a necessity, to be tagged later", () => {
    const record = build({ type: "apple_pay", amount: "4,20 €", merchant: "Boulangerie", card: "Visa" });
    expect(record.data).toMatchObject({
      amountCents: -420,
      label: "Boulangerie",
      merchant: "Boulangerie",
      source: "apple_pay",
      necessity: null,
      card: "Visa",
    });
  });

  it("rejects empty text, unknown types, bad necessity and zero amounts", () => {
    expect(ingestPayload.safeParse({ type: "note", text: "   " }).success).toBe(false);
    expect(ingestPayload.safeParse({ type: "todo", text: "x" }).success).toBe(false);
    expect(ingestPayload.safeParse({ type: "expense", amount: 3, label: "x", necessity: "vital" }).success).toBe(false);
    expect(() => build({ type: "expense", amount: "0,00", label: "Rien" })).toThrow(/nul/);
  });
});
