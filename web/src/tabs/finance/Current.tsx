import NumberFlow from "@number-flow/react";
import { ArrowsClockwise, CaretRight, Copy, Receipt, TrendUp, Warning } from "@phosphor-icons/react";
import { BankLink } from "../../components/BankLink";
import { SortDeck } from "../../components/SortDeck";
import { ValueChart } from "../../components/ValueChart";
import { useData } from "../../data/context";
import { CATEGORY_LABEL, isSpending } from "../../data/types";
import {
  alerts,
  averages,
  changePct,
  CURRENT_ACCOUNT,
  INCOME_KINDS,
  INCOME_LABEL,
  inCurrentAccount,
  payPeriods,
  periodLabel,
  recurringSpending,
  runway,
  summarize,
  type Alert,
  type CategoryKey,
} from "../../lib/budget";
import { formatEuros } from "../../lib/format";
import { useRoute } from "../../lib/route";
import { FinanceSwitch, Movements } from "./shared";

const categoryName = (k: CategoryKey) => (k === "none" ? "À classer" : CATEGORY_LABEL[k]);
const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
});

/** "+12 % vs le mois dernier", coloured by whether that is good news. */
function Change({ pct, goodWhenUp }: { pct: number | null; goodWhenUp: boolean }) {
  if (pct === null) return null;
  if (pct === 0) return <span className="change">comme le mois dernier</span>;
  const good = pct > 0 === goodWhenUp;
  return (
    <span className={`change ${good ? "good" : "bad"}`}>
      {pct > 0 ? "+" : "−"}
      {Math.abs(pct)} % vs le mois dernier
    </span>
  );
}

const ALERT_ICON: Record<Alert["kind"], typeof Warning> = {
  overdraft: Warning,
  fees: Receipt,
  duplicate: Copy,
  rising: TrendUp,
};

/**
 * The current account, one question per block: how much is left until payday,
 * what came in and went out this month, where the salary went, what to look at,
 * what comes back every month. A month runs from one salary to the next.
 */
