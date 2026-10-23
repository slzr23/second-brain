import { describe, expect, it } from "vitest";
import { isoWeekId, localDateKey } from "../src/lib/week";

describe("isoWeekId", () => {
  it.each([
    ["2026-10-23T20:45:00Z", "2026-W43"],
    ["2026-01-01T12:00:00Z", "2026-W01"], // Thursday
    ["2027-01-01T12:00:00Z", "2026-W53"], // Friday, still in the last ISO week of 2026
    ["2024-12-30T12:00:00Z", "2025-W01"], // Monday belonging to the next ISO year
  ])("%s → %s", (iso, expected) => {
    expect(isoWeekId(new Date(iso))).toBe(expected);
  });

  it("uses Paris time, not UTC", () => {
    // Sunday 23:30 UTC is already Monday 00:30 in Paris (winter time).
    const date = new Date("2026-11-01T23:30:00Z");
    expect(localDateKey(date)).toBe("2026-11-02");
    expect(isoWeekId(date)).toBe("2026-W45");
    expect(isoWeekId(date, "UTC")).toBe("2026-W44");
  });
});
