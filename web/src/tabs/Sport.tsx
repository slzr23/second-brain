import { useData } from "../data/DataProvider";
import { formatDay, formatDuration, formatKm, formatPace } from "../lib/format";

const ZONES = ["Z1", "Z2", "Z3", "Z4", "Z5"];

function ZoneBar({ seconds }: { seconds: number[] }) {
  const total = seconds.reduce((a, b) => a + b, 0) || 1;
  return (
    <figure className="zones">
      <div className="zone-track" role="img" aria-label="Temps passé dans chaque zone de fréquence cardiaque">
        {seconds.map((s, i) => (
          <span key={ZONES[i]} className={`zone z${i + 1}`} style={{ flexGrow: s / total }} />
        ))}
      </div>
      <figcaption className="zone-legend">
        {seconds.map((s, i) => (
          <span key={ZONES[i]}>
            <b>{ZONES[i]}</b> {formatDuration(s)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function Sport() {
  const { week, activities } = useData();

  return (
    <>
      <section className="block">
        <h2>Cette semaine</h2>
        {week ? (
          <>
            <div className="figures">
              <p className="figure">
                <span className="figure-value">{week.volumeKm.toFixed(1).replace(".", ",")}</span>
                <span className="figure-unit">km</span>
              </p>
              <p className="figure">
                <span className="figure-value">{week.runs}</span>
                <span className="figure-unit">{week.runs > 1 ? "sorties" : "sortie"}</span>
              </p>
              {week.avgRestHr && (
                <p className="figure">
                  <span className="figure-value">{week.avgRestHr}</span>
                  <span className="figure-unit">bpm au repos</span>
                </p>
              )}
            </div>
            <ZoneBar seconds={week.timeInZones} />
          </>
        ) : (
          <p className="empty">Le bilan de la semaine apparaîtra après ta première sortie synchronisée.</p>
        )}
      </section>

      <section className="block">
        <h2>Dernières sorties</h2>
        {activities.length === 0 ? (
          <p className="empty">Aucune sortie pour l'instant. Connecte Strava pour les importer automatiquement.</p>
        ) : (
          <ul className="list">
            {activities.map((a) => (
              <li key={a.id} className="run">
                <div className="row">
                  <strong>{a.name}</strong>
                  <time className="muted">{formatDay(a.date)}</time>
                </div>
                <p className="run-stats">
                  <span>{formatKm(a.distanceM)}</span>
                  <span>{formatDuration(a.durationS)}</span>
                  <span>{formatPace(a.paceSecKm)}</span>
                  {a.avgHr && <span>{a.avgHr} bpm</span>}
                </p>
                {a.report && <p className="report">{a.report.summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
