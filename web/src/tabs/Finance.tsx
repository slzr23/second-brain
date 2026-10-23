import { useData } from "../data/DataProvider";
import { NECESSITIES, type Necessity, type Transaction } from "../data/types";
import { formatDay, formatEuros } from "../lib/format";

const NECESSITY_LABEL: Record<Necessity, string> = {
  essentiel: "Essentiel",
  social: "Social",
  superflu: "Superflu",
};

const isThisMonth = (date: Date, now = new Date()) =>
  date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();

function MonthSplit({ expenses }: { expenses: Transaction[] }) {
  const total = expenses.reduce((sum, t) => sum - t.amountCents, 0);
  const groups = [...NECESSITIES, null].map((n) => ({
    key: n ?? "untagged",
    label: n ? NECESSITY_LABEL[n] : "À trier",
    cents: expenses.filter((t) => t.necessity === n).reduce((sum, t) => sum - t.amountCents, 0),
  }));
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date());

  return (
    <>
      <p className="figure">
        <span className="figure-value">{formatEuros(total)}</span>
        <span className="figure-unit">dépensés en {month}</span>
      </p>
      <figure className="split">
        <div className="split-track" role="img" aria-label="Répartition des dépenses du mois">
          {groups.map((g) => (
            <span key={g.key} className={`split-part n-${g.key}`} style={{ flexGrow: total ? g.cents / total : 0 }} />
          ))}
        </div>
        <figcaption className="split-legend">
          {groups.map((g) => (
            <span key={g.key} className={`n-${g.key}`}>
              <i aria-hidden /> {g.label} <b>{formatEuros(g.cents)}</b>
            </span>
          ))}
        </figcaption>
      </figure>
    </>
  );
}

export function Finance() {
  const { transactions, tagTransaction } = useData();
  const expenses = transactions.filter((t) => t.amountCents < 0);
  const toSort = expenses.filter((t) => t.necessity === null);

  return (
    <>
      <section className="block">
        <h2>Ce mois-ci</h2>
        <MonthSplit expenses={expenses.filter((t) => isThisMonth(t.date))} />
      </section>

      {toSort.length > 0 && (
        <section className="block">
          <h2>À trier</h2>
          <p className="hint">Cette dépense comptait-elle vraiment ?</p>
          <ul className="list">
            {toSort.map((t) => (
              <li key={t.id} className="tx">
                <div className="row">
                  <span>{t.label}</span>
                  <b className="amount">{formatEuros(t.amountCents)}</b>
                </div>
                <div className="sort-actions">
                  {NECESSITIES.map((n) => (
                    <button key={n} className={`sort n-${n}`} onClick={() => tagTransaction(t.id, n)}>
                      {NECESSITY_LABEL[n]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block">
        <h2>Mouvements</h2>
        {transactions.length === 0 ? (
          <p className="empty">Aucun mouvement. Ajoute une dépense depuis l'Action Button, ou paie avec Apple Pay.</p>
        ) : (
          <ul className="list">
            {transactions.map((t) => (
              <li key={t.id} className="tx">
                <div className="row">
                  <span>
                    {t.label}
                    <small className="muted">
                      {formatDay(t.date)}
                      {t.necessity && `, ${NECESSITY_LABEL[t.necessity].toLowerCase()}`}
                    </small>
                  </span>
                  <b className={t.amountCents > 0 ? "amount in" : "amount"}>
                    {t.amountCents > 0 ? "+" : ""}
                    {formatEuros(t.amountCents)}
                  </b>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <h2>Patrimoine</h2>
        <p className="empty">Comptes, livrets, actions et bitcoin arriveront ici avec la synchronisation bancaire.</p>
      </section>
    </>
  );
}
