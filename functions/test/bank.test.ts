import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signJwt, type ApiTransaction } from "../src/bank/client";
import { accountName, amountToCents, cleanLabel, pickBalanceCents, purchaseDay, toBankLines, type BankLine } from "../src/bank/map";
import { alreadyImported, matchAppEntries, mergeAppEntry, monthlyBalances, sortLikeBefore, type StoredLine } from "../src/bank/reconcile";

const ctx = { ownerName: "Jules Martin", ownIbans: new Map([["FR76LIVRET", "Livret A"], ["FR76COURANT", "Compte courant"]]) };

const tx = (over: Partial<ApiTransaction> = {}): ApiTransaction => ({
  entry_reference: "REF1",
  transaction_amount: { amount: "12.50", currency: "EUR" },
  credit_debit_indicator: "DBIT",
  status: "BOOK",
  booking_date: "2026-11-05",
  transaction_date: "2026-11-04",
  remittance_information: ["CB CARREFOUR CITY FACT 041126"],
  ...over,
});

const line = (over: Partial<BankLine> = {}): BankLine => ({
  id: "eb_1",
  account: "Compte courant",
  date: new Date("2026-11-04T12:00:00Z"),
  label: "Carrefour City",
  amountCents: -1250,
  bankCategory: null,
  bankSubcategory: null,
  operationType: "CARTE",
  transfer: null,
  necessity: null,
  ...over,
});

const stored = (over: Partial<StoredLine> = {}): StoredLine => ({
  id: "x",
  date: new Date("2026-11-04T12:00:00Z"),
  amountCents: -1250,
  source: "apple_pay",
  account: null,
  label: "Carrefour",
  necessity: null,
  ...over,
});

describe("Enable Banking JWT", () => {
  it("is an RS256 token with the app id as kid, valid one hour", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const jwt = signJwt("app-123", pem, new Date("2026-11-09T20:00:00Z"));
    const [h, b, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ typ: "JWT", alg: "RS256", kid: "app-123" });
    const body = JSON.parse(Buffer.from(b, "base64url").toString());
    expect(body).toMatchObject({ iss: "enablebanking.com", aud: "api.enablebanking.com" });
    expect(body.exp - body.iat).toBe(3600);
    expect(createVerify("RSA-SHA256").update(`${h}.${b}`).verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });
});

