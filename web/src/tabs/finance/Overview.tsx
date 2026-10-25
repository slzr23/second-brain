import NumberFlow from "@number-flow/react";
import { CaretRight, Plus, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { Donut } from "../../charts/Donut";
import { BalanceSheet } from "../../components/BalanceSheet";
import { HoldingSheet } from "../../components/HoldingSheet";
import { ValueChart } from "../../components/ValueChart";
import { useData } from "../../data/context";
import { isSpending } from "../../data/types";
import { accountGroups, netWorthSeries, paceVsAverage } from "../../lib/finance";
import { formatEuros } from "../../lib/format";
import { useRoute } from "../../lib/route";
import { Gain, groupColor, isRecent, LinkRow } from "./shared";


/** Finance home: total wealth and where it sits, then a door to each account and to spending. */
export function Overview() {
  const { holdings, transactions } = useData();
  const { navigate } = useRoute();
  // Accounts shown on the evolution chart; empty means all of them.
  const [shown, setShown] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [balanceFor, setBalanceFor] = useState<string | null>(null);

  const groups = accountGroups(holdings);
  const total = groups.reduce((sum, g) => sum + g.cents, 0);
  const series = netWorthSeries(holdings);
  const colors = Object.fromEntries(groups.map((g, i) => [g.name, groupColor(i)]));
  const open = (name: string) => navigate({ tab: "finance", path: ["compte", name] });

  const now = new Date();
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(now);
  const pace = paceVsAverage(transactions, now);
  const toSort = transactions.filter((t) => isSpending(t) && !t.necessity && isRecent(t)).length;
  // Bank accounts whose movements were imported but whose balance is still unknown.
  const withoutBalance = [...new Set(transactions.filter((t) => t.source === "bank" && t.account).map((t) => t.account!))].filter(
    (a) => !groups.some((g) => g.name === a),
  );

  return (
    <>
      <section className="section" style={{ marginTop: 12 }}>
        <div className="card">
          <p className="card-title">Patrimoine total</p>
          <p className="hero-value">
            <NumberFlow value={total / 100} locales="fr-FR" format={{ style: "currency", currency: "EUR" }} />
          </p>
          {groups.length > 0 ? (
            <div className="ring-row">
              <Donut slices={groups.map((g, i) => ({ key: g.name, label: g.name, cents: g.cents, color: groupColor(i) }))} />
              <ul className="ring-legend">
                {groups.map((g, i) => (
                  <li key={g.name}>
                    <button onClick={() => open(g.name)}>
                      <i style={{ background: groupColor(i) }} />
                      <span className="ring-name">{g.name}</span>
                      <span className="num secondary">{Math.round((g.cents / (total || 1)) * 100)} %</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="empty">Importe un relevé ou ajoute un placement avec le bouton + pour voir ton patrimoine ici.</p>
          )}
        </div>
      </section>

      {series.length > 1 && (
        <section className="section">
          <div className="section-header">
            <h2>Évolution</h2>
          </div>
          <div className="card">
            <div className="filter-chips" role="group" aria-label="Comptes affichés">
              <button className="filter-chip" aria-pressed={shown.length === 0} onClick={() => setShown([])}>
                Tout
              </button>
              {groups.map((g) => (
                <button
                  key={g.name}
                  className="filter-chip"
                  style={{ ["--tone" as string]: colors[g.name] }}
                  aria-pressed={shown.includes(g.name)}
                  onClick={() => setShown((list) => (list.includes(g.name) ? list.filter((n) => n !== g.name) : [...list, g.name]))}
                >
                  <i />
                  {g.name}
                </button>
              ))}
            </div>
            <ValueChart
              id="networth"
              holdings={holdings.filter((h) => shown.length === 0 || shown.includes(h.group))}
              series={groups.filter((g) => shown.length === 0 || shown.includes(g.name)).map((g) => ({ key: g.name, label: g.name, color: colors[g.name] }))}
            />
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2>Dépenses</h2>
        </div>
        <button className="card preview-card" onClick={() => navigate({ tab: "finance", path: ["depenses"] })}>
          <span className="preview-body">
            <span className="card-title">En {month}</span>
            <span className="preview-value num">{formatEuros(pace.spent)}</span>
            {pace.pct !== null && (
              <span className={`pace ${pace.pct > 0 ? "more" : "less"}`}>
                {pace.pct === 0
                  ? "Comme d'habitude à cette date"
                  : `${Math.abs(pace.pct)} % ${pace.pct > 0 ? "de plus" : "de moins"} que d'habitude à cette date`}
              </span>
            )}
            {toSort > 0 && <span className="pill tone-social">{toSort} à trier</span>}
          </span>
          <CaretRight size={18} weight="bold" className="chevron" aria-hidden />
        </button>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Comptes</h2>
        </div>
        {withoutBalance.length > 0 && (
          <ul className="list" style={{ marginBottom: 12 }}>
            {withoutBalance.map((a) => (
              <LinkRow key={a} onClick={() => setBalanceFor(a)}>
                <span className="avatar tone-social" aria-hidden>
                  <WarningCircle size={22} weight="fill" />
                </span>
                <span className="list-row-body">
                  <span className="list-row-title">{a}</span>
                  <span className="list-row-sub">Solde inconnu</span>
                </span>
                <span className="list-row-value" style={{ color: "var(--accent)", fontSize: 15 }}>
                  Ajouter
                </span>
              </LinkRow>
            ))}
          </ul>
        )}
        {groups.length > 0 && (
          <ul className="list">
            {groups.map((g, i) => (
              <LinkRow key={g.name} onClick={() => open(g.name)}>
                <span className="avatar" style={{ ["--tone" as string]: groupColor(i) }} aria-hidden>
                  {g.name.charAt(0).toUpperCase()}
                </span>
                <span className="list-row-body">
                  <span className="list-row-title" style={{ display: "block" }}>
                    {g.name}
                  </span>
                  <span className="list-row-sub">
                    {g.holdings.length > 1 ? `${g.holdings.length} lignes` : g.holdings[0].name === g.name ? "Compte" : g.holdings[0].name}
                  </span>
                </span>
                <span className="value-stack">
                  <span className="list-row-value num">{formatEuros(g.cents)}</span>
                  <Gain valueCents={g.cents} investedCents={g.investedCents} />
                </span>
              </LinkRow>
            ))}
          </ul>
        )}
        <button className="add-row" onClick={() => setAdding(true)}>
          <Plus size={18} weight="bold" aria-hidden />
          Ajouter un placement
        </button>
      </section>

      <HoldingSheet holding={null} open={adding} onOpenChange={setAdding} />
      <BalanceSheet account={balanceFor} open={balanceFor !== null} onOpenChange={(o) => !o && setBalanceFor(null)} />
    </>
  );
}
