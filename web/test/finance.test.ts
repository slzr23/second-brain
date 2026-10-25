import { describe, expect, it } from "vitest";
import type { Holding, Transaction } from "../src/data/types";
import {
  accountGroups,
  availableRanges,
  averageCumulative,
  dailySpending,
  monthlySpending,
  netWorthSeries,
  paceVsAverage,
  spendingBuckets,
  valueSeries,
} from "../src/lib/finance";

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

describe("time ranges", () => {
  const now = new Date(2026, 9, 25, 15);

  it("offers long ranges only when the data goes back that far", () => {
    const h = (month: string) => [holding({ history: [{ month, cents: 1 }] })];
    expect(availableRanges(h("2026-06"), now)).toEqual(["1S", "1M", "3M", "6M", "1A", "Tout"]);
    expect(availableRanges(h("2023-08"), now)).toEqual(["1S", "1M", "3M", "6M", "1A", "5A", "Tout"]);
    expect(availableRanges(h("2016-01"), now)).toEqual(["1S", "1M", "3M", "6M", "1A", "5A", "10A", "Tout"]);
  });

  it("rebuilds a bank account day by day from its movements", () => {
    const account = holding({ id: "account_compte-courant", group: "Compte courant", name: "Compte courant", unitPrice: 74.4, history: [{ month: "2026-09", cents: 300_00 }] });
    const moves = [tx(new Date(2026, 9, 24, 12), -50), tx(new Date(2026, 9, 20, 12), 100)];
    const week = valueSeries([account], moves, [], "1S", now);
    expect(week).toHaveLength(7);
    expect(week.map((p) => p.byGroup["Compte courant"])).toEqual([
      // 19 → 23: before the −50 of the 24th; the 19th also before the +100 of the 20th
      24_40, 124_40, 124_40, 124_40, 124_40, 74_40, 74_40,
    ]);
  });

  it("prefers the evening snapshot when there is one", () => {
    const crypto = holding({ group: "Crypto", name: "BTC", units: 0.01, unitPrice: 70_000, tracker: { symbol: "BTC-EUR", baseUnitPrice: 70_000, baseQuote: 70_000 }, history: [{ month: "2026-09", cents: 650_00 }] });
    const week = valueSeries([crypto], [], [{ day: "2026-10-22", byGroup: { Crypto: 680_00 } }], "1S", now);
    expect(week.find((p) => p.key === "2026-10-22")!.total).toBe(680_00);
    expect(week.at(-1)!.total).toBe(700_00); // today: live value
  });

  it("uses monthly points for a year and more", () => {
    const series = valueSeries([holding({ history: [{ month: "2024-01", cents: 1 }, { month: "2026-01", cents: 2 }] })], [], [], "1A", now);
    expect(series.map((p) => p.key)).toEqual(["2026-01", "2026-10"]);
  });
});

describe("spending buckets", () => {
  const now = new Date(2026, 9, 25, 15); // Sunday
  const list = [tx(new Date(2026, 9, 20), -10), tx(new Date(2026, 9, 25), -5), tx(new Date(2026, 9, 12), -7), tx(new Date(2025, 2, 1), -100)];

  it("groups by week starting on Monday", () => {
    const weeks = spendingBuckets(list, "week", now);
    expect(weeks).toHaveLength(12);
    expect(weeks.at(-1)).toMatchObject({ key: "2026-10-19", cents: 15_00 });
    expect(weeks.at(-2)).toMatchObject({ key: "2026-10-12", cents: 7_00 });
  });

  it("groups by year from the first expense", () => {
    expect(spendingBuckets(list, "year", now).map((b) => [b.key, b.cents])).toEqual([
      ["2025-01-01", 100_00],
      ["2026-01-01", 22_00],
    ]);
  });
});
