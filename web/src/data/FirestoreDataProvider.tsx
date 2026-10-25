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
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { db } from "../lib/firebase";
import { DataContext } from "./context";
import type { Activity, DataSource, DreamReport, Entry, Holding, HoldingInput, Transaction, WeekStats } from "./types";

const toDate = (value: unknown) => (value instanceof Timestamp ? value.toDate() : new Date());

/** Live subscription to users/{uid}/{name}, newest first. `items` is null until the first snapshot. */
function useLiveCollection<T>(uid: string, name: string, field: string, map: (id: string, d: DocumentData) => T, max = 100) {
  const [items, setItems] = useState<T[] | null>(null);
  useEffect(() => {
    const q = query(collection(db, "users", uid, name), orderBy(field, "desc"), limit(max));
    return onSnapshot(q, (snap) => setItems(snap.docs.map((d) => map(d.id, d.data()))));
  }, [uid, name, field, map, max]); // `map` is a module-level function, so it never changes.
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
});

/** A typed price becomes the new base: the evening refresh anchors it on that day's quote. */
const holdingDoc = ({ trackerSymbol, ...input }: HoldingInput) => ({
  ...input,
  priceDate: serverTimestamp(),
  priceSource: "manual",
  tracker: trackerSymbol ? { symbol: trackerSymbol, baseUnitPrice: input.unitPrice, baseQuote: null } : null,
});

export function FirestoreDataProvider({ uid, weekId, children }: { uid: string; weekId: string; children: ReactNode }) {
  const entries = useLiveCollection(uid, "entries", "createdAt", mapEntry);
  const transactions = useLiveCollection(uid, "transactions", "date", mapTransaction);
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
        if (id) await setDoc(doc(db, "users", uid, "holdings", id), holdingDoc(input));
        else await addDoc(collection(db, "users", uid, "holdings"), holdingDoc(input));
      },
      async deleteHolding(id) {
        await deleteDoc(doc(db, "users", uid, "holdings", id));
      },
    }),
    [uid, weekId, entries, transactions, activities, reports, week, holdings],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
