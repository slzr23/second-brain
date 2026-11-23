import { useState } from "react";
import { MonthBars } from "../../charts/MonthBars";
import { Segmented } from "../../components/Segmented";
import { useData } from "../../data/context";
import { isSpending } from "../../data/types";
import { payPeriods } from "../../lib/budget";
import { spendingBuckets, type SpendUnit } from "../../lib/finance";
import { Movements, Split } from "./shared";

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

/** Spending over time (weeks, months, years), how essential it was since payday, and every movement. */
export function Spending() {
  const { transactions } = useData();
  const period = payPeriods(transactions, 1)[0];
  const expenses = transactions.filter((t) => isSpending(t) && t.date >= period.start);
  const [unit, setUnit] = useState<SpendUnit>("month");
  const buckets = spendingBuckets(transactions, unit, new Date());

  return (
    <>
      <section className="section" style={{ marginTop: 12 }}>
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

      {expenses.length > 0 && <Split expenses={expenses} title={`Essentiel ou pas, depuis la paie`} />}

      <section className="section">
        <div className="section-header">
          <h2>Tous les mouvements</h2>
        </div>
        <Movements items={transactions} empty={<p className="empty">Aucun mouvement. Ajoute une dépense avec le bouton +, ou importe un relevé.</p>} />
      </section>
    </>
  );
}
