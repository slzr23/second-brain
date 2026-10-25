import NumberFlow from "@number-flow/react";
import { ArrowsClockwise, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { HoldingSheet } from "../components/HoldingSheet";
import { useData } from "../data/context";
import { holdingValueCents, TRACKERS, type Holding } from "../data/types";
import { formatEuros, formatShortDay } from "../lib/format";

const units = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 });
const trackerLabel = (symbol: string) => TRACKERS.find((t) => t.symbol === symbol)?.label ?? symbol;

function detail(h: Holding): string {
  const date = h.priceDate ? formatShortDay(h.priceDate) : null;
  if (h.units === 1 && !h.tracker) return date ? `Solde au ${date}` : "Solde";
  const parts = `${units.format(h.units)} ${h.units > 1 ? "parts" : "part"}`;
  if (h.tracker) return `${parts}, suit ${trackerLabel(h.tracker.symbol)}`;
  return date ? `${parts} au ${date}` : parts;
}

/** Savings and investments, grouped by account, biggest first. */
export function Wealth() {
  const { holdings } = useData();
  const [editing, setEditing] = useState<Holding | null>(null);
  const [open, setOpen] = useState(false);
  const edit = (h: Holding | null) => {
    setEditing(h);
    setOpen(true);
  };

  const visible = holdings.filter((h) => h.units > 0 || h.unitPrice > 0);
  const groups = [...new Set(visible.map((h) => h.group))]
    .map((group) => {
      const items = visible.filter((h) => h.group === group).sort((a, b) => holdingValueCents(b) - holdingValueCents(a));
      return { group, items, cents: items.reduce((sum, h) => sum + holdingValueCents(h), 0) };
    })
    .sort((a, b) => b.cents - a.cents);
  const total = groups.reduce((sum, g) => sum + g.cents, 0);

  return (
    <section className="section">
      <div className="section-header">
        <h2>Patrimoine</h2>
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <p className="empty">Ajoute ton livret, ton épargne salariale ou tes cryptos pour suivre ton patrimoine au même endroit.</p>
        </div>
      ) : (
        <>
          <div className="card">
            <p className="card-title">Valeur totale</p>
            <p className="hero-value">
              <NumberFlow value={total / 100} locales="fr-FR" format={{ style: "currency", currency: "EUR" }} />
            </p>
            <div className="stack" role="img" aria-label="Répartition du patrimoine par compte">
              {groups.map((g, i) => (
                <span key={g.group} className={`tone-g${i % 5}`} style={{ flexGrow: g.cents / (total || 1) }} />
              ))}
            </div>
            <ul className="legend">
              {groups.map((g, i) => (
                <li key={g.group} className={`tone-g${i % 5}`}>
                  <span className="dot" />
                  <span>{g.group}</span>
                  <span className="num">{formatEuros(g.cents)}</span>
                  <span className="pct num">{Math.round((g.cents / (total || 1)) * 100)} %</span>
                </li>
              ))}
            </ul>
          </div>

          {groups.map((g, i) => (
            <div key={g.group}>
              <h3 className="group-head">
                {g.group}
                <b>{formatEuros(g.cents)}</b>
              </h3>
              <ul className="list">
                {g.items.map((h) => (
                  <li key={h.id}>
                    <button className="list-row holding-row" onClick={() => edit(h)}>
                      <span className={`avatar tone-g${i % 5}`} aria-hidden>
                        {h.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="list-row-body">
                        <span className="list-row-title" style={{ display: "block" }}>
                          {h.name}
                        </span>
                        <span className="list-row-sub">
                          {h.tracker && <ArrowsClockwise size={13} weight="bold" aria-label="Mis à jour automatiquement" />}
                          {detail(h)}
                        </span>
                      </span>
                      <span className="list-row-value num">{formatEuros(holdingValueCents(h))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      <button className="add-row" onClick={() => edit(null)}>
        <Plus size={18} weight="bold" aria-hidden />
        Ajouter un placement
      </button>

      <HoldingSheet holding={editing} open={open} onOpenChange={setOpen} />
    </section>
  );
}
