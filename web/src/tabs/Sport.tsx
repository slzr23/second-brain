import NumberFlow from "@number-flow/react";
import {
  Barbell,
  Basketball,
  Bicycle,
  ChatCircleText,
  PersonSimpleHike,
  PersonSimpleRun,
  PersonSimpleSki,
  PersonSimpleWalk,
  SoccerBall,
  SwimmingPool,
  TennisBall,
  Volleyball,
  type Icon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { WeekBars } from "../charts/WeekBars";
import { Ring } from "../components/Ring";
import { useData } from "../data/context";
import { isRun, type Activity } from "../data/types";
import { formatClock, formatDuration, formatKm, formatPace, formatWhen } from "../lib/format";
import { sportLabel, weekFromActivities } from "../lib/sport";

const SPORT_ICONS: Record<string, Icon> = {
  Run: PersonSimpleRun,
  TrailRun: PersonSimpleRun,
  VirtualRun: PersonSimpleRun,
  Ride: Bicycle,
  VirtualRide: Bicycle,
  Swim: SwimmingPool,
  Hike: PersonSimpleHike,
  Walk: PersonSimpleWalk,
  Soccer: SoccerBall,
  Padel: TennisBall,
  Tennis: TennisBall,
  Basketball: Basketball,
  Volleyball: Volleyball,
  AlpineSki: PersonSimpleSki,
  Workout: Barbell,
  WeightTraining: Barbell,
};
const PAGE = 15;

const ZONES = ["Récupération", "Endurance", "Tempo", "Seuil", "VO2 max"];

function Week() {
  const { week: stored, activities } = useData();
  const computed = weekFromActivities(activities);
  const week = stored ?? computed;
  if (!week) {
    return (
      <div className="card">
        <p className="card-title">Cette semaine</p>
        <p className="empty">Ton bilan apparaîtra après ta première sortie synchronisée depuis Strava.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="hero-row">
        <div>
          <p className="card-title">Cette semaine</p>
          <p className="hero-value">
            <NumberFlow value={week.volumeKm} locales="fr-FR" format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} />
            <span className="unit">km</span>
          </p>
          <p className="secondary" style={{ fontSize: 15 }}>
            {stored ? `Objectif ${week.goalKm} km` : `${week.goalKm} km en moyenne sur 4 semaines`}
          </p>
        </div>
        {week.goalKm > 0 && (
          <Ring
            progress={week.volumeKm / week.goalKm}
            label={`${Math.round((week.volumeKm / week.goalKm) * 100)} % ${stored ? "de l'objectif" : "de ta moyenne"}`}
          />
        )}
      </div>

      <WeekBars km={week.byDayKm} />

      <div className="stats">
        <div>
          <p className="stat-label">Sorties</p>
          <p className="stat-value">{week.runs}</p>
        </div>
        <div>
          <p className="stat-label">Durée</p>
          <p className="stat-value">{formatDuration(week.durationS)}</p>
        </div>
        {week.avgRestHr !== null || !computed ? (
          <div>
            <p className="stat-label">FC au repos</p>
            <p className="stat-value">
              {week.avgRestHr ?? "–"}
              <small>bpm</small>
            </p>
          </div>
        ) : (
          <div>
            <p className="stat-label">FC moy.</p>
            <p className="stat-value">
              {computed.avgHr ?? "–"}
              <small>bpm</small>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Zones() {
  const { week } = useData();
  if (!week || week.timeInZones.length === 0) return null;
  const total = week.timeInZones.reduce((a, b) => a + b, 0) || 1;

  return (
    <section className="section">
      <div className="section-header">
        <h2>Zones cardiaques</h2>
        <span className="secondary">{formatDuration(total)}</span>
      </div>
      <div className="card">
        <div className="stack" role="img" aria-label="Répartition du temps par zone de fréquence cardiaque">
          {week.timeInZones.map((s, i) => (
            <span key={i} className={`z${i + 1}`} style={{ flexGrow: s / total }} />
          ))}
        </div>
        <ul className="legend">
          {week.timeInZones.map((s, i) => (
            <li key={i} className={`z${i + 1}`}>
              <span className="dot" />
              <span>
                Z{i + 1} <span className="secondary">{ZONES[i]}</span>
              </span>
              <span className="num">{formatDuration(s)}</span>
              <span className="pct num">{Math.round((s / total) * 100)} %</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ActivityCard({ a }: { a: Activity }) {
  const SportIcon = SPORT_ICONS[a.sport] ?? Barbell;
  const run = isRun(a);
  const stats: { label: string; value: string; unit?: string }[] = [];
  if (a.distanceM > 0) stats.push({ label: "Distance", value: formatKm(a.distanceM), unit: "km" });
  if (run && a.paceSecKm > 0) stats.push({ label: "Allure", value: formatPace(a.paceSecKm), unit: "/km" });
  stats.push({ label: "Temps", value: formatClock(a.durationS) });
  if (a.avgHr) stats.push({ label: "FC moy.", value: String(a.avgHr) });
  else if (!run && a.elevationM) stats.push({ label: "Dénivelé", value: String(a.elevationM), unit: "m" });

  return (
    <article className="card">
      <div className="run-head">
        <span className="avatar tone-sport" aria-hidden>
          <SportIcon size={22} weight="fill" />
        </span>
        <div>
          <h3>{a.name}</h3>
          <p>
            {formatWhen(a.date)}
            {!run && ` · ${sportLabel(a.sport)}`}
          </p>
        </div>
      </div>
      <div className="run-stats" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
        {stats.map((s) => (
          <div key={s.label}>
            <p className="stat-label">{s.label}</p>
            <p className="stat-value">
              {s.value}
              {s.unit && <small>{s.unit}</small>}
            </p>
          </div>
        ))}
      </div>
      {a.report && (
        <div className="coach">
          <p className="coach-head">
            <ChatCircleText size={16} weight="fill" aria-hidden />
            Compte rendu
          </p>
          <p>{a.report.summary}</p>
        </div>
      )}
    </article>
  );
}

function Activities() {
  const { activities } = useData();
  const [shown, setShown] = useState(PAGE);

  return (
    <section className="section">
      <div className="section-header">
        <h2>Activités</h2>
        {activities.length > 0 && <span className="secondary">{activities.length}</span>}
      </div>
      {activities.length === 0 ? (
        <div className="card">
          <p className="empty">Aucune sortie pour l'instant. Importe ton historique Strava avec le bouton +, puis chaque course arrivera ici avec son compte rendu.</p>
        </div>
      ) : (
        <>
          {activities.slice(0, shown).map((a) => (
            <ActivityCard key={a.id} a={a} />
          ))}
          {shown < activities.length && (
            <button className="card more-button" onClick={() => setShown((n) => n + PAGE)}>
              Afficher {Math.min(PAGE, activities.length - shown)} de plus
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function Sport() {
  return (
    <>
      <section className="section" style={{ marginTop: 12 }}>
        <Week />
      </section>
      <Zones />
      <Activities />
    </>
  );
}
