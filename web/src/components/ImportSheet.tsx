import { FileArrowUp } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { useData } from "../data/context";
import { parseImportFile, summarize, type ImportedTransaction, type ImportSummary } from "../import";
import { cryptoPositions, type CryptoPosition, type CryptoTrade } from "../import/crypto";
import { monthlyBalances } from "../import/history";
import { formatEuros } from "../lib/format";

const ACCOUNTS = ["Compte courant", "Livret A", "Livret Jeune"];
const ASSET_NAMES: Record<string, string> = { BTC: "Bitcoin", ETH: "Ether", SOL: "Solana", USDT: "Tether", ENA: "Ethena" };
const count = new Intl.NumberFormat("fr-FR");
const coins = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 8 });
const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

type State =
  | { step: "pick" }
  | { step: "reading" }
  | { step: "bank"; format: string; items: ImportedTransaction[]; summary: ImportSummary }
  | { step: "crypto"; format: string; positions: CryptoPosition[] }
  | { step: "writing"; done: number; total: number }
  | { step: "error"; message: string };

/**
 * Import exports from the bank (they become movements) or from a crypto platform
 * (they become holdings). Several files can be picked at once: Bitstack gives one per year.
 */
export function ImportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { ownerName, existingTransactionIds, importTransactions, saveAccountBalance, saveComputedHolding } = useData();
  const [balance, setBalance] = useState("");
  const [account, setAccount] = useState(ACCOUNTS[0]);
  const [files, setFiles] = useState<File[]>([]);
  const [includeWallet, setIncludeWallet] = useState(true);
  const [state, setState] = useState<State>({ step: "pick" });
  // Read through a ref: the data source changes on every snapshot (including the
  // ones caused by the import itself), which must not restart the preview.
  const data = useRef({ ownerName, existingTransactionIds });
  const guessed = useRef(false);
  data.current = { ownerName, existingTransactionIds };

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setBalance("");
      setAccount(ACCOUNTS[0]);
      guessed.current = false;
      setState({ step: "pick" });
    }
  }, [open]);

  // Bank line ids depend on the account, so the preview is rebuilt when either changes.
  useEffect(() => {
    if (files.length === 0 || !account.trim()) return;
    let cancelled = false;
    setState({ step: "reading" });
    (async () => {
      try {
        const ctx = { account: account.trim(), ownerName: data.current.ownerName };
        const parsed = await Promise.all(files.map(async (f) => parseImportFile(await f.arrayBuffer(), ctx)));
        const kinds = new Set(parsed.map((p) => p.kind));
        if (kinds.size > 1) throw new Error("Importe les relevés bancaires et les exports crypto séparément.");
        const format = parsed[0].format;

        if (parsed[0].kind === "bank") {
          // First file of this account: guess it from the content (a savings account only
          // moves money to and from your own accounts, plus yearly interest).
          const first = parsed[0].items;
          const savingsLike = first.length > 0 && first.filter((t) => t.transfer || /int[eé]r[eê]ts/i.test(t.label)).length / first.length > 0.9;
          if (savingsLike && account === ACCOUNTS[0] && !guessed.current) {
            guessed.current = true;
            setAccount("Livret A");
            return;
          }
          const items = parsed.flatMap((p) => (p.kind === "bank" ? p.items : []));
          const existing = await data.current.existingTransactionIds(ctx.account);
          if (!cancelled) setState({ step: "bank", format, items, summary: summarize(items, existing) });
        } else {
          const trades: CryptoTrade[] = parsed.flatMap((p) => (p.kind === "crypto" ? p.trades : []));
          const positions = cryptoPositions(trades).filter((p) => p.walletUnits > 0 || p.platforms.some((pl) => pl.units > 0));
          const formats = [...new Set(parsed.map((p) => p.format))].join(" et ");
          if (!cancelled) setState({ step: "crypto", format: formats, positions });
        }
      } catch (error) {
        if (!cancelled) setState({ step: "error", message: (error as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, account]);

  const balanceCents = balance.trim() ? Math.round(Number(balance.replace(/[\s  ]/g, "").replace(",", ".")) * 100) : null;
  const balanceValid = balanceCents === null || Number.isFinite(balanceCents);

  async function runBank() {
    if (state.step !== "bank" || !balanceValid) return;
    const name = account.trim();
    const items = state.summary.fresh;
    const all = state.items;
    setState({ step: "writing", done: 0, total: items.length });
    try {
      if (items.length) await importTransactions(items, (done) => setState({ step: "writing", done, total: items.length }));
      // The whole file (not only the new lines) rebuilds the balance history.
      if (balanceCents !== null) await saveAccountBalance(name, balanceCents, monthlyBalances(all, balanceCents));
      toast.success(items.length ? `${count.format(items.length)} opérations importées dans ${name}` : `Solde de ${name} mis à jour`);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      setState({
        step: "error",
        message: `L'import s'est interrompu (${(error as Error).message}). Relance-le : les opérations déjà écrites ne seront pas dupliquées.`,
      });
    }
  }

  async function runCrypto() {
    if (state.step !== "crypto") return;
    const { positions } = state;
    setState({ step: "writing", done: 0, total: positions.length });
    try {
      for (const p of positions) {
        const name = ASSET_NAMES[p.asset] ?? p.asset;
        const price = p.lastPrice ?? 0;
        for (const platform of p.platforms) {
          if (platform.units <= 0) continue;
          await saveComputedHolding(`crypto_${slug(platform.platform)}_${slug(p.asset)}`, {
            group: "Crypto",
            name: `${name} (${platform.platform})`,
            units: platform.units,
            unitPrice: price,
            trackerSymbol: `${p.asset}-EUR`,
            investedCents: platform.investedCents,
            history: platform.history,
          });
        }
        if (includeWallet && p.walletUnits > 0) {
          await saveComputedHolding(`crypto_wallet_${slug(p.asset)}`, {
            group: "Crypto",
            name: `${name} (wallet)`,
            units: p.walletUnits,
            unitPrice: price,
            trackerSymbol: `${p.asset}-EUR`,
            investedCents: null,
            history: p.walletHistory,
          });
        }
      }
      toast.success(`Crypto ${state.format} ajoutée au patrimoine`);
      onOpenChange(false);
    } catch {
      setState({ step: "error", message: "L'enregistrement a échoué. Vérifie ta connexion et réessaie." });
    }
  }

  const s = state.step === "bank" ? state.summary : null;
  const fileLabel = files.length === 0 ? "Choisir un ou plusieurs CSV" : files.length === 1 ? files[0].name : `${files.length} fichiers`;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet sheet-scroll" data-section="finance">
          <div className="sheet-handle" aria-hidden />
          <div className="sheet-head">
            <Drawer.Title asChild>
              <h2>Importer</h2>
            </Drawer.Title>
            <Drawer.Close type="button">Annuler</Drawer.Close>
          </div>
          <Drawer.Description className="sr-only">Importe un relevé bancaire ou un export crypto au format CSV.</Drawer.Description>

          <label className="file-pick" style={{ marginTop: 0 }}>
            <FileArrowUp size={24} weight="duotone" aria-hidden />
            <span>{fileLabel}</span>
            <input type="file" multiple accept=".csv,text/csv" className="sr-only" onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          </label>
          {state.step === "pick" && <p className="hint">Relevé Caisse d'Épargne, historique Bitstack ou relevé crypto Revolut.</p>}
          {state.step === "reading" && <p className="hint">Lecture…</p>}
          {state.step === "error" && (
            <p className="error" style={{ marginTop: 12 }}>
              {state.message}
            </p>
          )}

          {state.step === "bank" && (
            <>
              <p className="field-label">Compte</p>
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
              <label className="field-row" style={{ marginTop: 12, borderRadius: 14 }}>
                <span>Solde actuel</span>
                <input
                  inputMode="decimal"
                  placeholder="facultatif"
                  aria-label="Solde actuel du compte, en euros"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value.replace(/[^\d.,-]/g, ""))}
                />
                <span className="secondary">€</span>
              </label>
              <p className={balanceCents === null ? "hint warn" : "hint"}>
                {balanceCents === null
                  ? "Sans le solde actuel, ce compte n'apparaîtra pas dans Patrimoine (tu pourras l'ajouter plus tard)."
                  : "Le compte apparaîtra dans Patrimoine avec son évolution mois par mois."}
              </p>
            </>
          )}

          {s && (
            <div className="form-group">
              <div className="field-row">
                <span>Période</span>
                <span className="value">{s.from && s.to ? `${day.format(s.from)} au ${day.format(s.to)}` : "–"}</span>
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

          {state.step === "crypto" && (
            <div className="form-group">
              <div className="field-row">
                <span>Période</span>
                <span className="value">
                  {day.format(new Date(Math.min(...state.positions.map((p) => p.from.getTime()))))} au{" "}
                  {day.format(new Date(Math.max(...state.positions.map((p) => p.to.getTime()))))}
                </span>
              </div>
              {state.positions.flatMap((p) => [
                ...p.platforms
                  .filter((pl) => pl.units > 0)
                  .map((pl) => (
                    <div className="field-row" key={`${p.asset}-${pl.platform}`}>
                      <span>
                        {ASSET_NAMES[p.asset] ?? p.asset} <span className="secondary">{pl.platform}</span>
                      </span>
                      <span className="value num">
                        {coins.format(pl.units)} {p.asset}
                      </span>
                    </div>
                  )),
                p.walletUnits > 0 ? (
                  <div className="field-row" key={`${p.asset}-wallet`}>
                    <span>
                      {ASSET_NAMES[p.asset] ?? p.asset} <span className="secondary">wallet</span>
                    </span>
                    <span className="value num">
                      {coins.format(p.walletUnits)} {p.asset}
                    </span>
                  </div>
                ) : null,
              ])}
              <div className="field-row">
                <span>Investi net</span>
                <span className="value num">
                  {formatEuros(state.positions.reduce((sum, p) => sum + p.platforms.reduce((s2, pl) => s2 + pl.investedCents, 0), 0))}
                </span>
              </div>
            </div>
          )}
          {state.step === "crypto" && state.positions.some((p) => p.walletUnits > 0) && (
            <>
              <div className="chips wrap" role="radiogroup" aria-label="Wallet" style={{ marginTop: 12 }}>
                <button type="button" role="radio" className="chip tone-income" aria-checked={includeWallet} onClick={() => setIncludeWallet(true)}>
                  Compter le wallet
                </button>
                <button type="button" role="radio" className="chip tone-neutral" aria-checked={!includeWallet} onClick={() => setIncludeWallet(false)}>
                  Plateformes seulement
                </button>
              </div>
              <p className="hint">
                Les cryptos retirées vers ton wallet sont toujours à toi, sauf si tu les as dépensées depuis. Importe toutes tes plateformes ensemble :
                ce qui passe par ton wallet d'une plateforme à l'autre n'est alors compté qu'une fois.
              </p>
            </>
          )}

          {state.step === "writing" ? (
            <button className="primary" disabled>
              Import… {count.format(state.done)} / {count.format(state.total)}
            </button>
          ) : state.step === "crypto" ? (
            <button className="primary" onClick={runCrypto}>
              Ajouter au patrimoine
            </button>
          ) : (
            <button className="primary" disabled={!s || !balanceValid || (s.fresh.length === 0 && balanceCents === null)} onClick={runBank}>
              {!s
                ? "Importer"
                : s.fresh.length > 0
                  ? `Importer ${count.format(s.fresh.length)} opérations`
                  : balanceCents !== null
                    ? "Mettre à jour le solde"
                    : "Tout est déjà importé"}
            </button>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
