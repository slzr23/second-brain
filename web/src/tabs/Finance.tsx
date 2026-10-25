import NumberFlow from "@number-flow/react";
import { ArrowDownLeft, ArrowsLeftRight, FileArrowUp } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { SpendArea } from "../charts/SpendArea";
import { ImportSheet } from "../components/ImportSheet";
import { useData } from "../data/context";
import { isIncome, isSpending, NECESSITIES, NECESSITY_LABEL, type Necessity, type Transaction } from "../data/types";
import { formatEuros, formatTime, groupByDay } from "../lib/format";
import { Wealth } from "./Wealth";

const SOURCE_LABEL: Record<Transaction["source"], string> = {
  apple_pay: "Apple Pay",
  bank: "Banque",
  manual: "Saisie",
};

const toneOf = (t: Transaction) => (t.transfer ? "neutral" : t.amountCents > 0 ? "income" : (t.necessity ?? "untagged"));
const RECENT_DAYS = 30;
const isSavingsAccount = (account: string | null) => !!account && /livret|ldds?|pel\b|épargne|epargne/i.test(account);
const isRecent = (t: Transaction) => Date.now() - t.date.getTime() < RECENT_DAYS * 86_400_000;

/** "Social, 21:00" / "Épargne, Compte courant" */
function describe(t: Transaction): string {
  const what = t.transfer
    ? t.transfer === "savings"
      ? "Épargne"
      : "Entre tes comptes"
    : t.amountCents > 0
      ? "Entrée"
      : t.necessity
        ? NECESSITY_LABEL[t.necessity]
        : isRecent(t)
          ? "À trier"
          : "Non classé";
  // Bank lines carry no time of day.
  return `${what}, ${t.source === "bank" ? (t.account ?? "Banque") : formatTime(t.date)}`;
}
const initial = (label: string) => label.trim().charAt(0).toUpperCase();

function Avatar({ t }: { t: Transaction }) {
  return (
    <span className={`avatar tone-${toneOf(t)}`} aria-hidden>
      {t.transfer ? <ArrowsLeftRight size={20} weight="bold" /> : t.amountCents > 0 ? <ArrowDownLeft size={20} weight="bold" /> : initial(t.label)}
    </span>
  );
}

function Amount({ cents, muted = false }: { cents: number; muted?: boolean }) {
  return (
    <span className={`list-row-value num${muted ? " muted" : cents > 0 ? " positive" : ""}`}>
      {cents > 0 ? "+" : ""}
      {formatEuros(cents)}
    </span>
  );
}

function Month({ expenses, incomeCents, savedCents, toSortCount }: { expenses: Transaction[]; incomeCents: number; savedCents: number; toSortCount: number }) {
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
        {savedCents > 0 && <span className="pill tone-essentiel">{formatEuros(savedCents)} mis de côté</span>}
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
  const [importing, setImporting] = useState(false);
  const shown = showAll ? transactions : transactions.slice(0, RECENT);
  const now = new Date();
  const thisMonth = transactions.filter((t) => t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear());
  const expenses = thisMonth.filter(isSpending);
  const incomeCents = thisMonth.filter(isIncome).reduce((sum, t) => sum + t.amountCents, 0);
  // Money put on savings this month (net of withdrawals), seen from the current account.
  // Lines of the savings accounts themselves are skipped: they mirror the same transfers.
  const savedCents = -thisMonth.filter((t) => t.transfer === "savings" && !isSavingsAccount(t.account)).reduce((sum, t) => sum + t.amountCents, 0);
  // Only recent lines are worth sorting by hand; older ones stay "Non classé".
  const toSort = transactions.filter((t) => isSpending(t) && t.necessity === null && isRecent(t));

  return (
    <>
      <section className="section" style={{ marginTop: 12 }}>
        <Month expenses={expenses} incomeCents={incomeCents} savedCents={savedCents} toSortCount={toSort.length} />
      </section>

      {toSort.length > 0 && <ToSort items={toSort} />}
      {expenses.length > 0 && <Split expenses={expenses} />}

      <Wealth />

      <section className="section">
        <div className="section-header">
          <h2>Mouvements</h2>
          <button className="header-action" onClick={() => setImporting(true)}>
            <FileArrowUp size={18} weight="bold" aria-hidden />
            Importer
          </button>
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
                      <p className="list-row-sub">{describe(t)}</p>
                    </div>
                    <Amount cents={t.amountCents} muted={!!t.transfer} />
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

      <ImportSheet open={importing} onOpenChange={setImporting} />
    </>
  );
}
