import { isRun, type Activity, type WeekStats } from "../data/types";

/** French names of Strava sport types. */
export const SPORT_LABELS: Record<string, string> = {
  Run: "Course",
  TrailRun: "Trail",
  VirtualRun: "Course sur tapis",
  Ride: "Vélo",
  VirtualRide: "Home trainer",
  Swim: "Natation",
  Hike: "Randonnée",
  Walk: "Marche",
  Soccer: "Foot",
  Padel: "Padel",
  Tennis: "Tennis",
  Basketball: "Basket",
  Volleyball: "Volley",
  AlpineSki: "Ski",
  Workout: "Renfo",
  WeightTraining: "Muscu",
};

export const sportLabel = (sport: string) => SPORT_LABELS[sport] ?? sport;

/** Monday 00:00 of the week containing `d`. */
export const weekStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));

/**
 * This week's running, computed from the activities: volume, runs, time and
 * kilometres per day. The goal is the average of the 4 previous weeks, so the
 * ring says "as much as usual" rather than an arbitrary target.
 */
export function weekFromActivities(activities: Activity[], now = new Date()): (WeekStats & { avgHr: number | null }) | null {
  const runs = activities.filter(isRun);
  if (runs.length === 0) return null;
  const monday = weekStart(now);
  const thisWeek = runs.filter((a) => a.date >= monday);
  const km = (list: Activity[]) => list.reduce((sum, a) => sum + a.distanceM, 0) / 1000;

  const previous = [1, 2, 3, 4].map((n) => {
    const from = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * n);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    return km(runs.filter((a) => a.date >= from && a.date < to));
  });
  const goal = previous.reduce((a, b) => a + b, 0) / previous.length;

  const byDayKm = Array.from({ length: 7 }, (_, i) => Math.round(km(thisWeek.filter((a) => (a.date.getDay() + 6) % 7 === i)) * 10) / 10);
  const withHr = thisWeek.filter((a) => a.avgHr);
  const time = withHr.reduce((sum, a) => sum + a.durationS, 0);

  return {
    volumeKm: Math.round(km(thisWeek) * 10) / 10,
    goalKm: Math.round(goal) || 0,
    runs: thisWeek.length,
    durationS: thisWeek.reduce((sum, a) => sum + a.durationS, 0),
    avgRestHr: null,
    byDayKm,
    timeInZones: [],
    // Time-weighted average heart rate of the week's runs.
    avgHr: time ? Math.round(withHr.reduce((sum, a) => sum + a.avgHr! * a.durationS, 0) / time) : null,
  };
}
