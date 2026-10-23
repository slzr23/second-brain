const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const shortDay = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const longDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export const formatEuros = (cents: number) => euros.format(cents / 100);
export const formatDay = (date: Date) => shortDay.format(date);
export const formatTime = (date: Date) => time.format(date);
export const formatToday = (date = new Date()) => longDay.format(date);

/** 312 → "5:12 /km" */
export function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} /km`;
}

/** 3725 → "1 h 02" ; 1500 → "25 min" */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

export const formatKm = (meters: number) => `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
