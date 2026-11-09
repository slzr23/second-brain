import { ArrowsClockwise, Bank, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { useData } from "../data/context";
import { formatWhen } from "../lib/format";

const DAY = 86_400_000;
/** Below this, the consent is about to end: time to reconnect. */
const RENEW_DAYS = 14;

/**
 * The bank sync in one row: connect it, see when it last ran and when the consent
 * ends, sync now. Every tap reaches the bank, which allows only a few reads a day.
 */
export function BankLink() {
  const { bank, connectBank, syncBank } = useData();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const daysLeft = bank ? Math.floor((bank.validUntil.getTime() - Date.now()) / DAY) : 0;
  const mustReconnect = !bank || bank.status === "expired" || daysLeft < 0;
  const warn = mustReconnect || bank?.status === "error" || daysLeft < RENEW_DAYS;

  async function run() {
    setBusy(true);
    setNote(null);
    try {
      if (mustReconnect || daysLeft < RENEW_DAYS) {
        await connectBank(); // leaves the app for the bank's page
        return;
      }
      const added = await syncBank();
      setNote(added === 0 ? "Rien de nouveau" : `${added} opération${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""}`);
    } catch (error) {
      setNote((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  let sub: string;
  if (!bank) sub = "Opérations et soldes chaque matin, sans relevé à importer";
  else if (mustReconnect) sub = bank.lastError ?? "Le consentement a expiré";
  else {
    const last = bank.lastSyncedAt ? `À jour : ${formatWhen(bank.lastSyncedAt).toLowerCase()}` : "Première synchro en attente";
    const ends = daysLeft < RENEW_DAYS ? `reconnecter d'ici ${daysLeft} j` : `encore ${daysLeft} j`;
    sub = bank.status === "error" && bank.lastError ? bank.lastError : `${last} · ${ends}`;
  }

  const action = !bank ? "Connecter" : mustReconnect || daysLeft < RENEW_DAYS ? "Reconnecter" : null;

  return (
    <ul className="list" style={{ marginBottom: 12 }}>
      <li>
        <button className="list-row link-row" onClick={run} disabled={busy} aria-busy={busy}>
          <span className={`avatar ${warn ? "tone-social" : "tone-income"}`} aria-hidden>
            {warn ? <WarningCircle size={22} weight="fill" /> : <Bank size={22} weight="fill" />}
          </span>
          <span className="list-row-body">
            <span className="list-row-title" style={{ display: "block" }}>
              Synchro bancaire
            </span>
            <span className="list-row-sub">{note ?? sub}</span>
          </span>
          {action ? (
            <span className="list-row-value" style={{ color: "var(--accent)", fontSize: 15 }}>
              {busy ? "…" : action}
            </span>
          ) : (
            <ArrowsClockwise size={20} weight="bold" className={busy ? "chevron spin" : "chevron"} aria-label="Synchroniser" />
          )}
        </button>
      </li>
    </ul>
  );
}
