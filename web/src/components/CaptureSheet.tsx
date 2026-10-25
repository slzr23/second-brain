import { ArrowDownLeft, ArrowUpRight, CaretLeft, CaretRight, FileArrowUp, MoonStars, NotePencil, type Icon } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { useData } from "../data/context";
import { NECESSITIES, NECESSITY_LABEL, type Necessity } from "../data/types";
import { formatEuros } from "../lib/format";

type Step = "menu" | "dream" | "note" | "expense" | "income";

const ACTIONS: { step: Exclude<Step, "menu"> | "import"; label: string; hint: string; icon: Icon; tone: string }[] = [
  { step: "expense", label: "Dépense", hint: "Argent qui sort", icon: ArrowUpRight, tone: "out" },
  { step: "income", label: "Entrée d'argent", hint: "Salaire, remboursement, aide…", icon: ArrowDownLeft, tone: "income" },
  { step: "import", label: "Importer un fichier", hint: "Relevé bancaire, Bitstack, Revolut", icon: FileArrowUp, tone: "essentiel" },
  { step: "dream", label: "Rêve", hint: "Au réveil, avant qu'il s'efface", icon: MoonStars, tone: "dream" },
  { step: "note", label: "Note", hint: "Une idée, une pensée", icon: NotePencil, tone: "note" },
];

const TITLES: Record<Step, string> = {
  menu: "Ajouter",
  dream: "Rêve",
  note: "Note",
  expense: "Dépense",
  income: "Entrée d'argent",
};

/** "12,50" / "12.5" → 1250 ; anything unparsable → 0 */
const toCents = (value: string) => {
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(Math.abs(n) * 100) : 0;
};

/**
 * Everything the + button can add: money in or out, a bank or crypto file, a dream,
 * a note. Opens on a short menu, then the matching form, in the same iOS-style sheet.
 */
export function CaptureSheet({ open, onOpenChange, onImport }: { open: boolean; onOpenChange: (open: boolean) => void; onImport: () => void }) {
  const { addEntry, addTransaction } = useData();
  const [step, setStep] = useState<Step>("menu");
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [necessity, setNecessity] = useState<Necessity | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("menu");
    setText("");
    setAmount("");
    setLabel("");
    setNecessity(null);
  }, [open]);

  const money = step === "expense" || step === "income";
  const cents = toCents(amount);
  const ready = money ? cents > 0 && label.trim().length > 0 : text.trim().length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || saving || step === "menu") return;
    setSaving(true);
    try {
      if (step === "expense") {
        await addTransaction({ amountCents: -cents, label: label.trim(), necessity });
        toast.success(`Dépense de ${formatEuros(cents)} enregistrée`);
      } else if (step === "income") {
        await addTransaction({ amountCents: cents, label: label.trim(), necessity: null });
        toast.success(`Entrée de ${formatEuros(cents)} enregistrée`);
      } else {
        await addEntry(step, text.trim());
        toast.success(step === "dream" ? "Rêve enregistré" : "Note enregistrée");
      }
      onOpenChange(false);
    } catch {
      toast.error("L'enregistrement a échoué. Vérifie ta connexion et réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet" data-section={money ? "finance" : step === "menu" ? undefined : "pensees"}>
          <div className="sheet-handle" aria-hidden />
          <div className="sheet-head">
            {step === "menu" ? (
              <span />
            ) : (
              <button type="button" className="sheet-back" onClick={() => setStep("menu")}>
                <CaretLeft size={18} weight="bold" aria-hidden />
                Retour
              </button>
            )}
            <Drawer.Title asChild>
              <h2>{TITLES[step]}</h2>
            </Drawer.Title>
            <Drawer.Close type="button">Annuler</Drawer.Close>
          </div>
          <Drawer.Description className="sr-only">Ajoute une dépense, une entrée d'argent, un fichier à importer, un rêve ou une note.</Drawer.Description>

          {step === "menu" ? (
            <ul className="list action-list">
              {ACTIONS.map((a) => (
                <li key={a.step}>
                  <button className="list-row action-row" onClick={() => (a.step === "import" ? onImport() : setStep(a.step))}>
                    <span className={`avatar tone-${a.tone}`} aria-hidden>
                      <a.icon size={20} weight="bold" />
                    </span>
                    <span className="list-row-body">
                      <span className="list-row-title">{a.label}</span>
                      <span className="list-row-sub">{a.hint}</span>
                    </span>
                    <CaretRight size={16} weight="bold" className="chevron" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <form onSubmit={submit}>
              {money ? (
                <>
                  <label className={`amount-field ${step === "income" ? "in" : "out"}`}>
                    <span className="sr-only">Montant en euros</span>
                    <span className="sign" aria-hidden>
                      {step === "income" ? "+" : "−"}
                    </span>
                    <input
                      inputMode="decimal"
                      placeholder="0"
                      value={amount}
                      style={{ width: `${Math.max(amount.length, 1) * 0.62 + 0.15}em` }}
                      onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, "").slice(0, 9))}
                      autoFocus
                    />
                    <span className="secondary" style={{ fontSize: 32, fontWeight: 600 }}>
                      €
                    </span>
                  </label>
                  <input
                    className="field"
                    placeholder={step === "income" ? "D'où vient cet argent ?" : "Pour quoi ?"}
                    aria-label="Libellé"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                  {step === "expense" && (
                    <div className="chips" role="group" aria-label="Catégorie">
                      {NECESSITIES.map((n) => (
                        <button key={n} type="button" className={`chip tone-${n}`} aria-pressed={necessity === n} onClick={() => setNecessity(necessity === n ? null : n)}>
                          {NECESSITY_LABEL[n]}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <textarea
                  className="field"
                  rows={6}
                  autoFocus
                  aria-label={step === "dream" ? "Ton rêve" : "Ta note"}
                  placeholder={step === "dream" ? "De quoi as-tu rêvé ?" : "Qu'as-tu en tête ?"}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              )}
              <button className="primary" disabled={!ready || saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </form>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
