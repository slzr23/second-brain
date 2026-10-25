import { FileArrowUp } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { useData } from "../data/context";
import { parseBankFile, summarize, type ImportSummary } from "../import";
import { formatEuros } from "../lib/format";

const ACCOUNTS = ["Compte courant", "Livret A", "Livret Jeune"];
const count = new Intl.NumberFormat("fr-FR");
const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

type State =
  | { step: "pick" }
  | { step: "reading" }
  | { step: "ready"; format: string; summary: ImportSummary }
  | { step: "writing"; done: number; total: number }
  | { step: "error"; message: string };

/** Import a bank export: pick the file, check what is new, then write it. */
export function ImportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { ownerName, existingTransactionIds, importTransactions } = useData();
  const [account, setAccount] = useState(ACCOUNTS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>({ step: "pick" });
  // Read through a ref: the data source changes on every snapshot (including the
  // ones caused by the import itself), which must not restart the preview.
  const data = useRef({ ownerName, existingTransactionIds });
  data.current = { ownerName, existingTransactionIds };

  useEffect(() => {
    if (!open) {
      setFile(null);
      setState({ step: "pick" });
    }
  }, [open]);

  // Line ids depend on the account, so the preview is rebuilt when either changes.
  useEffect(() => {
    if (!file || !account.trim()) return;
    let cancelled = false;
    setState({ step: "reading" });
    (async () => {
      try {
        const { format, items } = await parseBankFile(await file.arrayBuffer(), { account: account.trim(), ownerName: data.current.ownerName });
        const existing = await data.current.existingTransactionIds(account.trim());
        if (!cancelled) setState({ step: "ready", format, summary: summarize(items, existing) });
      } catch (error) {
        if (!cancelled) setState({ step: "error", message: (error as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, account]);

  async function run() {
    if (state.step !== "ready") return;
    const items = state.summary.fresh;
    setState({ step: "writing", done: 0, total: items.length });
    try {
      await importTransactions(items, (done) => setState({ step: "writing", done, total: items.length }));
      toast.success(`${count.format(items.length)} opérations importées dans ${account.trim()}`);
      onOpenChange(false);
    } catch {
      setState({ step: "error", message: "L'import s'est interrompu. Relance-le : les opérations déjà écrites ne seront pas dupliquées." });
    }
  }

  const s = state.step === "ready" ? state.summary : null;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet" data-section="finance">
          <div className="sheet-handle" aria-hidden />
          <div className="sheet-head">
            <Drawer.Title asChild>
              <h2>Importer un relevé</h2>
            </Drawer.Title>
            <Drawer.Close type="button">Annuler</Drawer.Close>
          </div>
          <Drawer.Description className="sr-only">Importe l'historique d'un compte depuis un export CSV de ta banque.</Drawer.Description>

          <p className="field-label" style={{ marginTop: 0 }}>
            Compte
          </p>
          <div className="chips wrap" role="radiogroup" aria-label="Compte">
            {ACCOUNTS.map((a) => (
              <button key={a} type="button" role="radio" className="chip tone-income" aria-checked={account === a} onClick={() => setAccount(a)}>
                {a}
              </button>
            ))}
          </div>
          <input
            className="field"
            style={{ marginTop: 10 }}
            aria-label="Nom du compte"
            placeholder="Autre compte"
            value={ACCOUNTS.includes(account) ? "" : account}
            onChange={(e) => setAccount(e.target.value || ACCOUNTS[0])}
          />

          <label className="file-pick">
            <FileArrowUp size={24} weight="duotone" aria-hidden />
            <span>{file ? file.name : "Choisir le fichier CSV"}</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>

          {state.step === "reading" && <p className="hint">Lecture du fichier…</p>}
          {state.step === "error" && <p className="error" style={{ marginTop: 12 }}>{state.message}</p>}

          {s && (
            <div className="form-group">
              <div className="field-row">
                <span>Période</span>
                <span className="value">
                  {s.from && s.to ? `${day.format(s.from)} au ${day.format(s.to)}` : "–"}
                </span>
              </div>
              <div className="field-row">
                <span>Opérations</span>
                <span className="value num">{count.format(s.total)}</span>
              </div>
              {s.alreadyThere > 0 && (
                <div className="field-row">
                  <span>Déjà importées</span>
                  <span className="value num">{count.format(s.alreadyThere)}</span>
                </div>
              )}
              <div className="field-row">
                <span>Virements entre tes comptes</span>
                <span className="value num">{count.format(s.transfers)}</span>
              </div>
              <div className="field-row">
                <span>Dépenses déjà classées</span>
                <span className="value num">{count.format(s.sorted)}</span>
              </div>
              <div className="field-row">
                <span>Dépenses à classer</span>
                <span className="value num">{count.format(s.unsorted)}</span>
              </div>
            </div>
          )}
          {s && s.transfers > 0 && <p className="hint">Les virements entre tes comptes et vers ton épargne ne comptent ni comme dépenses ni comme revenus.</p>}

          {state.step === "writing" ? (
            <button className="primary" disabled>
              Import… {count.format(state.done)} / {count.format(state.total)}
            </button>
          ) : (
            <button className="primary" disabled={!s || s.fresh.length === 0} onClick={run}>
              {!s ? "Importer" : s.fresh.length === 0 ? "Tout est déjà importé" : `Importer ${count.format(s.fresh.length)} opérations`}
            </button>
          )}
          {s && s.fresh.length > 0 && (
            <p className="hint" style={{ textAlign: "center" }}>
              Solde net du fichier : {formatEuros(s.fresh.reduce((sum, t) => sum + t.amountCents, 0))}
            </p>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
