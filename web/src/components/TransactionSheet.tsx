import { toast } from "sonner";
import { Drawer } from "vaul";
import { useData } from "../data/context";
import { CATEGORIES, CATEGORY_LABEL, NECESSITIES, NECESSITY_LABEL, type Category, type Necessity, type Transaction } from "../data/types";
import { oneOffTest } from "../lib/budget";
import { formatEuros, formatShortDay } from "../lib/format";

/**
 * One movement. An expense: its category and how much it mattered, each one tap
 * (a category chosen here is remembered for that merchant from then on). Any
 * movement can also be taken out of the monthly budget: a loan, a gift, a
 * one-off purchase.
 */
export function TransactionSheet({ transaction: t, onOpenChange }: { transaction: Transaction | null; onOpenChange: (open: boolean) => void }) {
  const { setCategory, tagTransaction, setOneOff, transactions } = useData();
  // Follow the live line, so a change shows at once.
  const live = t ? (transactions.find((x) => x.id === t.id) ?? t) : null;

  const pickCategory = async (category: Category) => {
    if (!live || live.category === category) return;
    try {
      await setCategory(live.id, category);
    } catch (error) {
      toast.error(`Non enregistré : ${(error as Error).message}`);
    }
  };
  const guessed = live ? oneOffTest(transactions.map((x) => (x.id === live.id ? { ...x, oneOff: null } : x)))({ ...live, oneOff: null }) : false;
  const outside = live ? (live.oneOff ?? guessed) : false;
  const pickBudget = async (out: boolean) => {
    if (!live || out === outside) return;
    try {
      // Back to what the app would guess: no need to remember a choice.
      await setOneOff(live.id, out === guessed ? null : out);
    } catch (error) {
      toast.error(`Non enregistré : ${(error as Error).message}`);
    }
  };
  const spending = live ? live.amountCents < 0 && !live.transfer && !outside : false;
  const pickNecessity = async (necessity: Necessity) => {
    if (!live) return;
    try {
      await tagTransaction(live.id, necessity);
      onOpenChange(false);
    } catch (error) {
      toast.error(`Non enregistré : ${(error as Error).message}`);
    }
  };

  return (
    <Drawer.Root open={!!t} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet" data-section="finance">
          <div className="sheet-handle" aria-hidden />
          {live && (
            <>
              <div className="sheet-head">
                <span />
                <Drawer.Title asChild>
                  <h2>{live.label}</h2>
                </Drawer.Title>
                <Drawer.Close type="button">OK</Drawer.Close>
              </div>
              <Drawer.Description className="secondary tx-sheet-sub">
                <span className="num">{formatEuros(live.amountCents)}</span> · {formatShortDay(live.date)}
                {live.account ? ` · ${live.account}` : ""}
              </Drawer.Description>

              {live.transfer !== "savings" && (
                <>
                  <h3 className="tx-sheet-title">Budget du mois</h3>
                  <div className="chips" role="radiogroup" aria-label="Budget du mois">
                    <button className="chip" style={{ ["--tone" as string]: "var(--blue)" }} role="radio" aria-checked={!outside} onClick={() => pickBudget(false)}>
                      Dans le budget
                    </button>
                    <button className="chip" style={{ ["--tone" as string]: "var(--orange)" }} role="radio" aria-checked={outside} onClick={() => pickBudget(true)}>
                      Hors budget
                    </button>
                  </div>
                  <p className="hint">
                    {outside
                      ? `Compté à part : ni revenu, ni dépense, ni dans les moyennes${live.oneOff == null ? " (repéré tout seul : prêt ou grosse rentrée ponctuelle)" : ""}.`
                      : "Hors budget, pour un prêt, un don ou un achat ponctuel qui fausserait le mois."}
                  </p>
                </>
              )}

              {spending && (
                <>
                  <h3 className="tx-sheet-title">Catégorie</h3>
                  <div className="category-grid" role="group" aria-label="Catégorie">
                    {CATEGORIES.map((c) => (
                      <button key={c} className="category-chip" aria-pressed={live.category === c} onClick={() => pickCategory(c)}>
                        {CATEGORY_LABEL[c]}
                      </button>
                    ))}
                  </div>

                  <h3 className="tx-sheet-title">Ça comptait vraiment ?</h3>
                  <div className="sort-actions" role="group" aria-label="Nécessité">
                    {NECESSITIES.map((n) => (
                      <button
                        key={n}
                        className={`tone-${n}${live.necessity === n ? " chosen" : !live.necessity && live.suggestedNecessity === n ? " suggested" : ""}`}
                        aria-pressed={live.necessity === n}
                        onClick={() => pickNecessity(n)}
                      >
                        {NECESSITY_LABEL[n]}
                      </button>
                    ))}
                  </div>
                  {!live.necessity && live.suggestedNecessity && <p className="hint">Proposé : {NECESSITY_LABEL[live.suggestedNecessity].toLowerCase()}.</p>}
                </>
              )}
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
