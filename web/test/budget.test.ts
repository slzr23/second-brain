import { describe, expect, it } from "vitest";
import type { Holding, Transaction } from "../src/data/types";
import { alerts, averages, incomeKind, salaryPayers, merchantKey, payPeriods, periodLabel, recurringSpending, runway, summarize } from "../src/lib/budget";

let n = 0;
const tx = (date: Date, euros: number, label: string, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${String(++n).padStart(4, "0")}`,
  amountCents: Math.round(euros * 100),
  date,
  label,
  merchant: null,
  necessity: null,
  source: "bank",
  account: "Compte courant",
  transfer: null,
  bankCategory: null,
  category: null,
  categorySource: null,
  suggestedNecessity: null,
  ...extra,
});
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);
const now = new Date(2026, 10, 23, 20); // 23 November 2026

describe("pay periods", () => {
  it("run from one salary to the next, on the day it actually arrived", () => {
    const list = [tx(d(2026, 9, 26), 1200, "VIR ACME SALAIRE"), tx(d(2026, 10, 27), 1200, "VIR ACME SALAIRE")];
    const periods = payPeriods(list, 3, now);
    expect(periods.map((p) => p.start.getDate())).toEqual([27, 26, 27]); // August unknown: the 27th
    expect(periods[2].start).toEqual(new Date(2026, 9, 27));
    expect(periods[2].end).toEqual(new Date(2026, 10, 27)); // November's salary not there yet: the 27th
    expect(periodLabel(periods[2])).toBe("27 oct. → 26 nov.");
  });

  it("switch on payday", () => {
    expect(payPeriods([], 1, new Date(2026, 10, 27, 9))[0].start).toEqual(new Date(2026, 10, 27));
    expect(payPeriods([], 1, new Date(2026, 10, 26, 22))[0].start).toEqual(new Date(2026, 9, 27));
  });
});

describe("income", () => {
  it("tells salary, allowances and people paying back apart", () => {
    expect(incomeKind(tx(now, 1200, "VIR SEPA ACME"))).toBe("autres");
    // A company paying at the end of every month is the salary, even unnamed.
    const pay = [8, 9, 10].map((m) => tx(d(2026, m, 27), 1200, "VIR SEPA ACME"));
    expect(incomeKind(pay[2], salaryPayers(pay))).toBe("salaire");
    expect(incomeKind(tx(now, 180, "CAF DU DEPARTEMENT"))).toBe("aides");
    expect(incomeKind(tx(now, 100, "ACTION LOGEMENT SERVIC"))).toBe("aides");
    expect(incomeKind(tx(now, 12, "M. DUPONT PIERRE"))).toBe("remboursements");
  });
});

describe("a period", () => {
  const period = { start: new Date(2026, 9, 27), end: new Date(2026, 10, 27) };
  const list = [
    tx(d(2026, 10, 27), 1200, "ACME SALAIRE"),
    tx(d(2026, 11, 5), 180, "CAF DU DEPARTEMENT"),
    tx(d(2026, 10, 28), -690, "VIREMENT VERS PROPRIO", { category: "logement" }),
    tx(d(2026, 11, 2), -45.5, "CARREFOUR", { category: "courses" }),
    tx(d(2026, 11, 3), -12, "BAR", { category: null }),
    tx(d(2026, 11, 15), -34.95, "COTISATIONS BANCAIRES", { category: "autres" }),
    tx(d(2026, 11, 15), 34.95, "REMISE COTISATIONS"),
    tx(d(2026, 11, 20), -150, "VIR. VERS CPT DEPOT PART.", { transfer: "savings" }),
    tx(d(2026, 11, 21), -3, "Café", { account: null, source: "manual", category: "sorties" }),
    tx(d(2026, 11, 21), -999, "Livret A ligne", { account: "Livret A" }),
    tx(d(2026, 10, 20), -50, "Avant la période", { category: "courses" }),
  ];
  const s = summarize(list, period);

  it("adds up what came in, by kind, without a refunded fee", () => {
    expect(s.earnedByKind).toMatchObject({ salaire: 120000, aides: 18000, remboursements: 0 });
    expect(s.earnedCents).toBe(138000);
  });

  it("adds up where it went, by category, net of the refunded fee", () => {
    expect(s.spentCents).toBe(69000 + 4550 + 1200 + 300);
    expect(s.byCategory).toEqual({ logement: 69000, courses: 4550, none: 1200, sorties: 300 });
    expect(s.savedCents).toBe(15000);
  });
});

describe("recurring spending", () => {
  const list = [8, 9, 10, 11].flatMap((m) => [
    tx(d(2026, m, 28), -690, "VIREMENT VERS PROPRIO"),
    tx(d(2026, m, 12), m === 11 ? -11.99 : -10.99, "PRLV SPOTIFY"),
    tx(d(2026, m, 3), -2.99, "CB APPLE.COM/BILL FACT 0310"),
    tx(d(2026, m, 17), -9.99, "CB APPLE.COM/BILL FACT 1710"),
  ]);
  // Coffee many times a month is a habit, not a subscription.
  for (let i = 1; i <= 20; i++) list.push(tx(d(2026, 10 + (i % 2), i), -1.4, "CAFE DU COIN"));
  const r = recurringSpending(list, now);

  it("finds what comes back monthly, two subscriptions under one merchant apart", () => {
    expect(r.map((x) => [x.label, x.amountCents]).sort()).toEqual(
      [
        ["CB APPLE.COM/BILL FACT 0310", 299],
        ["CB APPLE.COM/BILL FACT 1710", 999],
        ["PRLV SPOTIFY", 1199],
        ["VIREMENT VERS PROPRIO", 69000],
      ].sort(),
    );
    expect(merchantKey({ label: "CB APPLE.COM/BILL FACT 0310", merchant: null })).toBe("apple com bill");
  });

  it("knows the next date and a rise", () => {
    const spotify = r.find((x) => x.label === "PRLV SPOTIFY")!;
    expect(spotify.previousCents).toBe(1099);
    expect(spotify.next).toEqual(new Date(2026, 11, 12));
    expect(r.find((x) => x.amountCents === 69000)!.next).toEqual(new Date(2026, 10, 28));
  });

  it("gives what is left before payday and what to watch", () => {
    const period = { start: new Date(2026, 9, 27), end: new Date(2026, 10, 27) };
    const holdings: Holding[] = [
      { id: "account_compte-courant", group: "Compte courant", name: "Compte courant", units: 1, unitPrice: 600, priceDate: new Date(2026, 10, 23, 6), priceSource: "auto", tracker: null, history: [], investedCents: null },
    ];
    const withLate = [...list, tx(new Date(2026, 10, 23, 12), -20, "Resto", { account: null, source: "apple_pay" })];
    const run = runway(holdings, withLate, r, period, now);
    // Rent on the 28th comes after payday: nothing else before the 27th.
    expect(run).toMatchObject({ balanceCents: 58000, upcomingCents: 0, leftCents: 58000, daysToPayday: 4 });

    const fees = [1, 2, 3].map((i) => tx(d(2026, 8, 26), -8, "FRAIS BANCAIRES COMMISSION INTERVENTION", { id: `f${i}` }));
    const twice = [tx(d(2026, 11, 10), -42, "CB DECATHLON", { id: "x1" }), tx(d(2026, 11, 11), -42, "CB DECATHLON", { id: "x2" })];
    const found = alerts([...withLate, ...fees, ...twice], r, { ...run, leftCents: -3000 }, now);
    expect(found.map((a) => a.kind).sort()).toEqual(["duplicate", "fees", "overdraft", "rising"]);
    expect(found.find((a) => a.kind === "fees")!.title).toMatch(/24,00/);
  });
});

describe("averages", () => {
  it("leave out the period in progress", () => {
    const p = (m: number) => ({ start: new Date(2026, m, 27), end: new Date(2026, m + 1, 27) });
    const s = [7, 8, 9].map((m) => summarize([tx(new Date(2026, m + 1, 1), -100 * (m - 6), "X", { category: "courses" })], p(m)));
    expect(averages(s)).toMatchObject({ periods: 2, spentCents: 15000, byCategory: { courses: 15000 } });
  });
});
