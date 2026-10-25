import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { useData } from "../data/context";
import { holdingValueCents, isDirectTracker, TRACKERS, type Holding } from "../data/types";
import { formatEuros } from "../lib/format";
import { Segmented } from "./Segmented";

type Mode = "amount" | "units";
const MODES = [
  { id: "amount", label: "Montant" },
  { id: "units", label: "Parts" },
] as const;

/** "10,2027" / "1 234.5" → number ; empty or invalid → NaN */
const toNumber = (value: string) => (value.trim() ? Number(value.replace(/[\s  ]/g, "").replace(",", ".")) : Number.NaN);
const fromNumber = (n: number) => String(n).replace(".", ",");
const decimal = (value: string) => value.replace(/[^\d.,]/g, "");

/** Add or edit a savings account or an investment line. `holding` null means a new one. */
export function HoldingSheet({ holding, open, onOpenChange }: { holding: Holding | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { holdings, saveHolding, deleteHolding } = useData();
  const [mode, setMode] = useState<Mode>("amount");
  const [group, setGroup] = useState("");
  const [name, setName] = useState("");
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState("");
  const [tracker, setTracker] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fill the form each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    const asAmount = !holding || (holding.units === 1 && !holding.tracker);
    setMode(asAmount ? "amount" : "units");
    setGroup(holding?.group ?? "");
    setName(holding?.name ?? "");
    setUnits(holding && !asAmount ? fromNumber(holding.units) : "");
    setPrice(holding ? fromNumber(holding.unitPrice) : "");
    setTracker(holding?.tracker?.symbol ?? null);
  }, [open, holding]);

  const u = mode === "amount" ? 1 : toNumber(units);
  const p = toNumber(price);
  const valid = Boolean(group.trim() && name.trim()) && u >= 0 && p >= 0;
  const groups = [...new Set(holdings.map((h) => h.group))];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await saveHolding(holding?.id ?? null, {
        group: group.trim(),
        name: name.trim(),
        units: u,
        unitPrice: p,
        trackerSymbol: mode === "units" ? tracker : null,
      });
      toast.success(holding ? `${name.trim()} mis à jour` : `${name.trim()} ajouté`);
      onOpenChange(false);
    } catch {
      toast.error("L'enregistrement a échoué. Vérifie ta connexion et réessaie.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!holding) return;
    await deleteHolding(holding.id);
    toast(`${holding.name} supprimé`);
    onOpenChange(false);
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet" data-section="finance">
          <div className="sheet-handle" aria-hidden />
          <form onSubmit={submit}>
            <div className="sheet-head">
              <Drawer.Title asChild>
                <h2>{holding ? "Modifier" : "Ajouter un placement"}</h2>
              </Drawer.Title>
              <Drawer.Close type="button">Annuler</Drawer.Close>
            </div>
            <Drawer.Description className="sr-only">Un compte d'épargne ou une ligne d'investissement.</Drawer.Description>

            <Segmented id="holding-mode" label="Type de valeur" options={MODES} value={mode} onChange={setMode} />

            <div className="form-group">
              <input className="field" list="holding-groups" placeholder="Compte (ex. PEE Amundi)" aria-label="Compte" value={group} onChange={(e) => setGroup(e.target.value)} />
              <datalist id="holding-groups">
                {groups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              <input className="field" placeholder="Nom (ex. ESOP Souscriptions)" aria-label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {mode === "amount" ? (
              <label className="field-row">
                <span>Solde</span>
                <input inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(decimal(e.target.value))} />
                <span className="secondary">€</span>
              </label>
            ) : (
              <>
                <div className="form-group">
                  <label className="field-row">
                    <span>Nombre de parts</span>
                    <input inputMode="decimal" placeholder="0" value={units} onChange={(e) => setUnits(decimal(e.target.value))} />
                  </label>
                  <label className="field-row">
                    <span>Valeur d'une part</span>
                    <input inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(decimal(e.target.value))} />
                    <span className="secondary">€</span>
                  </label>
                </div>
                <p className="field-label">Mise à jour de la valeur</p>
                <div className="chips wrap" role="radiogroup" aria-label="Mise à jour de la valeur">
                  <button type="button" role="radio" className="chip tone-neutral" aria-checked={tracker === null} onClick={() => setTracker(null)}>
                    À la main
                  </button>
                  {TRACKERS.map((t) => (
                    <button
                      key={t.symbol}
                      type="button"
                      role="radio"
                      className="chip tone-income"
                      aria-checked={tracker === t.symbol}
                      onClick={() => setTracker(t.symbol)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {tracker && (
                  <p className="hint">
                    {isDirectTracker(tracker)
                      ? "La valeur d'une part sera chaque soir le cours du jour."
                      : "La valeur suivra chaque soir l'évolution du cours, à partir de celle que tu saisis."}
                  </p>
                )}
              </>
            )}

            {valid && <p className="total-preview">Valeur : <b className="num">{formatEuros(holdingValueCents({ units: u, unitPrice: p }))}</b></p>}

            <button className="primary" disabled={!valid || saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {holding && (
              <button type="button" className="danger" onClick={remove}>
                Supprimer
              </button>
            )}
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