describe("API lines → bank lines", () => {
  it("reads amounts without floating point", () => {
    expect(amountToCents("12.5")).toBe(1250);
    expect(amountToCents("0.07")).toBe(7);
    expect(amountToCents("1234")).toBe(123400);
  });

  it("signs debits, uses the operation day and cleans the label", () => {
    const [l] = toBankLines([tx()], "Compte courant", ctx);
    expect(l).toMatchObject({ amountCents: -1250, label: "Carrefour City", operationType: "CARTE", transfer: null });
    expect(l.date.toISOString()).toBe("2026-11-04T12:00:00.000Z");
    expect(l.id).toMatch(/^eb_[0-9a-f]{24}$/);
  });

  it("keeps the same id from one sync to the next", () => {
    expect(toBankLines([tx()], "Compte courant", ctx)[0].id).toBe(toBankLines([tx()], "Compte courant", ctx)[0].id);
  });

  it("leaves pending lines for later", () => {
    expect(toBankLines([tx({ status: "PDNG" })], "Compte courant", ctx)).toEqual([]);
  });

  it("numbers identical lines without a reference", () => {
    const same = tx({ entry_reference: null });
    const ids = toBankLines([same, same], "Compte courant", ctx).map((l) => l.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("spots money moving to my own accounts", () => {
    const toLivret = tx({ remittance_information: ["VIR SEPA EPARGNE"], creditor_account: { iban: "FR76LIVRET" } });
    const toMe = tx({ remittance_information: ["VIR INST JULES MARTIN"], creditor: { name: "M JULES MARTIN" } });
    const revolut = tx({ remittance_information: ["CB REVOLUT**1234"] });
    const [a, b, c] = toBankLines([toLivret, toMe, revolut].map((t, i) => ({ ...t, entry_reference: `R${i}` })), "Compte courant", ctx);
    expect([a.transfer, b.transfer, c.transfer]).toEqual(["savings", "internal", "internal"]);
  });

  it("never counts a loan paid out as income", () => {
    const [l] = toBankLines([tx({ credit_debit_indicator: "CRDT", transaction_amount: { amount: "10000.00", currency: "EUR" }, remittance_information: [], debtor: { name: "BPCE FINANCEMENT" } })], "Compte courant", ctx);
    expect(l).toMatchObject({ amountCents: 1_000_000, transfer: "internal" });
  });

  it("guesses friends paid back as social", () => {
    const [l] = toBankLines([tx({ remittance_information: ["VIR WERO PAUL"] })], "Compte courant", ctx);
    expect(l.necessity).toBe("social");
  });

  it("names accounts like the CSV import", () => {
    expect(accountName({ uid: "1", cash_account_type: "CACC", product: "COMPTE DE DEPOT" })).toBe("Compte courant");
    expect(accountName({ uid: "2", cash_account_type: "SVGS", product: "Livret A" })).toBe("Livret A");
  });

  it("dates a card payment by the purchase, not the booking", () => {
    const [l] = toBankLines([tx({ transaction_date: null, value_date: "2026-10-12", booking_date: "2026-10-12", remittance_information: ["MARCHE KUPERA 2 FACT 081026 344336******6"] })], "Compte courant", ctx);
    expect(l.date.toISOString().slice(0, 10)).toBe("2026-10-08");
    expect(l.label).toBe("Marche Kupera 2");
    expect(purchaseDay("FACT 081026", "2026-10-12")).toBe("2026-10-08");
    // Not a plausible purchase day: the booking day stays.
    expect(purchaseDay("FACT 311399", "2026-10-12")).toBeNull();
    expect(purchaseDay("FACT 081125", "2026-10-12")).toBeNull();
  });

  it("strips masked card numbers and stray stars", () => {
    expect(cleanLabel("ZARA FRANCE FACT 241026 344336******6")).toBe("Zara France");
    expect(cleanLabel("* COMMISSION INTERVENTION")).toBe("Commission Intervention");
    expect(cleanLabel("FREE TELECOM")).toBe("Free Telecom");
  });

  it("cleans common bank prefixes", () => {
    expect(cleanLabel("PRLV SEPA FREE MOBILE")).toBe("Free Mobile");
    expect(cleanLabel("CB SNCF INTERNET 03/11")).toBe("SNCF Internet");
  });

  it("prefers the booked balance", () => {
    const amount = (a: string) => ({ amount: a, currency: "EUR" });
    expect(
      pickBalanceCents([
        { balance_type: "XPCD", balance_amount: amount("90.00") },
        { balance_type: "CLBD", balance_amount: amount("-12.30") },
      ]),
    ).toBe(-1230);
    expect(pickBalanceCents([])).toBeNull();
  });
});

describe("merging with what is already stored", () => {
  it("skips lines the CSV import already brought in, one for one", () => {
    const csv = stored({ id: "ce_1", source: "bank", account: "Compte courant", date: new Date("2026-11-05T00:00:00Z") });
    const covered = alreadyImported([line({ id: "eb_a" }), line({ id: "eb_b" })], [csv]);
    expect([...covered]).toEqual(["eb_a"]);
  });

  it("does not match lines of another account or amount", () => {
    const csv = stored({ id: "ce_1", source: "bank", account: "Livret A" });
    expect(alreadyImported([line()], [csv]).size).toBe(0);
  });

  it("takes over an Apple Pay payment and keeps what I said about it", () => {
    const pay = stored({ id: "ap", date: new Date("2026-11-03T19:00:00Z"), label: "Courses", necessity: "essentiel" });
    const matches = matchAppEntries([line()], [pay]);
    expect(matches.get("eb_1")?.id).toBe("ap");
    expect(mergeAppEntry(line(), pay)).toMatchObject({ label: "Courses", necessity: "essentiel", amountCents: -1250 });
  });

  it("takes over money received that I typed before the bank showed it", () => {
    const typed = stored({ id: "m", source: "manual", amountCents: 1_000_000, label: "Don des parents", date: new Date("2026-11-03T12:00:00Z") });
    const matches = matchAppEntries([line({ amountCents: 1_000_000, label: "M Ou Mme Dupont" })], [typed]);
    expect(matches.get("eb_1")?.id).toBe("m");
  });

  it("never merges a transfer or a payment booked too late", () => {
    const pay = stored({ id: "ap", date: new Date("2026-10-20T12:00:00Z") });
    expect(matchAppEntries([line()], [pay]).size).toBe(0);
    expect(matchAppEntries([line({ transfer: "savings" })], [stored()]).size).toBe(0);
  });

  it("sorts a merchant like the last time", () => {
    const before = [
      stored({ id: "a", source: "bank", account: "Compte courant", label: "Lyovel Sas", necessity: "essentiel", date: new Date("2026-09-01") }),
      stored({ id: "b", source: "bank", account: "Compte courant", label: "LYOVEL SAS", necessity: "superflu", date: new Date("2026-10-01") }),
    ];
    const [known, unknown, income] = sortLikeBefore(
      [line({ id: "1", label: "Lyovel Sas" }), line({ id: "2", label: "Zara France" }), line({ id: "3", label: "Lyovel Sas", amountCents: 500 })],
      before,
    );
    expect([known.necessity, unknown.necessity, income.necessity]).toEqual(["superflu", null, null]);
  });

  it("rebuilds month-end balances from today's", () => {
    const now = new Date("2026-11-09T20:00:00Z");
    const moves = [
      { date: new Date("2026-11-02T12:00:00Z"), amountCents: -1000 },
      { date: new Date("2026-09-15T12:00:00Z"), amountCents: 5000 },
    ];
    expect(monthlyBalances(moves, 10000, now)).toEqual([
      { month: "2026-09", cents: 11000 },
      { month: "2026-10", cents: 11000 },
      { month: "2026-11", cents: 10000 },
    ]);
  });
});
