import { describe, expect, it } from "vitest";
import { parseShortcutDate, parseSleepLines, parseStage, summarizeNight, formatMinutes } from "../src/health/sleep";
import { parisTime, toActivityDoc } from "../src/sport/activities";
import { ingestPayload } from "../src/ingest/schema";

const night = [
  "2026-11-19T23:30:00+01:00|2026-11-20T07:10:00+01:00|Au lit",
  "2026-11-19T23:40:00+01:00|2026-11-20T01:00:00+01:00|Essentiel",
  "2026-11-20T01:00:00+01:00|2026-11-20T02:00:00+01:00|Profond",
  "2026-11-20T02:00:00+01:00|2026-11-20T02:10:00+01:00|Éveillé(e)",
  "2026-11-20T02:10:00+01:00|2026-11-20T04:10:00+01:00|Essentiel",
  "2026-11-20T04:10:00+01:00|2026-11-20T05:40:00+01:00|Sommeil paradoxal",
  "2026-11-20T05:40:00+01:00|2026-11-20T07:00:00+01:00|Essentiel",
].join("\n");

describe("sleep from Apple Health", () => {
  it("reads stage names in French or English", () => {
    expect(["Profond", "Sommeil paradoxal", "REM", "Essentiel", "Core", "Éveillée", "Au lit", "In Bed", "Endormi(e)"].map(parseStage)).toEqual([
      "deep", "rem", "rem", "core", "core", "awake", "inBed", "inBed", "asleep",
    ]);
  });

  it("sums a night by stage, filed under the morning", () => {
    const s = summarizeNight(parseSleepLines(night))!;
    expect(s).toMatchObject({ day: "2026-11-20", asleepMin: 430, deepMin: 60, remMin: 90, coreMin: 280, awakeMin: 10 });
    expect(s.start.toISOString()).toBe("2026-11-19T22:40:00.000Z");
    expect(formatMinutes(s.asleepMin)).toBe("7 h 10");
  });

  it("counts overlapping samples once and ignores yesterday's nap", () => {
    const lines = [
      "2026-11-19T14:00:00+01:00|2026-11-19T14:30:00+01:00|Essentiel",
      "2026-11-20T00:00:00+01:00|2026-11-20T06:00:00+01:00|Essentiel",
      "2026-11-20T01:00:00+01:00|2026-11-20T02:00:00+01:00|Essentiel",
      "pas une ligne",
    ];
    expect(summarizeNight(parseSleepLines(lines))!.asleepMin).toBe(360);
  });

  it("falls back on time in bed without a watch", () => {
    expect(summarizeNight(parseSleepLines("2026-11-19T23:00:00+01:00|2026-11-20T07:00:00+01:00|Au lit"))!.asleepMin).toBe(480);
  });

  it("reads dates the iPhone did not format, as Paris time", () => {
    expect(parseShortcutDate("19/11/2026 07:24").toISOString()).toBe("2026-11-19T06:24:00.000Z");
    expect(parseShortcutDate("20 nov. 2026 à 01:00").toISOString()).toBe("2026-11-20T00:00:00.000Z");
    expect(parseShortcutDate("3 mars 2026 à 23:10").toISOString()).toBe("2026-03-03T22:10:00.000Z");
    expect(parseShortcutDate("12 mai 2026 à 06:05").toISOString()).toBe("2026-05-12T04:05:00.000Z");
    expect(parseShortcutDate("4 juillet 2026 à 06:05").toISOString()).toBe("2026-07-04T04:05:00.000Z");
    expect(parseShortcutDate("4 juin 2026 à 06:05").toISOString()).toBe("2026-06-04T04:05:00.000Z");
    const [seg] = parseSleepLines("19/11/2026 07:24|19/11/2026 07:56|Core");
    expect(seg).toMatchObject({ stage: "core" });
    expect(summarizeNight([seg])!.asleepMin).toBe(32);
  });

  it("accepts the shortcut payload", () => {
    expect(ingestPayload.parse({ type: "health", sleep: night, restingHr: "52 bpm" }).type).toBe("health");
  });
});

describe("activities from the Strava routine", () => {
  it("reads Strava's local start time as Paris time, summer or winter", () => {
    expect(parisTime("2026-10-28T09:09:29").toISOString()).toBe("2026-10-28T08:09:29.000Z");
    expect(parisTime("2026-07-01T09:00:00").toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(parisTime("2026-07-01T09:00:00Z").toISOString()).toBe("2026-07-01T09:00:00.000Z");
  });

  it("stores an activity like the history import", () => {
    const payload = ingestPayload.parse({
      type: "activities",
      activities: [{ id: 123, name: "Footing", sport: "Run", start: "2026-11-19T18:30:00", distanceM: 8012.4, movingS: 2700, avgHr: 151.6, maxHr: null }],
    });
    if (payload.type !== "activities") throw new Error();
    const { id, data } = toActivityDoc(payload.activities[0]);
    expect(id).toBe("strava_123");
    expect(data).toMatchObject({ source: "strava", sport: "Run", distanceM: 8012, durationS: 2700, avgHr: 152, maxHr: null, paceSecKm: 337, tags: [] });
    expect(data.date.toISOString()).toBe("2026-11-19T17:30:00.000Z");
  });

  it("refuses an activity without a sport or a start", () => {
    expect(ingestPayload.safeParse({ type: "activities", activities: [{ id: 1, start: "2026-11-19T18:30:00" }] }).success).toBe(false);
  });
});
