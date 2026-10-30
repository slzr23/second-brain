import type { ImportedActivity } from "../data/types";

/**
 * Strava activity history as JSON: { source: "strava", activities: [...] }, one entry
 * per activity with Strava's summary fields (SI units: metres, seconds, m/s).
 * Heart rate may be missing (no sensor, or not fetched for older activities).
 */
export interface StravaExport {
  source: "strava";
  activities: StravaActivity[];
}

interface StravaActivity {
  id: string | number;
  name?: string;
  sport: string;
  /** Local start time, ISO without zone: "2026-10-28T09:09:29". */
  start: string;
  distanceM?: number;
  movingS?: number;
  elapsedS?: number;
  elevationM?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  cadence?: number | null;
  calories?: number | null;
  relativeEffort?: number | null;
  tags?: string[];
  location?: string | null;
  description?: string | null;
}

export const isStravaExport = (text: string) => /^\s*\{[\s\S]*"source"\s*:\s*"strava"/.test(text.slice(0, 200));

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseStrava(text: string): ImportedActivity[] {
  const data = JSON.parse(text) as StravaExport;
  if (data?.source !== "strava" || !Array.isArray(data.activities)) throw new Error("Export Strava illisible.");

  return data.activities.map((a) => {
    const date = new Date(a.start);
    if (!a.id || !a.sport || Number.isNaN(date.getTime())) throw new Error(`Activité Strava illisible : ${JSON.stringify(a).slice(0, 80)}`);
    const distanceM = num(a.distanceM) ?? 0;
    const durationS = num(a.movingS) ?? num(a.elapsedS) ?? 0;
    const round = (v: unknown) => (num(v) === null ? null : Math.round(num(v)!));
    return {
      id: `strava_${a.id}`,
      source: "strava",
      name: a.name?.trim() || a.sport,
      sport: a.sport,
      date,
      distanceM: Math.round(distanceM),
      durationS: Math.round(durationS),
      elapsedS: Math.round(num(a.elapsedS) ?? durationS),
      elevationM: round(a.elevationM),
      avgHr: round(a.avgHr),
      maxHr: round(a.maxHr),
      paceSecKm: distanceM > 0 ? Math.round(durationS / (distanceM / 1000)) : 0,
      relativeEffort: round(a.relativeEffort),
      // As Strava gives it: strides per minute for runs (double it for steps per minute).
      cadence: round(a.cadence),
      calories: round(a.calories),
      tags: Array.isArray(a.tags) ? a.tags.filter((t) => typeof t === "string") : [],
      location: a.location ?? null,
      description: a.description?.trim() || null,
    };
  });
}

export interface ActivitySummary {
  total: number;
  fresh: number;
  from: Date | null;
  to: Date | null;
  runs: number;
  runKm: number;
  withHr: number;
  /** Other sports, most frequent first. */
  others: [sport: string, count: number][];
}

/** What the import preview shows. Activities already stored are refreshed, not duplicated. */
export function summarizeActivities(items: ImportedActivity[], existingIds: Set<string>): ActivitySummary {
  const times = items.map((a) => a.date.getTime());
  const runs = items.filter((a) => ["Run", "TrailRun", "VirtualRun"].includes(a.sport));
  const others = new Map<string, number>();
  for (const a of items) if (!runs.includes(a)) others.set(a.sport, (others.get(a.sport) ?? 0) + 1);
  return {
    total: items.length,
    fresh: items.filter((a) => !existingIds.has(a.id)).length,
    from: times.length ? new Date(Math.min(...times)) : null,
    to: times.length ? new Date(Math.max(...times)) : null,
    runs: runs.length,
    runKm: Math.round(runs.reduce((sum, a) => sum + a.distanceM, 0) / 1000),
    withHr: items.filter((a) => a.avgHr !== null).length,
    others: [...others].sort((a, b) => b[1] - a[1]),
  };
}
