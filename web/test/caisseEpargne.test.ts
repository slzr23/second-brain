import { describe, expect, it } from "vitest";
import { caisseEpargne } from "../src/import/caisseEpargne";
import { decodeBankFile, parseCsv } from "../src/import/csv";
import { parseBankFile, summarize } from "../src/import";

// Synthetic export in the bank's exact format (all names and amounts are made up).
const HEADER =
  "Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation";
const LINES = [
  "24/10/2026;BOULANGERIE DU COIN;CB BOULANGERIE DU COIN FACT 221026;d39f278b-0000-0000-0000-000000000001;;Carte bancaire;Alimentation;Alimentation - autre;-4,20;;22/10/2026;24/10/2026;0",
  "23/10/2026;PIZZA NAPOLI;CB PIZZA NAPOLI FACT 211026;;;Carte bancaire;Alimentation;Restauration rapide;-18,00;;21/10/2026;23/10/2026;0",
  "23/10/2026;PIZZA NAPOLI;CB PIZZA NAPOLI FACT 211026;;;Carte bancaire;Alimentation;Restauration rapide;-18,00;;21/10/2026;23/10/2026;0",
  "22/10/2026;LE BAR;CB LE BAR FACT 201026;;;Carte bancaire;Loisirs et vacances;Bar;-12,50;;20/10/2026;22/10/2026;0",
  "21/10/2026;VIREMENT VERS LIVRET A;VIREMENT VERS LIVRET A;;;Virement;Transaction exclue;Transaction exclue;-200,00;;21/10/2026;21/10/2026;0",
  "20/10/2026;VIR. VERS CAMILLE MARTIN;VIR. VERS CAMILLE MARTIN;;;Virement;A categoriser - sortie d'argent;Virement emis - a categoriser;-150,00;;20/10/2026;20/10/2026;0",
  "20/10/2026;MARTIN PAPA MAMAN;MARTIN PAPA MAMAN;;;Virement;A categoriser - sortie d'argent;Virement emis - a categoriser;-40,00;;20/10/2026;20/10/2026;0",
  "19/10/2026;ENVOI WERO LEA B;ENVOI WERO LEA B;;;Virement;A categoriser - sortie d'argent;Virement emis - a categoriser;-9,00;;19/10/2026;19/10/2026;0",
  "18/10/2026;Bitstack;CB Bitstack FACT 171026;;;Carte bancaire;Banque et assurances;Banque et assurance - autre;-1,35;;17/10/2026;18/10/2026;0",
  "18/10/2026;Revolut;CB Revolut 1234 FACT 171026;;;Carte bancaire;Banque et assurances;Banque et assurance - autre;-50,00;;17/10/2026;18/10/2026;0",
  "17/10/2026;ENTREPRISE SA;VIR ENTREPRISE SA SALAIRE;;;Virement recu;Revenus et rentrees d'argent;Salaires et revenus d'activite;;1 234,56;17/10/2026;17/10/2026;0",
];
const CSV = [HEADER, ...LINES].join("\r\n") + "\r\n";
const ctx = { account: "Compte courant", ownerName: "Camille Martin" };

describe("Caisse d'Épargne CSV", () => {
  it("is recognised from its header", () => {
    expect(caisseEpargne.detect(HEADER)).toBe(true);
    expect(caisseEpargne.detect("Date;Description;Amount")).toBe(false);
  });

  it("reads amounts, dates and labels", async () => {
    const [first, , , , , , , , , , salary] = await caisseEpargne.parse(CSV, ctx);
    expect(first).toMatchObject({
      account: "Compte courant",
      label: "Boulangerie Du Coin",
      amountCents: -420,
      bankCategory: "Alimentation",
      necessity: "essentiel",
      transfer: null,
    });
    // The purchase date, not the booking date.
    expect(first.date).toEqual(new Date(2026, 9, 22, 12));
    expect(salary).toMatchObject({ amountCents: 123_456, necessity: null, transfer: null });
  });

  it("keeps two identical purchases apart, with ids that are stable across imports", async () => {
    const a = await caisseEpargne.parse(CSV, ctx);
    const b = await caisseEpargne.parse([HEADER, ...LINES.slice(1, 3)].join("\n"), ctx);
    expect(a[1].id).not.toBe(a[2].id);
    expect(b.map((t) => t.id)).toEqual([a[1].id, a[2].id]);
    expect(new Set(a.map((t) => t.id)).size).toBe(a.length);
  });

  it("gives the same line different ids in different accounts", async () => {
    const a = await caisseEpargne.parse(CSV, ctx);
    const b = await caisseEpargne.parse(CSV, { ...ctx, account: "Livret A" });
    expect(a[0].id).not.toBe(b[0].id);
  });

  it("spots transfers between your own accounts and savings", async () => {
    const t = await caisseEpargne.parse(CSV, ctx);
    const byLabel = Object.fromEntries(t.map((x) => [x.label, x]));
    expect(byLabel["Virement Vers Livret A"].transfer).toBe("savings");
    expect(byLabel["Vir. Vers Camille Martin"].transfer).toBe("internal"); // to yourself, in another bank
    expect(byLabel["Martin Papa Maman"].transfer).toBeNull(); // same family name is not you
    expect(byLabel["Bitstack"].transfer).toBe("savings");
    expect(byLabel["Revolut"].transfer).toBe("internal");
  });

  it("pre-sorts only the obvious expenses", async () => {
    const t = await caisseEpargne.parse(CSV, ctx);
    const byLabel = Object.fromEntries(t.map((x) => [x.label, x.necessity]));
    expect(byLabel["Le Bar"]).toBe("social");
    expect(byLabel["Envoi Wero Lea B"]).toBe("social");
    expect(byLabel["Pizza Napoli"]).toBeNull(); // fast food: alone or with friends? You decide.
    expect(byLabel["Virement Vers Livret A"]).toBeNull();
  });
});

describe("import pipeline", () => {
  it("decodes Windows-1252 exports", () => {
    const bytes = new Uint8Array([0x45, 0x70, 0x61, 0x72, 0x67, 0x6e, 0x65, 0x20, 0xe9]); // "Epargne é"
    expect(decodeBankFile(bytes.buffer)).toBe("Epargne é");
  });

  it("parses quoted cells", () => {
    expect(parseCsv('a;"b;c";"d ""e"""\r\n1;2;3')).toEqual([
      ["a", "b;c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });

  it("summarises what is new before writing anything", async () => {
    const buffer = new TextEncoder().encode(CSV).buffer as ArrayBuffer;
    const { format, items } = await parseBankFile(buffer, ctx);
    expect(format).toBe("Caisse d'Épargne");
    const summary = summarize(items, new Set([items[0].id]));
    expect(summary).toMatchObject({ total: 11, alreadyThere: 1, transfers: 4 });
    expect(summary.fresh).toHaveLength(10);
    expect(summary.sorted + summary.unsorted).toBe(5);
  });

  it("rejects an unknown file with a hint", async () => {
    const buffer = new TextEncoder().encode("Date,Description,Amount\n").buffer as ArrayBuffer;
    await expect(parseBankFile(buffer, ctx)).rejects.toThrow(/export reconnu/);
  });
});
