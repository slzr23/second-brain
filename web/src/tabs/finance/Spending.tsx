import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { MonthBars } from "../../charts/MonthBars";
import { SpendCompare } from "../../charts/SpendCompare";
import { Segmented } from "../../components/Segmented";
import { useData } from "../../data/context";
import { isIncome, isSpending } from "../../data/types";
import { averageCumulative, cumulative, dailySpending, paceVsAverage, spendingBuckets, type SpendUnit } from "../../lib/finance";
import { formatEuros } from "../../lib/format";
import { isRecent, Movements, Split, ToSort } from "./shared";

const UNITS = [
  { id: "week", label: "Semaines" },
  { id: "month", label: "Mois" },
  { id: "year", label: "Années" },
] as const;
const AVERAGE_LABEL: Record<SpendUnit, string> = {
  week: "des semaines précédentes",
  month: "des mois précédents",
  year: "des années précédentes",
};

/** Where the money goes: this month against the usual, the last months, what to sort. */
export function Spending() {
  const { transactions } = useData();
  const now = new Date();
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(now);
  const thisMonth = transactions.filter((t) => t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear());
  const expenses = thisMonth.filter(isSpending);
  const incomeCents = thisMonth.filter(isIncome).reduce((sum, t) => sum + t.amountCents, 0);
  const pace = paceVsAverage(transactions, now);
  const spentByDay = cumulative(dailySpending(transactions, now.getFullYear(), now.getMonth()));
  const toSort = transactions.filter((t) => isSpending(t) && t.necessity === null && isRecent(t));
  const [unit, setUnit] = useState<SpendUnit>("month");
  const buckets = spendingBuckets(transactions, unit, now);

  return (
    <>
      <section className="section" style={{ marginTop: 12 }}>
        <div className="card">
          <p className="card-title">Dépensé en {month}</p>
          <p className="hero-value">
            <NumberFlow value={pace.spent / 100} locales="fr-FR" format={{ style: "currency", currency: "EUR" }} />
          </p>
          {pace.pct !== null && (
            <p className={`pace ${pace.pct > 0 ? "more" : "less"}`}>
              {pace.pct === 0
                ? "Comme d'habitude à cette date"
                : `${Math.abs(pace.pct)} % ${pace.pct > 0 ? "de plus" : "de moins"} que d'habitude à cette date (${formatEuros(pace.usual)})`}
            </p>
          )}
          <SpendCompare spent={spentByDay} usual={averageCumulative(transactions, 3, now)} today={now.getDate()} />
          <p className="chart-legend">
            <span>
              <i className="swatch red" /> {month.charAt(0).toUpperCase() + month.slice(1)}
            </span>
            <span>
              <i className="swatch dash" /> Moyenne des 3 mois précédents
            </span>
          </p>
        </div>

        <div className="card income-row">
          <span>
            <span className="card-title" style={{ display: "block", marginBottom: 0 }}>
              Entrées d'argent en {month}
            </span>
            <span className="secondary" style={{ fontSize: 13 }}>
              Salaire, aides, remboursements. Hors virements entre tes comptes.
            </span>
          </span>
          <b className="num positive">+{formatEuros(incomeCents)}</b>
        </div>
      </section>

      {toSort.length > 0 && <ToSort items={toSort} />}

      <section className="section">
        <div className="section-header">
          <h2>Dans le temps</h2>
        </div>
        <div className="card">
          <Segmented id="spend-unit" label="Regrouper par" options={UNITS} value={unit} onChange={setUnit} />
          <MonthBars buckets={buckets} unit={unit} />
          {buckets.length > 1 && (
            <p className="chart-legend">
              <span>
                <i className="swatch dash" /> Moyenne {AVERAGE_LABEL[unit]}
              </span>
            </p>
          )}
        </div>
      </section>

      {expenses.length > 0 && <Split expenses={expenses} title={`Répartition en ${month}`} />}

      <section className="section">
        <div className="section-header">
          <h2>Mouvements</h2>
        </div>
        <Movements items={transactions} empty={<p className="empty">Aucun mouvement. Ajoute une dépense avec le bouton +, ou importe un relevé.</p>} />
      </section>
    </>
  );
}
