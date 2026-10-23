import NumberFlow from "@number-flow/react";
import { ArrowDownLeft, Bank } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { SpendArea } from "../charts/SpendArea";
import { useData } from "../data/context";
import { NECESSITIES, NECESSITY_LABEL, type Necessity, type Transaction } from "../data/types";
import { formatEuros, formatTime, groupByDay } from "../lib/format";

const SOURCE_LABEL: Record<Transaction["source"], string> = {
  apple_pay: "Apple Pay",
  bank: "Banque",
  manual: "Saisie",
};

const toneOf = (t: Transaction) => (t.amountCents > 0 ? "income" : (t.necessity ?? "untagged"));
const initial = (label: string) => label.trim().charAt(0).toUpperCase();

function Avatar({ t }: { t: Transaction }) {
  return (
    <span className={`avatar tone-${toneOf(t)}`} aria-hidden>
      {t.amountCents > 0 ? <ArrowDownLeft size={20} weight="bold" /> : initial(t.label)}
    </span>
  );
}

function Amount({ cents }: { cents: number }) {
  return (
    <span className={`list-row-value num${cents > 0 ? " positive" : ""}`}>
      {cents > 0 ? "+" : ""}
      {formatEuros(cents)}
    </span>
  );
}

function Month({ expenses, incomeCents, toSortCount }: { expenses: Transaction[]; incomeCents: number; toSortCount: number }) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daily = Array.from({ length: daysInMonth }, () => 0);
  for (const t of expenses) daily[t.date.getDate() - 1] -= t.amountCents;
  const total = daily.reduce((a, b) => a + b, 0);
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(now);

  return (
    <div className="card">
      <p className="card-title">Dépensé en {month}</p>
      <p className="hero-value">
        <NumberFlow value={total / 100} locales="fr-FR" format={{ style: "currency", currency: "EUR" }} />
      </p>
      <div className="hero-sub">
        {incomeCents > 0 && <span className="pill tone-income">+{formatEuros(incomeCents)} reçus</span>}
        {toSortCount > 0 && (
          <span className="pill tone-social">
            {toSortCount} {toSortCount > 1 ? "dépenses" : "dépense"} à trier
          </span>
        )}
      </div>
      <SpendArea dailyCents={daily} />
    </div>
  );
}

function Split({ expenses }: { expenses: Transaction[] }) {
  const total = expenses.reduce((sum, t) => sum - t.amountCents, 0) || 1;
  const groups = [...NECESSITIES, null].map((n) => ({
    key: n ?? "untagged",
    label: n ? NECESSITY_LABEL[n] : "À trier",
    cents: expenses.filter((t) => t.necessity === n).reduce((sum, t) => sum - t.amountCents, 0),
  }));

  return (
    <section className="section">
      <div className="section-header">
        <h2>Répartition</h2>
      </div>
      <div className="card">
        <div className="stack" role="img" aria-label="Répartition des dépenses du mois" style={{ marginTop: 2 }}>
          {groups.map((g) => g.cents > 0 && <span key={g.key} className={`tone-${g.key}`} style={{ flexGrow: g.cents / total }} />)}
        </div>
        <ul className="legend">
          {groups.map((g) => (
            <li key={g.key} className={`tone-${g.key}`}>
              <span className="dot" />
              <span>{g.label}</span>
              <span className="num">{formatEuros(g.cents)}</span>
              <span className="pct num">{Math.round((g.cents / total) * 100)} %</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ToSort({ items }: { items: Transaction[] }) {
  const { tagTransaction } = useData();
  const sort = (t: Transaction, n: Necessity) => {
    tagTransaction(t.id, n);
    toast(`${t.label} classé en ${NECESSITY_LABEL[n].toLowerCase()}`);
  };

  return (
    <section className="section">
      <div className="section-header">
        <h2>À trier</h2>
        <span className="secondary">Ça comptait vraiment ?</span>
      </div>
      <ul className="list">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.li
              key={t.id}
              className="list-row sort-row"
              layout
              exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            >
              <Avatar t={t} />
              <div className="list-row-body">
                <p className="list-row-title">{t.label}</p>
                <p className="list-row-sub">{SOURCE_LABEL[t.source]}</p>
              </div>
              <Amount cents={t.amountCents} />
              <div className="sort-actions">
                {NECESSITIES.map((n) => (
                  <button key={n} className={`tone-${n}`} onClick={() => sort(t, n)}>
                    {NECESSITY_LABEL[n]}
                  </button>
                ))}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

const RECENT = 8;

export function Finance() {
  const { transactions } = useData();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? transactions : transactions.slice(0, RECENT);
  const now = new Date();
  const thisMonth = transactions.filter((t) => t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear());
  const expenses = thisMonth.filter((t) => t.amountCents < 0);
  const incomeCents = thisMonth.filter((t) => t.amountCents > 0).reduce((sum, t) => sum + t.amountCents, 0);
  const toSort = transactions.filter((t) => t.amountCents < 0 && t.necessity === null);

  return (
    <>
      <section className="section" style={{ marginTop: 12 }}>
        <Month expenses={expenses} incomeCents={incomeCents} toSortCount={toSort.length} />
      </section>

      {toSort.length > 0 && <ToSort items={toSort} />}
      {expenses.length > 0 && <Split expenses={expenses} />}

      <section className="section">
        <div className="section-header">
          <h2>Mouvements</h2>
        </div>
        {transactions.length === 0 ? (
          <div className="card">
            <p className="empty">Aucun mouvement. Ajoute une dépense avec le bouton +, l'Action Button, ou paie avec Apple Pay.</p>
          </div>
        ) : (
          groupByDay(shown, (t) => t.date).map((group) => (
            <div key={group.day}>
              <h3 className="group-day">{group.day}</h3>
              <ul className="list">
                {group.items.map((t) => (
                  <li key={t.id} className="list-row">
                    <Avatar t={t} />
                    <div className="list-row-body">
                      <p className="list-row-title">{t.label}</p>
                      <p className="list-row-sub">
                        {t.amountCents > 0 ? "Entrée" : t.necessity ? NECESSITY_LABEL[t.necessity] : "À trier"}, {formatTime(t.date)}
                      </p>
                    </div>
                    <Amount cents={t.amountCents} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {!showAll && transactions.length > RECENT && (
          <button className="show-all" onClick={() => setShowAll(true)}>
            Afficher les {transactions.length} mouvements
          </button>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Patrimoine</h2>
        </div>
        <div className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="avatar tone-income" aria-hidden>
            <Bank size={20} weight="fill" />
          </span>
          <p className="empty">Comptes, livrets, actions et bitcoin arriveront ici avec la synchronisation bancaire.</p>
        </div>
      </section>
    </>
  );
}
