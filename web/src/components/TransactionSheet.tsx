import { toast } from "sonner";
import { Drawer } from "vaul";
import { useData } from "../data/context";
import { CATEGORIES, CATEGORY_LABEL, NECESSITIES, NECESSITY_LABEL, type Category, type Necessity, type Transaction } from "../data/types";
import { formatEuros, formatShortDay } from "../lib/format";

/**
 * One expense: its category and how much it mattered, each one tap. A category
 * you choose here is remembered for that merchant from then on.
 */
export function TransactionSheet({ transaction: t, onOpenChange }: { transaction: Transaction | null; onOpenChange: (open: boolean) => void }) {
  const { setCategory, tagTransaction, transactions } = useData();
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
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
