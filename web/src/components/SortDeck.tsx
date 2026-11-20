import { Sparkle } from "@phosphor-icons/react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useData } from "../data/context";
import { CATEGORY_LABEL, NECESSITIES, NECESSITY_LABEL, type Necessity, type Transaction } from "../data/types";
import { formatEuros, formatShortDay } from "../lib/format";
import { TransactionSheet } from "./TransactionSheet";

/** How far a card must travel before a swipe counts. */
const SWIPE_PX = 110;

/**
 * Expenses to sort, one card at a time: swipe right to accept the proposal,
 * left to keep it for later, or tap the right answer. Newest first.
 */
export function SortDeck({ items }: { items: Transaction[] }) {
  const { tagTransaction, classifyNow } = useData();
  const [later, setLater] = useState<string[]>([]);
  const [exit, setExit] = useState(0);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [asking, setAsking] = useState(false);

  // Cards kept for later go to the back, in the order they were pushed there.
  const queue = useMemo(() => {
    const back = new Set(later);
    return [...items.filter((t) => !back.has(t.id)), ...later.map((id) => items.find((t) => t.id === id)).filter((t): t is Transaction => !!t)];
  }, [items, later]);
  const current = queue[0];
  const withoutProposal = items.filter((t) => !t.suggestedNecessity).length;

  const sort = async (t: Transaction, n: Necessity) => {
    setExit(1);
    try {
      await tagTransaction(t.id, n);
    } catch (error) {
      toast.error(`Non enregistré : ${(error as Error).message}`);
    }
  };
  const keepForLater = (t: Transaction) => {
    setExit(-1);
    setLater((list) => [...list.filter((id) => id !== t.id), t.id]);
  };
  const askClaude = async () => {
    setAsking(true);
    try {
      const n = await classifyNow();
      toast.success(n ? `${n} dépenses ont une proposition` : "Rien de nouveau à proposer");
    } catch (error) {
      toast.error(`Le tri a échoué : ${(error as Error).message}`);
    } finally {
      setAsking(false);
    }
  };

  if (!current) return null;

  return (
    <section className="section">
      <div className="section-header">
        <h2>À trier</h2>
        <span className="secondary num">{items.length}</span>
      </div>

      <div className="deck">
        <AnimatePresence initial={false} custom={exit} mode="popLayout">
          <Card key={current.id} t={current} onSort={sort} onLater={keepForLater} onEdit={setEditing} />
        </AnimatePresence>
        {queue.length > 1 && <div className="deck-under" aria-hidden />}
      </div>

      <p className="hint deck-hint">Glisse à droite pour accepter la proposition, à gauche pour plus tard.</p>

      {withoutProposal > 0 && (
        <button className="add-row" onClick={askClaude} disabled={asking}>
          <Sparkle size={18} weight="fill" aria-hidden />
          {asking ? "Claude trie… (jusqu'à quelques minutes)" : `Proposer un tri pour ${withoutProposal} dépense${withoutProposal > 1 ? "s" : ""}`}
        </button>
      )}

      <TransactionSheet transaction={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </section>
  );
}

function Card({
  t,
  onSort,
  onLater,
  onEdit,
}: {
  t: Transaction;
  onSort: (t: Transaction, n: Necessity) => void;
  onLater: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-7, 7]);
  const accept = useTransform(x, [0, SWIPE_PX], [0, 1]);
  const skip = useTransform(x, [-SWIPE_PX, 0], [1, 0]);

  return (
    <motion.article
      className="deck-card"
      style={reduce ? undefined : { x, rotate }}
      drag={reduce ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE_PX && t.suggestedNecessity) onSort(t, t.suggestedNecessity);
        else if (info.offset.x < -SWIPE_PX) onLater(t);
      }}
      variants={{
        enter: { scale: 0.96, opacity: 0 },
        shown: { scale: 1, opacity: 1 },
        // Leaves the way it was sent: right when sorted, left when kept for later.
        gone: (dir: number) => (reduce ? { opacity: 0 } : { x: dir * 420, opacity: 0, transition: { duration: 0.25 } }),
      }}
      initial={reduce ? false : "enter"}
      animate="shown"
      exit="gone"
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    >
      {!reduce && (
        <>
          <motion.span className="deck-stamp accept" style={{ opacity: accept }} aria-hidden>
            {t.suggestedNecessity ? NECESSITY_LABEL[t.suggestedNecessity] : ""}
          </motion.span>
          <motion.span className="deck-stamp later" style={{ opacity: skip }} aria-hidden>
            Plus tard
          </motion.span>
        </>
      )}

      <p className="deck-amount num">{formatEuros(t.amountCents)}</p>
      <h3 className="deck-label">{t.label}</h3>
      <p className="secondary deck-meta">
        {formatShortDay(t.date)}
        {t.account ? ` · ${t.account}` : ""}
      </p>
      <button className="category-chip" aria-pressed onClick={() => onEdit(t)}>
        {t.category ? CATEGORY_LABEL[t.category] : "Choisir une catégorie"}
      </button>
      {t.suggestedNecessity && (
        <p className="deck-proposal">
          <Sparkle size={14} weight="fill" aria-hidden /> Proposé : <b>{NECESSITY_LABEL[t.suggestedNecessity].toLowerCase()}</b>
        </p>
      )}

      <div className="sort-actions">
        {NECESSITIES.map((n) => (
          <button key={n} className={`tone-${n}${t.suggestedNecessity === n ? " suggested" : ""}`} onClick={() => onSort(t, n)}>
            {NECESSITY_LABEL[n]}
          </button>
        ))}
      </div>
      <button className="deck-later" onClick={() => onLater(t)}>
        Plus tard
      </button>
    </motion.article>
  );
}
