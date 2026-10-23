import NumberFlow from "@number-flow/react";
import { ChatCircleText, PersonSimpleRun } from "@phosphor-icons/react";
import { WeekBars } from "../charts/WeekBars";
import { Ring } from "../components/Ring";
import { useData } from "../data/context";
import { formatClock, formatDuration, formatKm, formatPace, formatWhen } from "../lib/format";

const ZONES = ["Récupération", "Endurance", "Tempo", "Seuil", "VO2 max"];

function Week() {
  const { week } = useData();
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
            Objectif {week.goalKm} km
          </p>
        </div>
        <Ring progress={week.volumeKm / week.goalKm} label={`${Math.round((week.volumeKm / week.goalKm) * 100)} % de l'objectif`} />
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
        <div>
          <p className="stat-label">FC au repos</p>
          <p className="stat-value">
            {week.avgRestHr ?? "–"}
            <small>bpm</small>
          </p>
        </div>
      </div>
    </div>
  );
}

function Zones() {
  const { week } = useData();
  if (!week) return null;
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

function Activities() {
  const { activities } = useData();

  return (
    <section className="section">
      <div className="section-header">
        <h2>Activités</h2>
      </div>
      {activities.length === 0 ? (
        <div className="card">
          <p className="empty">Aucune sortie pour l'instant. Une fois Strava connecté, chaque course arrivera ici avec son compte rendu.</p>
        </div>
      ) : (
        activities.map((a) => (
          <article key={a.id} className="card">
            <div className="run-head">
              <span className="avatar tone-sport" aria-hidden>
                <PersonSimpleRun size={22} weight="fill" />
              </span>
              <div>
                <h3>{a.name}</h3>
                <p>{formatWhen(a.date)}</p>
              </div>
            </div>
            <div className="run-stats" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              <div>
                <p className="stat-label">Distance</p>
                <p className="stat-value">
                  {formatKm(a.distanceM)}
                  <small>km</small>
                </p>
              </div>
              <div>
                <p className="stat-label">Allure</p>
                <p className="stat-value">
                  {formatPace(a.paceSecKm)}
                  <small>/km</small>
                </p>
              </div>
              <div>
                <p className="stat-label">Temps</p>
                <p className="stat-value">{formatClock(a.durationS)}</p>
              </div>
              <div>
                <p className="stat-label">FC moy.</p>
                <p className="stat-value">{a.avgHr ?? "–"}</p>
              </div>
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
        ))
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
