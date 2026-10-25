import NumberFlow from "@number-flow/react";
import { ArrowsClockwise, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { NetWorthChart } from "../../charts/NetWorthChart";
import { HoldingSheet } from "../../components/HoldingSheet";
import { Segmented } from "../../components/Segmented";
import { useData } from "../../data/context";
import { holdingValueCents, type Holding } from "../../data/types";
import { accountGroups, netWorthSeries } from "../../lib/finance";
import { formatEuros } from "../../lib/format";
import { cut, RANGES, type Range } from "./Overview";
import { Gain, groupColor, holdingDetail, holdingGain, Movements } from "./shared";

/** One account (Livret A, PEE, Crypto…): its value over time, its lines, its movements. */
export function Account({ name }: { name: string }) {
  const { holdings, transactions } = useData();
  const [range, setRange] = useState<Range>("12");
  const [editing, setEditing] = useState<Holding | null>(null);
  const [open, setOpen] = useState(false);

  const groups = accountGroups(holdings);
  const index = groups.findIndex((g) => g.name === name);
  const group = groups[index];
  if (!group) return <p className="empty">Ce compte n'existe plus.</p>;

  const color = groupColor(index);
  const series = netWorthSeries(group.holdings);
  const movements = transactions.filter((t) => t.account === name);
  const edit = (h: Holding | null) => {
    setEditing(h);
    setOpen(true);
  };

  return (
    <>
      <section className="section" style={{ marginTop: 12 }}>
        <div className="card" style={{ ["--accent" as string]: color }}>
          <p className="card-title">Valeur</p>
          <p className="hero-value">
            <NumberFlow value={group.cents / 100} locales="fr-FR" format={{ style: "currency", currency: "EUR" }} />
          </p>
          <Gain valueCents={group.cents} investedCents={group.investedCents} />
          {series.length > 1 ? (
            <>
              <div style={{ marginTop: 14 }}>
                <Segmented id="account-range" label="Période" options={RANGES} value={range} onChange={setRange} />
              </div>
              <NetWorthChart points={cut(series, range)} series={[{ key: name, label: name, color }]} />
            </>
          ) : (
            <p className="empty" style={{ marginTop: 8 }}>
              L'historique se construira jour après jour à partir d'aujourd'hui.
            </p>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>{group.holdings.length > 1 ? "Lignes" : "Détail"}</h2>
        </div>
        <ul className="list">
          {group.holdings.map((h) => (
            <li key={h.id}>
              <button className="list-row holding-row" onClick={() => edit(h)}>
                <span className="avatar" style={{ ["--tone" as string]: color }} aria-hidden>
                  {h.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="list-row-body">
                  <span className="list-row-title" style={{ display: "block" }}>
                    {h.name}
                  </span>
                  <span className="list-row-sub">
                    {h.tracker && <ArrowsClockwise size={13} weight="bold" aria-label="Mis à jour automatiquement" />}
                    {holdingDetail(h)}
                  </span>
                </span>
                <span className="value-stack">
                  <span className="list-row-value num">{formatEuros(holdingValueCents(h))}</span>
                  {holdingGain(h)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {group.holdings.some((h) => h.units !== 1 || h.tracker) && (
          <button className="add-row" onClick={() => edit(null)}>
            <Plus size={18} weight="bold" aria-hidden />
            Ajouter une ligne
          </button>
        )}
      </section>

      {movements.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>Opérations</h2>
          </div>
          <Movements items={movements} empty={null} />
        </section>
      )}

      <HoldingSheet holding={editing} defaultGroup={name} open={open} onOpenChange={setOpen} />
    </>
  );
}
