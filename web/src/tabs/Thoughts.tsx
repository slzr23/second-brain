import { useState, type FormEvent } from "react";
import { useData } from "../data/DataProvider";
import type { EntryKind } from "../data/types";
import { formatDay, formatTime } from "../lib/format";

const KIND_LABEL: Record<EntryKind, string> = { dream: "Rêve", note: "Note" };
type Filter = "all" | EntryKind;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "dream", label: "Rêves" },
  { id: "note", label: "Notes" },
];

function QuickEntry() {
  const { addEntry } = useData();
  const [kind, setKind] = useState<EntryKind>("dream");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    await addEntry(kind, text.trim());
    setText("");
    setSaving(false);
  }

  return (
    <form className="quick" onSubmit={submit}>
      <div className="segmented" role="radiogroup" aria-label="Type">
        {(["dream", "note"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="entry-text">
        Texte
      </label>
      <textarea
        id="entry-text"
        rows={3}
        value={text}
        placeholder={kind === "dream" ? "De quoi as-tu rêvé ?" : "Qu'as-tu en tête ?"}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="primary" disabled={saving || !text.trim()}>
        {saving ? "Enregistrement…" : `Enregistrer ${kind === "dream" ? "le rêve" : "la note"}`}
      </button>
    </form>
  );
}

export function Thoughts() {
  const { entries } = useData();
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? entries : entries.filter((e) => e.kind === filter);

  return (
    <>
      <section className="block">
        <QuickEntry />
        <p className="hint">Sur iPhone, l'Action Button envoie directement ici.</p>
      </section>

      <section className="block">
        <div className="row heading">
          <h2>Journal</h2>
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="empty">Rien ici pour l'instant. Note ton prochain rêve au réveil, avant qu'il s'efface.</p>
        ) : (
          <ul className="list">
            {shown.map((e) => (
              <li key={e.id} className="entry" data-kind={e.kind}>
                <div className="row">
                  <span className="kind">{KIND_LABEL[e.kind]}</span>
                  <time className="muted">
                    {formatDay(e.createdAt)}, {formatTime(e.createdAt)}
                  </time>
                </div>
                <p className="entry-text">{e.text}</p>
                {e.tags.length > 0 && (
                  <ul className="tags" aria-label="Tags">
                    {e.tags.map((t) => (
                      <li key={t}>#{t}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <h2>Thèmes de la semaine</h2>
        <p className="empty">Chaque dimanche, Claude lit les rêves de la semaine et résume ici les thèmes qui reviennent.</p>
      </section>
    </>
  );
}
