import { ArrowDownLeft, ArrowsLeftRight, CaretRight } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { TransactionSheet } from "../../components/TransactionSheet";
import { CATEGORY_LABEL, holdingValueCents, isDirectTracker, isSpending, NECESSITIES, NECESSITY_LABEL, TRACKERS, type Holding, type Transaction } from "../../data/types";
import { Segmented } from "../../components/Segmented";
import { formatEuros, formatShortDay, formatTime, groupByDay } from "../../lib/format";
import { useRoute } from "../../lib/route";
import { useData } from "../../data/context";
import { oneOffTest } from "../../lib/budget";

/* ------------------------------- The two parts ------------------------------- */

const PARTS = [
  { id: "courant", label: "Compte courant" },
  { id: "patrimoine", label: "Patrimoine" },
] as const;

/** Day-to-day money and savings are two different stories: one switch between them. */
export function FinanceSwitch({ value }: { value: (typeof PARTS)[number]["id"] }) {
  const { navigate } = useRoute();
  return (
    <div className="finance-switch">
      <Segmented
        id="finance-part"
        label="Partie"
        options={PARTS}
        value={value}
        onChange={(v) =>
          navigate({
            tab: "finance",
            path: v === "courant" ? [] : ["patrimoine"],
          })
        }
      />
    </div>
  );
}

/* ------------------------------ Account colours ------------------------------ */

const PALETTE = ["var(--blue)", "var(--purple)", "var(--orange)", "var(--green)", "var(--teal)", "var(--red)", "var(--indigo)"];
/** Same colour for an account everywhere (ring, chart, list), from its rank by value. */
export const groupColor = (index: number) => PALETTE[index % PALETTE.length];

/* -------------------------------- Movements ---------------------------------- */

export const RECENT_DAYS = 30;
export const isRecent = (t: Transaction) => Date.now() - t.date.getTime() < RECENT_DAYS * 86_400_000;

const toneOf = (t: Transaction) => (t.transfer ? "neutral" : t.amountCents > 0 ? "income" : (t.necessity ?? "untagged"));
const initial = (label: string) => label.trim().charAt(0).toUpperCase();

export function TxAvatar({ t }: { t: Transaction }) {
  return (
    <span className={`avatar tone-${toneOf(t)}`} aria-hidden>
      {t.transfer ? <ArrowsLeftRight size={20} weight="bold" /> : t.amountCents > 0 ? <ArrowDownLeft size={20} weight="bold" /> : initial(t.label)}
    </span>
  );
}

export function Amount({ cents, muted = false }: { cents: number; muted?: boolean }) {
  return (
    <span className={`list-row-value num${muted ? " muted" : cents > 0 ? " positive" : ""}`}>
      {cents > 0 ? "+" : ""}
      {formatEuros(cents)}
    </span>
  );
}

/** "Social · Sorties" / "À trier · Courses" / "Épargne, Compte courant" */
export function describe(t: Transaction, oneOff = false): string {
  const what = oneOff
    ? "Hors budget"
    : t.transfer
      ? t.transfer === "savings"
        ? "Épargne"
        : "Entre tes comptes"
      : t.amountCents > 0
        ? "Entrée d'argent"
        : t.necessity
          ? NECESSITY_LABEL[t.necessity]
          : isRecent(t)
            ? "À trier"
            : "Non classé";
  if (t.category && isSpending(t)) return `${what} · ${CATEGORY_LABEL[t.category]}`;
  // Bank lines carry no time of day.
  return `${what}, ${t.source === "bank" ? (t.account ?? "Banque") : formatTime(t.date)}`;
}

/** Movements grouped by day, with "show more". */
export function Movements({ items, empty, initialCount = 10 }: { items: Transaction[]; empty: ReactNode; initialCount?: number }) {
  const [count, setCount] = useState(initialCount);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const isOneOff = oneOffTest(useData().transactions);
  if (items.length === 0) return <div className="card">{empty}</div>;
  const shown = items.slice(0, count);
  return (
    <>
      {groupByDay(shown, (t) => t.date).map((group) => (
        <div key={group.day}>
          <h3 className="group-day">{group.day}</h3>
          <ul className="list">
            {group.items.map((t) => (
              <li key={t.id}>
                <button className="list-row link-row" onClick={() => setEditing(t)}>
                  <TxAvatar t={t} />
                  <span className="list-row-body">
                    <span className="list-row-title" style={{ display: "block" }}>
                      {t.label}
                    </span>
                    <span className="list-row-sub">{describe(t, isOneOff(t))}</span>
                  </span>
                  <Amount cents={t.amountCents} muted={!!t.transfer || isOneOff(t)} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {items.length > count && (
        <button className="show-all" onClick={() => setCount((c) => c + 30)}>
          Voir plus
        </button>
      )}
      <TransactionSheet transaction={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </>
  );
}

/** Spending split between essential, social and superfluous. */
export function Split({ expenses, title }: { expenses: Transaction[]; title: string }) {
  const total = expenses.reduce((sum, t) => sum - t.amountCents, 0) || 1;
  const groups = [...NECESSITIES, null].map((n) => ({
    key: n ?? "untagged",
    label: n ? NECESSITY_LABEL[n] : "Non classé",
    cents: expenses.filter((t) => t.necessity === n).reduce((sum, t) => sum - t.amountCents, 0),
  }));

  return (
    <section className="section">
      <div className="section-header">
        <h2>{title}</h2>
      </div>
      <div className="card">
        <div className="stack" role="img" aria-label="Répartition des dépenses" style={{ marginTop: 2 }}>
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

/* -------------------------------- Holdings ----------------------------------- */

const units = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 });
const coins = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 8 });
const trackerLabel = (symbol: string) => TRACKERS.find((t) => t.symbol === symbol)?.label ?? symbol;

export function holdingDetail(h: Holding): string {
  const date = h.priceDate ? formatShortDay(h.priceDate) : null;
  if (h.units === 1 && !h.tracker) return date ? `Solde au ${date}` : "Solde";
  // Crypto: the amount of coins says it all ("0,00714903 BTC").
  if (h.tracker && isDirectTracker(h.tracker.symbol)) return `${coins.format(h.units)} ${h.tracker.symbol.replace(/-EUR$/, "")}`;
  const parts = `${units.format(h.units)} ${h.units > 1 ? "parts" : "part"}`;
  if (h.tracker) return `${parts}, suit ${trackerLabel(h.tracker.symbol)}`;
  return date ? `${parts} au ${date}` : parts;
}

/** Gain since the money was put in: "+232,09 € (+77 %)". */
export function Gain({ valueCents, investedCents }: { valueCents: number; investedCents: number | null }) {
  if (!investedCents || investedCents <= 0) return null;
  const gain = valueCents - investedCents;
  const pct = Math.round((gain / investedCents) * 100);
  return (
    <span className={`gain ${gain >= 0 ? "up" : "down"}`}>
      {gain >= 0 ? "+" : ""}
      {formatEuros(gain)} ({gain >= 0 ? "+" : ""}
      {pct} %)
    </span>
  );
}

export const holdingGain = (h: Holding) => <Gain valueCents={holdingValueCents(h)} investedCents={h.investedCents} />;

/** A tappable row that leads to a sub-page. */
export function LinkRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button className="list-row link-row" onClick={onClick}>
        {children}
        <CaretRight size={16} weight="bold" className="chevron" aria-hidden />
      </button>
    </li>
  );
}
