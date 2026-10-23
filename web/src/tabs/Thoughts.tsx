import { MoonStars, NotePencil } from "@phosphor-icons/react";
import { useState } from "react";
import { Segmented } from "../components/Segmented";
import { useData } from "../data/context";
import type { EntryKind } from "../data/types";
import { formatTime, groupByDay } from "../lib/format";

type Filter = "all" | EntryKind;
const FILTERS = [
  { id: "all", label: "Tout" },
  { id: "dream", label: "Rêves" },
  { id: "note", label: "Notes" },
] as const;

const KIND = {
  dream: { label: "Rêve", icon: MoonStars },
  note: { label: "Note", icon: NotePencil },
} as const;

function WeeklyThemes() {
  const { dreamReport } = useData();
  return (
    <div className="card">
      <p className="card-title">Thèmes de la semaine</p>
      {dreamReport ? (
        <>
          <p className="report-text">{dreamReport.summary}</p>
          <div className="themes">
            {dreamReport.themes.map((t) => (
              <span key={t.name} className="theme">
                {t.name}
                <b className="num">{t.count}</b>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="empty">Chaque dimanche, Claude lit tes rêves de la semaine et résume ici ce qui revient.</p>
      )}
    </div>
  );
}

export function Thoughts() {
  const { entries } = useData();
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? entries : entries.filter((e) => e.kind === filter);

  return (
    <>
      <div style={{ marginTop: 12 }}>
        <Segmented id="thoughts-filter" label="Afficher" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {filter !== "note" && (
        <section className="section" style={{ marginTop: 16 }}>
          <WeeklyThemes />
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2>Journal</h2>
          <span className="secondary num">{shown.length}</span>
        </div>
        {shown.length === 0 ? (
          <div className="card">
            <p className="empty">
              Rien ici pour l'instant. Note ton prochain rêve au réveil avec l'Action Button ou le bouton +, avant qu'il s'efface.
            </p>
          </div>
        ) : (
          groupByDay(shown, (e) => e.createdAt).map((group) => (
            <div key={group.day}>
              <h3 className="group-day">{group.day}</h3>
              {group.items.map((e) => {
                const { label, icon: Icon } = KIND[e.kind];
                return (
                  <article key={e.id} className={`card entry-card tone-${e.kind}`}>
                    <p className="entry-meta">
                      <span className="kind">
                        <Icon size={16} weight="fill" aria-hidden />
                        {label}
                      </span>
                      <time>{formatTime(e.createdAt)}</time>
                    </p>
                    <p className="entry-text">{e.text}</p>
                    {e.tags.length > 0 && (
                      <div className="tags">
                        {e.tags.map((t) => (
                          <span key={t} className="tag">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ))
        )}
      </section>
    </>
  );
}
