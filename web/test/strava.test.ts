import { describe, expect, it } from "vitest";
import { parseImportFile } from "../src/import";
import { summarizeActivities } from "../src/import/strava";
import { weekFromActivities } from "../src/lib/sport";
import type { Activity } from "../src/data/types";

const file = {
  source: "strava",
  version: 1,
  activities: [
    { id: "101", name: "Footing", sport: "Run", start: "2026-10-26T08:00:00", distanceM: 10_000, movingS: 3_300, elapsedS: 3_400, avgHr: 142.4, maxHr: 160 },
    { id: "102", name: "Foot", sport: "Soccer", start: "2026-10-27T19:00:00", distanceM: 0, movingS: 3_600, elapsedS: 3_600 },
    { id: "103", name: "Fractionné", sport: "Run", start: "2026-10-28T18:00:00", distanceM: 8_000, movingS: 2_400, elapsedS: 2_900, avgHr: null },
  ],
};
const buffer = (o: unknown) => new TextEncoder().encode(JSON.stringify(o)).buffer as ArrayBuffer;

describe("Strava export", () => {
  it("is recognised and read", async () => {
    const parsed = await parseImportFile(buffer(file), { account: "x", ownerName: null });
    expect(parsed.kind).toBe("activities");
    if (parsed.kind !== "activities") return;
    const [run, soccer] = parsed.activities;
    expect(run).toMatchObject({ id: "strava_101", sport: "Run", distanceM: 10_000, durationS: 3_300, avgHr: 142, paceSecKm: 330 });
    expect(run.date).toEqual(new Date(2026, 9, 26, 8));
    expect(soccer).toMatchObject({ paceSecKm: 0, avgHr: null });
  });

  it("previews new and already imported activities", async () => {
    const parsed = await parseImportFile(buffer(file), { account: "x", ownerName: null });
    if (parsed.kind !== "activities") throw new Error();
    expect(summarizeActivities(parsed.activities, new Set(["strava_101"]))).toMatchObject({
      total: 3,
      fresh: 2,
      runs: 2,
      runKm: 18,
      withHr: 1,
      others: [["Soccer", 1]],
    });
  });
});

describe("week from activities", () => {
  const run = (date: Date, km: number, avgHr: number | null = null): Activity => ({
    id: String(date.getTime()),
    name: "Run",
    sport: "Run",
    date,
    distanceM: km * 1000,
    durationS: km * 330,
    elevationM: null,
    avgHr,
    maxHr: null,
    paceSecKm: 330,
    relativeEffort: null,
    report: null,
  });
  const now = new Date(2026, 9, 30, 16); // Friday

  it("sums this week's runs and compares with the 4 previous weeks", () => {
    const list = [run(new Date(2026, 9, 26, 8), 10, 140), run(new Date(2026, 9, 28, 18), 8, 160), run(new Date(2026, 9, 20), 20), run(new Date(2026, 9, 13), 20)];
    const week = weekFromActivities(list, now)!;
    expect(week.volumeKm).toBe(18);
    expect(week.runs).toBe(2);
    expect(week.byDayKm).toEqual([10, 0, 8, 0, 0, 0, 0]);
    expect(week.goalKm).toBe(10); // (20 + 20 + 0 + 0) / 4
    expect(week.avgHr).toBe(149); // weighted by time: (140×10 + 160×8) / 18
  });
});
