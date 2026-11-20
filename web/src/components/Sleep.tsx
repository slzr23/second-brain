import { useData } from "../data/context";
import { formatTime } from "../lib/format";

const DAYS = ["D", "L", "M", "M", "J", "V", "S"];
/** Usual advice for adults: 7 to 9 hours. */
const GOAL_MIN = 7 * 60;

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hours = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;

const STAGES = [
  { key: "deepMin", label: "Profond", color: "var(--indigo)" },
  { key: "coreMin", label: "Léger", color: "var(--blue)" },
  { key: "remMin", label: "Paradoxal", color: "var(--teal)" },
  { key: "awakeMin", label: "Éveillé", color: "var(--orange)" },
] as const;

/** Last night and the week, sent each morning by the Apple Health shortcut (Garmin writes the nights there). */
export function Sleep() {
  const { health } = useData();
  const nights = health.filter((h) => h.sleep);
  const restingHr = health.find((h) => h.restingHr)?.restingHr ?? null;
  if (nights.length === 0 && restingHr === null) return null;

  const last = nights[0]?.sleep ?? null;
  const byDay = new Map(nights.map((h) => [h.day, h.sleep!.asleepMin]));
  const today = new Date();
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + i);
    return { label: DAYS[d.getDay()], min: byDay.get(key(d)) ?? 0, today: i === 6 };
  });
  const past = week.filter((d) => d.min > 0);
  const average = past.length ? Math.round(past.reduce((s, d) => s + d.min, 0) / past.length) : null;
  const max = Math.max(GOAL_MIN + 60, ...week.map((d) => d.min));
  const staged = last ? STAGES.reduce((s, st) => s + last[st.key], 0) : 0;

  return (
    <section className="section">
      <div className="section-header">
        <h2>Sommeil</h2>
        {average !== null && <span className="secondary">{hours(average)} en moyenne</span>}
      </div>
      <div className="card">
        {last ? (
          <>
            <p className="hero-value num">{hours(last.asleepMin)}</p>
            <p className="secondary" style={{ fontSize: 15 }}>
              {formatTime(last.start)} → {formatTime(last.end)}
              {restingHr !== null && ` · FC au repos ${restingHr}`}
            </p>
            {staged > 0 && (
              <>
                <div className="sleep-stages" role="img" aria-label={STAGES.map((st) => `${st.label} ${hours(last[st.key])}`).join(", ")}>
                  {STAGES.map((st) => last[st.key] > 0 && <span key={st.key} style={{ flexGrow: last[st.key], background: st.color }} />)}
                </div>
                <ul className="sleep-legend">
                  {STAGES.map((st) => (
                    <li key={st.key}>
                      <i style={{ background: st.color }} />
                      {st.label} <span className="num secondary">{hours(last[st.key])}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <p className="hero-value num">
            {restingHr}
            <span className="unit">FC au repos</span>
          </p>
        )}
        {past.length > 1 && (
          <>
            <div className="water-week sleep-week" role="img" aria-label={week.map((d) => `${d.label} ${hours(d.min)}`).join(", ")}>
              <i className="water-goal" style={{ bottom: `${(GOAL_MIN / max) * 100}%` }} />
              {week.map((d, i) => (
                <span key={i} className={d.today ? "today" : undefined} style={{ height: `${Math.max(3, (d.min / max) * 100)}%` }} />
              ))}
            </div>
            <div className="water-days" aria-hidden>
              {week.map((d, i) => (
                <small key={i}>{d.label}</small>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
