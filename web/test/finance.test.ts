import { describe, expect, it } from "vitest";
import type { Holding, Transaction } from "../src/data/types";
import { accountGroups, averageCumulative, dailySpending, monthlySpending, netWorthSeries, paceVsAverage } from "../src/lib/finance";

const holding = (over: Partial<Holding>): Holding => ({
  id: Math.random().toString(),
  group: "Livret A",
  name: "Livret A",
  units: 1,
  unitPrice: 100,
  priceDate: null,
  priceSource: "manual",
  tracker: null,
  history: [],
  investedCents: null,
  ...over,
});

const tx = (date: Date, euros: number, over: Partial<Transaction> = {}): Transaction => ({
  id: Math.random().toString(),
  amountCents: Math.round(euros * 100),
  date,
  label: "x",
  merchant: null,
  necessity: null,
  source: "bank",
  account: "Compte courant",
  transfer: null,
  bankCategory: null,
  ...over,
});

describe("accounts", () => {
  it("groups lines by account, biggest first, and drops empty ones", () => {
    const groups = accountGroups([
      holding({ group: "Crypto", name: "BTC", units: 0.01, unitPrice: 50_000, investedCents: 300_00 }),
      holding({ group: "Crypto", name: "ETH", units: 0.1, unitPrice: 2_000, investedCents: 100_00 }),
      holding({ group: "Livret A", unitPrice: 450.62 }),
      holding({ group: "PEE", units: 0, unitPrice: 30 }),
    ]);
    expect(groups.map((g) => [g.name, g.cents, g.investedCents])).toEqual([
      ["Crypto", 700_00, 400_00],
      ["Livret A", 450_62, null],
    ]);
  });
});

describe("netWorthSeries", () => {
  const now = new Date(2026, 9, 25);

  it("uses histories, carries quiet months over, and today's values for this month", () => {
    const series = netWorthSeries(
      [
        holding({ group: "Livret A", unitPrice: 450, history: [{ month: "2026-07", cents: 1_000_00 }, { month: "2026-09", cents: 500_00 }] }),
        holding({ group: "PEE", units: 10, unitPrice: 200 }), // typed by hand: no history
      ],
      now,
    );
    expect(series.map((p) => [p.month, p.total])).toEqual([
      ["2026-07", 1_000_00],
      ["2026-09", 500_00],
      ["2026-10", 450_00 + 2_000_00],
    ]);
    expect(series.at(-1)!.byGroup).toEqual({ "Livret A": 450_00, PEE: 2_000_00 });
  });
});

describe("spending", () => {
  const now = new Date(2026, 9, 10, 12);
  const list = [
    tx(new Date(2026, 9, 2), -30),
    tx(new Date(2026, 9, 9), -20),
    tx(new Date(2026, 9, 9), 900), // income: ignored
    tx(new Date(2026, 9, 9), -200, { transfer: "savings" }), // to the Livret: ignored
    tx(new Date(2026, 8, 5), -60),
    tx(new Date(2026, 8, 25), -40),
    tx(new Date(2026, 7, 1), -90),
    tx(new Date(2026, 6, 30), -150),
  ];

  it("adds up each day's spending, without income or transfers", () => {
    const days = dailySpending(list, 2026, 9);
    expect(days).toHaveLength(31);
    expect(days[1]).toBe(30_00);
    expect(days[8]).toBe(20_00);
  });

  it("totals the last months, oldest first", () => {
    expect(monthlySpending(list, 4, now).map((m) => [m.month, m.cents])).toEqual([
      ["2026-07", 150_00],
      ["2026-08", 90_00],
      ["2026-09", 100_00],
      ["2026-10", 50_00],
    ]);
  });

  it("compares this month's pace with the average of the 3 previous ones at the same day", () => {
    // On the 10th: September had spent 60, August 90, July 0 → usual 50; October has spent 50.
    expect(averageCumulative(list, 3, now)[9]).toBe(50_00);
    expect(paceVsAverage(list, now)).toEqual({ spent: 50_00, usual: 50_00, pct: 0 });
  });
});
