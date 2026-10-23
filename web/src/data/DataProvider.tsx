import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { db } from "../lib/firebase";
import { demoActivities, demoEntries, demoTransactions, demoWeek } from "./demo";
import type { Activity, DataSource, Entry, Transaction, WeekStats } from "./types";

const DataContext = createContext<DataSource | null>(null);

export function useData(): DataSource {
  const value = useContext(DataContext);
  if (!value) throw new Error("useData must be used inside a data provider");
  return value;
}

/** In-memory data, so the demo is interactive without touching Firebase. */
export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState(demoEntries);
  const [transactions, setTransactions] = useState(demoTransactions);

  const value = useMemo<DataSource>(
    () => ({
      entries,
      transactions,
      activities: demoActivities,
      week: demoWeek,
      async addEntry(kind, text) {
        const entry: Entry = { id: crypto.randomUUID(), kind, text, tags: [], createdAt: new Date() };
        setEntries((list) => [entry, ...list]);
      },
      async tagTransaction(id, necessity) {
        setTransactions((list) => list.map((t) => (t.id === id ? { ...t, necessity } : t)));
      },
    }),
    [entries, transactions],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

const toDate = (value: unknown) => (value instanceof Timestamp ? value.toDate() : new Date());

/** Live subscription to users/{uid}/{name}, newest first. */
function useLiveCollection<T>(uid: string, name: string, dateField: string, map: (id: string, d: DocumentData) => T) {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const q = query(collection(db!, "users", uid, name), orderBy(dateField, "desc"), limit(100));
    return onSnapshot(q, (snap) => setItems(snap.docs.map((d) => map(d.id, d.data()))));
  }, [uid, name, dateField, map]); // `map` is a module-level function, so it never changes.
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

export function FirestoreDataProvider({ uid, weekId, children }: { uid: string; weekId: string; children: ReactNode }) {
  const entries = useLiveCollection(uid, "entries", "createdAt", mapEntry);
  const transactions = useLiveCollection(uid, "transactions", "date", mapTransaction);
  const activities = useLiveCollection(uid, "activities", "date", mapActivity);
  const [week, setWeek] = useState<WeekStats | null>(null);

  useEffect(
    () => onSnapshot(doc(db!, "users", uid, "weeklyStats", weekId), (snap) => setWeek((snap.data() as WeekStats) ?? null)),
    [uid, weekId],
  );

  const value = useMemo<DataSource>(
    () => ({
      entries,
      transactions,
      activities,
      week,
      async addEntry(kind, text) {
        await addDoc(collection(db!, "users", uid, "entries"), {
          kind,
          text,
          tags: [],
          source: "web",
          createdAt: serverTimestamp(),
          weekId,
          analyzed: false,
        });
      },
      async tagTransaction(id, necessity) {
        await updateDoc(doc(db!, "users", uid, "transactions", id), { necessity });
      },
    }),
    [uid, weekId, entries, transactions, activities, week],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
