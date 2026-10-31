import { useData } from "../data/context";

/** Daily target. Fixed for now; most guidance lands around 1.5 to 2 litres of drinks a day. */
const GOAL_ML = 2000;
const DAYS = ["D", "L", "M", "M", "J", "V", "S"];

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const litres = (ml: number) => (ml / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** Today's water against the goal, and the last 7 days. Fed by the "Eau" choice of the iPhone shortcut. */
export function Hydration() {
  const { hydration } = useData();
  if (hydration.length === 0) return null;

  const byDay = new Map(hydration.map((h) => [h.day, h.ml]));
  const today = new Date();
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + i);
    return { label: DAYS[d.getDay()], ml: byDay.get(key(d)) ?? 0, today: i === 6 };
  });
  const now = week[6].ml;
  const past = week.slice(0, 6).filter((d) => d.ml > 0);
  const average = past.length ? Math.round(past.reduce((s, d) => s + d.ml, 0) / past.length) : null;
  const max = Math.max(GOAL_ML, ...week.map((d) => d.ml));

  return (
    <section className="section">
      <div className="section-header">
        <h2>Hydratation</h2>
        {average !== null && <span className="secondary">{litres(average)} L en moyenne</span>}
      </div>
      <div className="card">
        <p className="hero-value">
          {litres(now)}
          <span className="unit">L</span>
        </p>
        <p className="secondary" style={{ fontSize: 15 }}>
          {now >= GOAL_ML ? "Objectif de 2 L atteint" : `Encore ${litres(GOAL_ML - now)} L pour atteindre 2 L`}
        </p>
        <div className="water-bar" role="progressbar" aria-valuemin={0} aria-valuemax={GOAL_ML} aria-valuenow={now} aria-label="Eau bue aujourd'hui">
          <span style={{ width: `${Math.min(100, (now / GOAL_ML) * 100)}%` }} />
        </div>
        <div className="water-week" role="img" aria-label={week.map((d) => `${d.label} ${litres(d.ml)} L`).join(", ")}>
          <i className="water-goal" style={{ bottom: `${(GOAL_ML / max) * 100}%` }} />
          {week.map((d, i) => (
            <span key={i} className={d.today ? "today" : undefined} style={{ height: `${Math.max(3, (d.ml / max) * 100)}%` }} />
          ))}
        </div>
        <div className="water-days" aria-hidden>
          {week.map((d, i) => (
            <small key={i}>{d.label}</small>
          ))}
        </div>
      </div>
    </section>
  );
}
