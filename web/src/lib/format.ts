const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const weekdayDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const shortDay = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const formatEuros = (cents: number) => euros.format(cents / 100);
export const formatTime = (date: Date) => time.format(date);
export const formatToday = (date = new Date()) => capitalize(weekdayDay.format(date));
export const formatShortDay = (date: Date) => shortDay.format(date);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Aujourd'hui", "Hier", or "Mercredi 21 octobre", as iOS groups lists. */
export function formatDayHeading(date: Date, now = new Date()): string {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return capitalize(weekdayDay.format(date));
}

/** "Aujourd'hui, 07:10" / "Hier, 18:30" / "mer. 21 oct." */
export function formatWhen(date: Date, now = new Date()): string {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return `Aujourd'hui, ${formatTime(date)}`;
  if (days === 1) return `Hier, ${formatTime(date)}`;
  return shortDay.format(date);
}

/** Groups items by calendar day, keeping the given order (newest first). */
export function groupByDay<T>(items: T[], getDate: (item: T) => Date): { day: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = formatDayHeading(getDate(item));
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups].map(([day, list]) => ({ day, items: list }));
}

/** 312 → "5:12" */
export function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** 2870 → "47:50" ; 6420 → "1:47:00" (Strava style) */
export function formatClock(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** 15120 → "4 h 12" ; 1500 → "25 min" */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

export const formatKm = (meters: number) => (meters / 1000).toFixed(2).replace(".", ",");
