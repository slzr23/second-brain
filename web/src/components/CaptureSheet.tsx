import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { useData } from "../data/context";
import { NECESSITIES, NECESSITY_LABEL, type Necessity } from "../data/types";
import { formatEuros } from "../lib/format";
import { Segmented } from "./Segmented";

type Kind = "dream" | "note" | "expense";
const KINDS = [
  { id: "dream", label: "Rêve" },
  { id: "note", label: "Note" },
  { id: "expense", label: "Dépense" },
] as const;

/** "12,50" / "12.5" → 1250 ; anything unparsable → 0 */
const toCents = (value: string) => {
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(Math.abs(n) * 100) : 0;
};

/**
 * The same three captures as the iPhone Action Button, from inside the app.
 * Opens as an iOS-style bottom sheet.
 */
export function CaptureSheet({ open, onOpenChange, initialKind }: { open: boolean; onOpenChange: (open: boolean) => void; initialKind: Kind }) {
  const { addEntry, addTransaction } = useData();
  const [kind, setKind] = useState<Kind>(initialKind);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [necessity, setNecessity] = useState<Necessity | null>(null);
  const [saving, setSaving] = useState(false);

  // Open on the type that fits the current tab (Finance → expense).
  useEffect(() => {
    if (open) setKind(initialKind);
  }, [open, initialKind]);

  const cents = toCents(amount);
  const ready = kind === "expense" ? cents > 0 && label.trim().length > 0 : text.trim().length > 0;

  function reset() {
    setText("");
    setAmount("");
    setLabel("");
    setNecessity(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    try {
      if (kind === "expense") {
        await addTransaction({ amountCents: -cents, label: label.trim(), necessity });
        toast.success(`Dépense de ${formatEuros(cents)} enregistrée`);
      } else {
        await addEntry(kind, text.trim());
        toast.success(kind === "dream" ? "Rêve enregistré" : "Note enregistrée");
      }
      reset();
      onOpenChange(false);
    } catch {
      toast.error("L'enregistrement a échoué. Vérifie ta connexion et réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet" data-section={kind === "expense" ? "finance" : "pensees"}>
          <div className="sheet-handle" aria-hidden />
          <form onSubmit={submit}>
            <div className="sheet-head">
              <Drawer.Title asChild>
                <h2>Ajouter</h2>
              </Drawer.Title>
              <Drawer.Close type="button">Annuler</Drawer.Close>
            </div>
            <Drawer.Description className="sr-only">Note un rêve, une idée ou une dépense.</Drawer.Description>

            <Segmented id="capture" label="Type" options={KINDS} value={kind} onChange={setKind} />

            {kind === "expense" ? (
              <>
                <label className="amount-field">
                  <span className="sr-only">Montant en euros</span>
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
                  placeholder="Pour quoi ?"
                  aria-label="Libellé"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <div className="chips" role="group" aria-label="Catégorie">
                  {NECESSITIES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`chip tone-${n}`}
                      aria-pressed={necessity === n}
                      onClick={() => setNecessity(necessity === n ? null : n)}
                    >
                      {NECESSITY_LABEL[n]}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <textarea
                className="field"
                rows={6}
                autoFocus
                aria-label={kind === "dream" ? "Ton rêve" : "Ta note"}
                placeholder={kind === "dream" ? "De quoi as-tu rêvé ?" : "Qu'as-tu en tête ?"}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            )}

            <button className="primary" disabled={!ready || saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
