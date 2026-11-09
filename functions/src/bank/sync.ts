import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp, type DocumentReference, type WriteBatch } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { localDateKey } from "../lib/week";
import { BankApiError, type EnableBanking } from "./client";
import { pickBalanceCents, toBankLines, type LinkedAccount } from "./map";
import { accountHoldingId, alreadyImported, matchAppEntries, mergeAppEntry, mergeHistory, monthlyBalances, sortLikeBefore, type BalancePoint, type StoredLine } from "./reconcile";

const DAY = 86_400_000;
/** Lines can be booked a few days late: each sync looks back this far. */
const OVERLAP_DAYS = 10;
/** First sync of an account with nothing imported yet. */
const FIRST_SYNC_DAYS = 90;

/** users/{uid}/bank/connection: written by the functions only, read by the app. */
export interface Connection {
  sessionId: string;
  aspsp: string;
  validUntil: Timestamp;
  accounts: LinkedAccount[];
  lastSyncedAt?: Timestamp | null;
  lastResult?: SyncResult | null;
  lastError?: string | null;
  status: "active" | "expired" | "error";
}

export interface SyncResult {
  added: number;
  merged: number;
  skipped: number;
  balances: Record<string, number>;
}

export const connectionRef = (uid: string) => getFirestore().collection("users").doc(uid).collection("bank").doc("connection");

const toStored = (id: string, d: FirebaseFirestore.DocumentData): StoredLine => ({
  id,
  date: (d.date as Timestamp).toDate(),
  amountCents: d.amountCents,
  source: d.source,
  account: d.account ?? null,
  label: d.label ?? "",
  necessity: d.necessity ?? null,
});

/** Groups writes in batches under Firestore's 500 operations. */
class Writer {
  private batch: WriteBatch;
  private count = 0;
  private readonly done: Promise<unknown>[] = [];
  constructor(private readonly db = getFirestore()) {
    this.batch = db.batch();
  }
  private next() {
    if (++this.count < 450) return;
    this.done.push(this.batch.commit());
    this.batch = this.db.batch();
    this.count = 0;
  }
  set(ref: DocumentReference, data: FirebaseFirestore.DocumentData) {
    this.batch.set(ref, data);
    this.next();
  }
  delete(ref: DocumentReference) {
    this.batch.delete(ref);
    this.next();
  }
  async commit() {
    if (this.count) this.done.push(this.batch.commit());
    await Promise.all(this.done);
  }
}

/**
 * Fetches the booked lines and balances of every linked account and stores them
 * like a CSV import would: new lines only, Apple Pay payments and typed expenses
 * taken over by their bank line, balance and monthly history in Patrimoine.
 */
export async function syncBank(uid: string, client: EnableBanking, now = new Date()): Promise<SyncResult> {
  const db = getFirestore();
  const user = db.collection("users").doc(uid);
  const snap = await connectionRef(uid).get();
  if (!snap.exists) throw new Error("Aucune banque connectée");
  const connection = snap.data() as Connection;
  if (connection.validUntil.toMillis() < now.getTime()) {
    await snap.ref.update({ status: "expired", lastError: "Le consentement a expiré : reconnecte la banque" });
    throw new Error("Consentement expiré");
  }

  const ownerName = (await getAuth().getUser(uid).catch(() => null))?.displayName ?? null;
  const ownIbans = new Map(connection.accounts.filter((a) => a.iban).map((a) => [a.iban as string, a.account]));
  const transactions = user.collection("transactions");
  const result: SyncResult = { added: 0, merged: 0, skipped: 0, balances: {} };

  try {
    for (const linked of connection.accounts) {
      const storedSnap = await transactions.where("account", "==", linked.account).get();
      const stored = storedSnap.docs.map((d) => toStored(d.id, d.data()));
      const lastStored = stored.reduce((max, s) => Math.max(max, s.date.getTime()), 0);
      const since = new Date(lastStored ? lastStored - OVERLAP_DAYS * DAY : now.getTime() - FIRST_SYNC_DAYS * DAY);

      const lines = toBankLines(await client.transactions(linked.uid, localDateKey(since)), linked.account, { ownerName, ownIbans });
      const existing = new Set(stored.map((s) => s.id));
      const covered = alreadyImported(lines, stored);
      const fresh = sortLikeBefore(
        lines.filter((l) => !existing.has(l.id) && !covered.has(l.id)),
        stored,
      );
      result.skipped += lines.length - fresh.length;

      // App entries (no account) from a little before the oldest new line.
      const oldest = fresh.reduce((min, l) => Math.min(min, l.date.getTime()), now.getTime());
      const appSnap = await transactions.where("date", ">=", Timestamp.fromMillis(oldest - 6 * DAY)).get();
      const appEntries = appSnap.docs.map((d) => toStored(d.id, d.data())).filter((t) => t.source !== "bank");
      const matches = matchAppEntries(fresh, appEntries);

      // Bank lines and the app entries they replace go in the same batches.
      const writer = new Writer(db);
      for (const line of fresh) {
        const entry = matches.get(line.id);
        const { id, ...data } = entry ? mergeAppEntry(line, entry) : line;
        writer.set(transactions.doc(id), { ...data, currency: "EUR", merchant: null, source: "bank", syncedBy: "enable_banking", createdAt: FieldValue.serverTimestamp() });
        if (entry) writer.delete(transactions.doc(entry.id));
      }

      const balanceCents = pickBalanceCents((await client.balances(linked.uid)).balances);
      if (balanceCents !== null) {
        const movements = [...stored, ...fresh].map((l) => ({ date: l.date, amountCents: l.amountCents }));
        const holding = user.collection("holdings").doc(accountHoldingId(linked.account));
        const previous = ((await holding.get()).get("history") as BalancePoint[] | undefined) ?? [];
        writer.set(holding, {
          group: linked.account,
          name: linked.account,
          units: 1,
          unitPrice: balanceCents / 100,
          priceDate: FieldValue.serverTimestamp(),
          priceSource: "manual",
          tracker: null,
          history: mergeHistory(previous, monthlyBalances(movements, balanceCents, now)),
          investedCents: null,
        });
        result.balances[linked.account] = balanceCents;
      }
      await writer.commit();
      result.added += fresh.length;
      result.merged += matches.size;
    }
  } catch (error) {
    // A refused JWT (wrong key) is also a 401: only the session itself being gone means reconnecting.
    const expired = error instanceof BankApiError && /expired|revoked|closed|invalid session/i.test(error.body);
    await snap.ref.update({
      status: expired ? "expired" : "error",
      lastError: expired ? "La banque refuse l'accès : reconnecte-la" : (error as Error).message.slice(0, 500),
    });
    throw error;
  }

  await snap.ref.update({ status: "active", lastSyncedAt: Timestamp.fromDate(now), lastResult: result, lastError: null });
  logger.info("bankSync", result);
  return result;
}
