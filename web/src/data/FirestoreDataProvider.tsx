import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  getDocs,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { db } from "../lib/firebase";
import { DataContext } from "./context";
import { mergeHistory } from "../import/history";
import { accountHoldingId, trackerFor, type Activity, type DataSource, type DreamReport, type Entry, type Holding, type HoldingInput, type Transaction, type WeekStats } from "./types";

const toDate = (value: unknown) => (value instanceof Timestamp ? value.toDate() : new Date());

/** Live subscription to users/{uid}/{name}, newest first. `items` is null until the first snapshot. */
/**
 * Live subscription to users/{uid}/{name}, newest first: the `max` latest, or with
 * `sinceMonths`, everything from that many months back (spending comparisons need it).
 */
function useLiveCollection<T>(uid: string, name: string, field: string, map: (id: string, d: DocumentData) => T, max = 100, sinceMonths?: number) {
  const [items, setItems] = useState<T[] | null>(null);
  useEffect(() => {
    const now = new Date();
    const since = sinceMonths ? new Date(now.getFullYear(), now.getMonth() - sinceMonths, 1) : null;
    const ref = collection(db, "users", uid, name);
    const q = since ? query(ref, where(field, ">=", Timestamp.fromDate(since)), orderBy(field, "desc")) : query(ref, orderBy(field, "desc"), limit(max));
    return onSnapshot(q, (snap) => setItems(snap.docs.map((d) => map(d.id, d.data()))));
  }, [uid, name, field, map, max, sinceMonths]); // `map` is a module-level function, so it never changes.
  return items;
}

const mapEntry = (id: string, d: DocumentData): Entry => ({
  id,
  kind: d.kind,
  text: d.text,
  tags: d.tags ?? [],
  createdAt: toDate(d.createdAt),
});

const mapTransaction = (id: string, d: DocumentData): Transaction => ({
  id,
  amountCents: d.amountCents,
  date: toDate(d.date),
  label: d.label,
  merchant: d.merchant ?? null,
  necessity: d.necessity ?? null,
  source: d.source,
  account: d.account ?? null,
  transfer: d.transfer ?? null,
  bankCategory: d.bankCategory ?? null,
});

const mapActivity = (id: string, d: DocumentData): Activity => ({
  id,
  name: d.name ?? "Course",
  date: toDate(d.date),
  distanceM: d.distanceM,
  durationS: d.durationS,
  avgHr: d.avgHr ?? null,
  paceSecKm: d.paceSecKm,
  report: d.report ?? null,
});

const mapReport = (_id: string, d: DocumentData): DreamReport => ({
  weekId: d.weekId,
  summary: d.summary,
  themes: d.themes ?? [],
});

const mapHolding = (id: string, d: DocumentData): Holding => ({
  id,
  group: d.group,
  name: d.name,
  units: d.units,
  unitPrice: d.unitPrice,
  priceDate: d.priceDate instanceof Timestamp ? d.priceDate.toDate() : null,
  priceSource: d.priceSource ?? "manual",
  tracker: d.tracker ?? null,
  history: d.history ?? [],
  investedCents: d.investedCents ?? null,
});

/** A typed price becomes the new base: the evening refresh anchors it on that day's quote. */
const holdingDoc = ({ trackerSymbol, ...input }: HoldingInput) => ({
  ...input,
  priceDate: serverTimestamp(),
  priceSource: "manual",
  tracker: trackerFor(trackerSymbol, input.unitPrice),
});

export function FirestoreDataProvider({ uid, ownerName, weekId, children }: { uid: string; ownerName: string | null; weekId: string; children: ReactNode }) {
  const entries = useLiveCollection(uid, "entries", "createdAt", mapEntry);
  // Current month + 6 before: enough for the 6-month bars and the 3-month average.
  const transactions = useLiveCollection(uid, "transactions", "date", mapTransaction, 0, 6);
  const activities = useLiveCollection(uid, "activities", "date", mapActivity);
  const reports = useLiveCollection(uid, "dreamReports", "weekId", mapReport, 1);
  const holdings = useLiveCollection(uid, "holdings", "group", mapHolding);
  const [week, setWeek] = useState<WeekStats | null>(null);

  useEffect(
    () =>
      onSnapshot(doc(db, "users", uid, "weeklyStats", weekId), (snap) =>
        setWeek(snap.exists() ? ({ goalKm: 40, ...snap.data() } as WeekStats) : null),
      ),
    [uid, weekId],
  );

  const value = useMemo<DataSource>(
    () => ({
      loading: entries === null || transactions === null || activities === null,
      entries: entries ?? [],
      dreamReport: reports?.[0] ?? null,
      transactions: transactions ?? [],
      activities: activities ?? [],
      week,
      holdings: holdings ?? [],
      async addEntry(kind, text) {
        await addDoc(collection(db, "users", uid, "entries"), {
          kind,
          text,
          tags: [],
          source: "web",
          createdAt: serverTimestamp(),
          weekId,
          analyzed: false,
        });
      },
      async addTransaction({ amountCents, label, necessity }) {
        await addDoc(collection(db, "users", uid, "transactions"), {
          amountCents,
          currency: "EUR",
          date: serverTimestamp(),
          label,
          merchant: null,
          necessity,
          source: "manual",
          card: null,
          bankTxId: null,
          matchedTo: null,
          createdAt: serverTimestamp(),
        });
      },
      async tagTransaction(id, necessity) {
        await updateDoc(doc(db, "users", uid, "transactions", id), { necessity });
      },
      async saveHolding(id, input) {
        // merge keeps fields the form does not edit, such as a bank account's history.
        if (id) await setDoc(doc(db, "users", uid, "holdings", id), holdingDoc(input), { merge: true });
        else await addDoc(collection(db, "users", uid, "holdings"), holdingDoc(input));
      },
      async deleteHolding(id) {
        await deleteDoc(doc(db, "users", uid, "holdings", id));
      },
      ownerName,
      async existingTransactionIds(account) {
        const snap = await getDocs(query(collection(db, "users", uid, "transactions"), where("account", "==", account)));
        return new Set(snap.docs.map((d) => d.id));
      },
      async importTransactions(items, onProgress) {
        // Firestore batches hold at most 500 writes.
        for (let i = 0; i < items.length; i += 400) {
          const batch = writeBatch(db);
          for (const { id, date, ...item } of items.slice(i, i + 400)) {
            batch.set(doc(db, "users", uid, "transactions", id), {
              ...item,
              date: Timestamp.fromDate(date),
              currency: "EUR",
              merchant: null,
              source: "bank",
              createdAt: serverTimestamp(),
            });
          }
          await batch.commit();
          onProgress?.(Math.min(i + 400, items.length));
        }
      },
      async saveAccountBalance(account, balanceCents, history) {
        const id = accountHoldingId(account);
        const previous = holdings?.find((h) => h.id === id)?.history ?? [];
        await setDoc(doc(db, "users", uid, "holdings", id), {
          group: account,
          name: account,
          units: 1,
          unitPrice: balanceCents / 100,
          priceDate: serverTimestamp(),
          priceSource: "manual",
          tracker: null,
          history: mergeHistory(previous, history),
          investedCents: null,
        });
      },
      async saveComputedHolding(id, { trackerSymbol, ...h }) {
        await setDoc(doc(db, "users", uid, "holdings", id), {
          ...h,
          priceDate: serverTimestamp(),
          priceSource: "manual",
          tracker: trackerFor(trackerSymbol, h.unitPrice),
        });
      },
    }),
    [uid, ownerName, weekId, entries, transactions, activities, reports, week, holdings],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
