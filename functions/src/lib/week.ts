export const TIME_ZONE = "Europe/Paris";

/** Calendar date (YYYY-MM-DD) of `date` as seen in `timeZone`. */
export function localDateKey(date: Date, timeZone = TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** ISO-8601 week id ("2026-W43") of `date` as seen in `timeZone`. */
export function isoWeekId(date: Date, timeZone = TIME_ZONE): string {
  const [y, m, d] = localDateKey(date, timeZone).split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  // Move to the Thursday of the same ISO week: that Thursday's year is the ISO year.
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const isoYear = day.getUTCFullYear();
  const firstDay = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((day.getTime() - firstDay.getTime()) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}
