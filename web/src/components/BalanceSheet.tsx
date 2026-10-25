import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { useData } from "../data/context";
import { monthlyBalances } from "../import/history";
import { formatEuros } from "../lib/format";

/**
 * Sets today's balance of an imported bank account. Its whole history is then
 * rebuilt from the movements already stored, walking back from that balance.
 */
export function BalanceSheet({ account, open, onOpenChange }: { account: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { accountMovements, saveAccountBalance } = useData();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  const cents = value.trim() ? Math.round(Number(value.replace(/[\s  ]/g, "").replace(",", ".")) * 100) : Number.NaN;
  const valid = Number.isFinite(cents);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!account || !valid || saving) return;
    setSaving(true);
    try {
      const movements = await accountMovements(account);
      await saveAccountBalance(account, cents, monthlyBalances(movements, cents));
      toast.success(`${account} : ${formatEuros(cents)}, historique reconstruit sur ${movements.length} opérations`);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(`L'enregistrement a échoué : ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet" data-section="finance">
          <div className="sheet-handle" aria-hidden />
          <form onSubmit={submit}>
            <div className="sheet-head">
              <span />
              <Drawer.Title asChild>
                <h2>{account}</h2>
              </Drawer.Title>
              <Drawer.Close type="button">Annuler</Drawer.Close>
            </div>
            <Drawer.Description className="sr-only">Solde actuel du compte.</Drawer.Description>
            <label className="field-row" style={{ borderRadius: 14 }}>
              <span>Solde aujourd'hui</span>
              <input inputMode="decimal" placeholder="0" autoFocus aria-label="Solde aujourd'hui, en euros" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,-]/g, ""))} />
              <span className="secondary">€</span>
            </label>
            <p className="hint">Celui affiché par ta banque. L'évolution mois par mois est recalculée à partir de tes opérations importées.</p>
            <button className="primary" disabled={!valid || saving}>
              {saving ? "Calcul…" : "Enregistrer le solde"}
            </button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
