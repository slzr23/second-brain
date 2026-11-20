import { z } from "zod";
import { TIME_ZONE } from "../lib/week";

/**
 * Same format as the Strava history import (web/src/import/strava.ts): the morning
 * routine reads the new activities with Claude's Strava connector and sends them here.
 */
const num = z.number().finite().nullish();

export const stravaActivity = z.object({
  id: z.union([z.string().min(1), z.number().int()]),
  name: z.string().max(200).nullish(),
  sport: z.string().min(1).max(40),
  /** Local start time, "2026-10-28T09:09:29", or with a zone. */
  start: z.string().min(10),
  distanceM: num,
  movingS: num,
  elapsedS: num,
  elevationM: num,
  avgHr: num,
  maxHr: num,
  cadence: num,
  calories: num,
  relativeEffort: num,
  tags: z.array(z.string().max(40)).max(20).nullish(),
  location: z.string().max(200).nullish(),
  description: z.string().max(5000).nullish(),
});

export type StravaActivity = z.infer<typeof stravaActivity>;

/** Paris wall-clock time → instant: "2026-10-28T09:09:29" is 08:09:29Z in winter. */
export function parisTime(local: string): Date {
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(local)) return new Date(local);
  const asUtc = new Date(`${local}Z`);
  if (Number.isNaN(asUtc.getTime())) return asUtc;
  // Offset of Paris at that moment, read back from Intl.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(asUtc)
      .map((p) => [p.type, p.value]),
  );
  const seen = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(asUtc.getTime() - (seen - asUtc.getTime()));
}

const round = (v: number | null | undefined) => (typeof v === "number" ? Math.round(v) : null);

/** Firestore document for users/{uid}/activities/strava_{id}, as the web import writes it. */
export function toActivityDoc(a: StravaActivity) {
  const date = parisTime(a.start);
  if (Number.isNaN(date.getTime())) throw new Error(`Date illisible : ${a.start}`);
  const distanceM = a.distanceM ?? 0;
  const durationS = a.movingS ?? a.elapsedS ?? 0;
  return {
    id: `strava_${a.id}`,
    data: {
      source: "strava" as const,
      name: a.name?.trim() || a.sport,
      sport: a.sport,
      date,
      distanceM: Math.round(distanceM),
      durationS: Math.round(durationS),
      elapsedS: Math.round(a.elapsedS ?? durationS),
      elevationM: round(a.elevationM),
      avgHr: round(a.avgHr),
      maxHr: round(a.maxHr),
      paceSecKm: distanceM > 0 ? Math.round(durationS / (distanceM / 1000)) : 0,
      relativeEffort: round(a.relativeEffort),
      cadence: round(a.cadence),
      calories: round(a.calories),
      tags: a.tags ?? [],
      location: a.location ?? null,
      description: a.description?.trim() || null,
    },
  };
}