export function Current() {
  const { transactions, holdings } = useData();
  const { navigate } = useRoute();
  const now = new Date();

  const periods = payPeriods(transactions, 7, now);
  const summaries = periods.map((p) => summarize(transactions, p));
  const current = summaries[summaries.length - 1];
  const previous = summaries[summaries.length - 2];
  const usual = averages(summaries, transactions);
  const recurring = recurringSpending(transactions, now);
  const run = runway(holdings, transactions, recurring, current.period, now);
  const watch = alerts(transactions, recurring, run, now);
  const toSort = transactions.filter((t) => inCurrentAccount(t) && isSpending(t) && t.necessity === null);
  const monthlyRecurring = recurring.reduce((s, r) => s + r.amountCents, 0);
  const categories = (Object.entries(current.byCategory) as [CategoryKey, number][]).sort((a, b) => b[1] - a[1]);
  const biggest = categories[0]?.[1] ?? 1;
  const account = holdings.filter((h) => h.group === CURRENT_ACCOUNT);
  const capacity = usual.earnedCents - usual.spentCents;
  const oneOffLines = summaries.flatMap((s) => s.oneOff).sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <>
      <FinanceSwitch value="courant" />
      <section className="section">
        <div className="card">
          <p className="card-title">{run.leftCents !== null ? "Il te reste avant la paie" : `Dépensé depuis le ${dayFmt.format(current.period.start)}`}</p>
          <p className={`hero-value${run.leftCents !== null && run.leftCents < 0 ? " negative" : ""}`}>
            <NumberFlow value={(run.leftCents ?? current.spentCents) / 100} locales="fr-FR" format={{ style: "currency", currency: "EUR" }} />
          </p>
          <p className="secondary" style={{ fontSize: 15 }}>
            {run.leftCents === null
              ? "Relie ta banque plus bas pour voir ce qu'il te reste."
              : run.upcomingCents > 0 || run.oneOffCents > 0
                ? `Solde ${formatEuros(run.balanceCents!)}${run.upcomingCents > 0 ? `, moins ${formatEuros(run.upcomingCents)} de prélèvements prévus` : ""}${run.oneOffCents > 0 ? `, sans les ${formatEuros(run.oneOffCents)} hors budget (prêt, don…) encore sur le compte` : ""}. Paie dans ${run.daysToPayday} jour${run.daysToPayday > 1 ? "s" : ""}.`
                : `Solde du compte, aucun prélèvement prévu d'ici là. Paie dans ${run.daysToPayday} jour${run.daysToPayday > 1 ? "s" : ""}.`}
          </p>
        </div>

        <div className="card">
          <p className="card-title">Ce mois-ci · {periodLabel(current.period)}</p>
          <ul className="flow">
            <li>
              <span>Gagné</span>
              <span className="flow-value">
                <b className="num positive">+{formatEuros(current.earnedCents)}</b>
                <Change pct={changePct(current.earnedCents, previous.earnedCents)} goodWhenUp />
              </span>
            </li>
            <li>
              <span>Dépensé</span>
              <span className="flow-value">
                <b className="num">−{formatEuros(current.spentCents)}</b>
                <Change pct={changePct(current.spentCents, previous.spentCents)} goodWhenUp={false} />
              </span>
            </li>
            {(current.savedCents !== 0 || current.savedOneOffCents > 0) && (
              <li>
                <span>Mis de côté</span>
                <span className="flow-value">
                  <b className="num">{formatEuros(current.savedCents)}</b>
                  {current.savedOneOffCents > 0 && <span className="change">sur ta paie, sans les {formatEuros(current.savedOneOffCents)} hors budget placés</span>}
                </span>
              </li>
            )}
            {(current.oneOffInCents > 0 || current.oneOffOutCents > 0) && (
              <li>
                <span>Hors budget</span>
                <span className="flow-value">
                  <b className="num secondary">
                    {current.oneOffInCents > 0 ? `+${formatEuros(current.oneOffInCents)}` : ""}
                    {current.oneOffInCents > 0 && current.oneOffOutCents > 0 ? " · " : ""}
                    {current.oneOffOutCents > 0 ? `−${formatEuros(current.oneOffOutCents)}` : ""}
                  </b>
                  <span className="change">prêt, don… compté à part</span>
                </span>
              </li>
            )}
          </ul>
          {usual.periods >= 2 && (
            <p className="hint" style={{ margin: "10px 0 0" }}>
              Sur tes {usual.periods} derniers mois, tu gagnes {formatEuros(usual.earnedCents)} et tu dépenses {formatEuros(usual.spentCents)} en moyenne :{" "}
              {capacity >= 0 ? `tu peux mettre environ ${formatEuros(capacity)} de côté par mois.` : `tu dépenses ${formatEuros(-capacity)} de plus que tu ne gagnes.`}
            </p>
          )}
        </div>
      </section>

      {categories.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>Où est passé ton salaire</h2>
          </div>
          <ul className="list">
            {categories.map(([key, cents]) => {
              const avg = usual.byCategory[key];
              const pct = changePct(cents, previous.byCategory[key] ?? 0);
              return (
                <li key={key}>
                  <button className="list-row link-row cat-row" onClick={() => navigate({ tab: "finance", path: ["categorie", key] })}>
                    <span className="list-row-body">
                      <span className="cat-head">
                        <span className="list-row-title">{categoryName(key)}</span>
                        <span className="num">{formatEuros(cents)}</span>
                      </span>
                      <span className="cat-bar" aria-hidden>
                        <span
                          className={key === "none" ? "untagged" : undefined}
                          style={{
                            width: `${Math.max(2, (cents / biggest) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="list-row-sub">
                        {avg ? `${formatEuros(Math.round(avg))} en moyenne` : "Nouveau ce mois-ci"}
                        {pct !== null && pct !== 0 && (
                          <span className={pct > 0 ? "bad" : "good"}>
                            {" · "}
                            {pct > 0 ? "+" : "−"}
                            {Math.abs(pct)} %
                          </span>
                        )}
                      </span>
                    </span>
                    <CaretRight size={16} weight="bold" className="chevron" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="hint">Moyenne de tes derniers mois complets ; le pourcentage compare au mois dernier.</p>
        </section>
      )}

      {watch.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>À surveiller</h2>
          </div>
          <ul className="list">
            {watch.map((a, i) => {
              const Icon = ALERT_ICON[a.kind];
              return (
                <li key={i} className="list-row alert-row">
                  <span className={`avatar ${a.kind === "overdraft" ? "tone-superflu" : "tone-social"}`} aria-hidden>
                    <Icon size={20} weight="fill" />
                  </span>
                  <span className="list-row-body">
                    <span className="list-row-title" style={{ display: "block" }}>
                      {a.title}
                    </span>
                    <span className="list-row-sub">{a.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {toSort.length > 0 && <SortDeck items={toSort} />}

      {recurring.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>Chaque mois</h2>
            <span className="secondary">{formatEuros(monthlyRecurring)} / mois</span>
          </div>
          <ul className="list">
            {recurring.map((r) => (
              <li key={r.key} className="list-row">
                <span className="avatar tone-neutral" aria-hidden>
                  <ArrowsClockwise size={18} weight="bold" />
                </span>
                <span className="list-row-body">
                  <span className="list-row-title" style={{ display: "block" }}>
                    {r.label}
                  </span>
                  <span className="list-row-sub">
                    Le {r.day} · {formatEuros(r.yearlyCents)} par an
                    {r.necessity === "superflu" ? " · superflu" : ""}
                  </span>
                </span>
                <span className="value-stack">
                  <span className="list-row-value num">{formatEuros(r.amountCents)}</span>
                  {r.next < current.period.end && <span className="change">avant la paie</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">Repérés sur tes 4 derniers mois : même commerçant, même montant, une fois par mois.</p>
        </section>
      )}

      {current.earnedCents > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>Argent gagné</h2>
          </div>
          <ul className="list">
            {INCOME_KINDS.filter((k) => current.earnedByKind[k] > 0 || previous.earnedByKind[k] > 0).map((k) => (
              <li key={k} className="list-row">
                <span className="list-row-body">
                  <span className="list-row-title" style={{ display: "block" }}>
                    {INCOME_LABEL[k]}
                  </span>
                  <span className="list-row-sub">Le mois dernier : {formatEuros(previous.earnedByKind[k])}</span>
                </span>
                <span className="list-row-value num positive">+{formatEuros(current.earnedByKind[k])}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {oneOffLines.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>Hors budget</h2>
          </div>
          <Movements items={oneOffLines} empty={null} initialCount={5} />
          <p className="hint">
            Un prêt, un don, une grosse rentrée ou un achat ponctuel : ni dans tes revenus, ni dans tes dépenses, ni dans tes moyennes. Appuie sur une ligne pour la remettre dans
            le budget, ou sur n'importe quel mouvement pour l'en sortir.
          </p>
        </section>
      )}

      {account.some((h) => h.history.length > 1) && (
        <section className="section">
          <div className="section-header">
            <h2>Solde du compte</h2>
          </div>
          <div className="card">
            <ValueChart
              id="current"
              holdings={account}
              series={[
                {
                  key: CURRENT_ACCOUNT,
                  label: CURRENT_ACCOUNT,
                  color: "var(--blue)",
                },
              ]}
            />
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2>Mouvements du mois</h2>
          <button className="link" onClick={() => navigate({ tab: "finance", path: ["depenses"] })}>
            Dans le temps
          </button>
        </div>
        <Movements items={current.transactions} empty={<p className="empty">Rien depuis la paie.</p>} />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Banque</h2>
        </div>
        <BankLink />
      </section>
    </>
  );
}
