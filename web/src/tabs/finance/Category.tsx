import { useData } from "../../data/context";
import { CATEGORIES, CATEGORY_LABEL, isSpending, type Category as CategoryId } from "../../data/types";
import { averages, inCurrentAccount, payPeriods, periodLabel, summarize, type CategoryKey } from "../../lib/budget";
import { formatEuros } from "../../lib/format";
import { Movements } from "./shared";

export const isCategoryKey = (k: string): k is CategoryKey => k === "none" || (CATEGORIES as readonly string[]).includes(k);
export const categoryTitle = (k: string) => (k === "none" ? "À classer" : isCategoryKey(k) ? CATEGORY_LABEL[k as CategoryId] : k);

/** One category this month: total, against the usual and last month, and the lines. */
export function Category({ id }: { id: string }) {
  const { transactions } = useData();
  const key = id as CategoryKey;
  const periods = payPeriods(transactions, 7);
  const summaries = periods.map((p) => summarize(transactions, p));
  const current = summaries[summaries.length - 1];
  const previous = summaries[summaries.length - 2];
  const usual = averages(summaries, transactions).byCategory[key];
  const lines = current.transactions.filter((t) => isSpending(t) && inCurrentAccount(t) && (t.category ?? "none") === key);

  return (
    <>
      <section className="section" style={{ marginTop: 12 }}>
        <div className="card">
          <p className="card-title">{periodLabel(current.period)}</p>
          <p className="hero-value num">{formatEuros(current.byCategory[key] ?? 0)}</p>
          <p className="secondary" style={{ fontSize: 15 }}>
            Le mois dernier : {formatEuros(previous.byCategory[key] ?? 0)}
            {usual ? ` · en moyenne : ${formatEuros(Math.round(usual))}` : ""}
          </p>
        </div>
      </section>
      <section className="section">
        <div className="section-header">
          <h2>Dépenses</h2>
        </div>
        <Movements items={lines} empty={<p className="empty">Rien ce mois-ci.</p>} initialCount={50} />
      </section>
    </>
  );
}
