import { describe, expect, it } from "vitest";
import { mergeHistory, monthlyBalances } from "../src/import/history";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);

describe("monthlyBalances", () => {
  const now = d(2026, 10, 25);
  const items = [
    { date: d(2026, 8, 3), amountCents: 100_00 }, // August: +100
    { date: d(2026, 9, 10), amountCents: -30_00 }, // September: -30
    { date: d(2026, 10, 2), amountCents: -20_00 }, // October: -20
  ];

  it("walks back from today's balance, one point per month", () => {
    expect(monthlyBalances(items, 450_00, now)).toEqual([
      { month: "2026-08", cents: 500_00 },
      { month: "2026-09", cents: 470_00 },
      { month: "2026-10", cents: 450_00 },
    ]);
  });

  it("keeps empty months flat", () => {
    const sparse = [{ date: d(2026, 7, 1), amountCents: 10_00 }];
    expect(monthlyBalances(sparse, 10_00, now).map((p) => p.cents)).toEqual([10_00, 10_00, 10_00, 10_00]);
  });

  it("works without movements", () => {
    expect(monthlyBalances([], 74_40, now)).toEqual([{ month: "2026-10", cents: 74_40 }]);
  });
});

describe("mergeHistory", () => {
  it("keeps older months and prefers new values", () => {
    expect(
      mergeHistory(
        [
          { month: "2026-07", cents: 1 },
          { month: "2026-08", cents: 2 },
        ],
        [
          { month: "2026-08", cents: 20 },
          { month: "2026-09", cents: 30 },
        ],
      ),
    ).toEqual([
      { month: "2026-07", cents: 1 },
      { month: "2026-08", cents: 20 },
      { month: "2026-09", cents: 30 },
    ]);
  });
});
