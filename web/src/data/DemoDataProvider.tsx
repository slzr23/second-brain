import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DataContext } from "./context";
import { demoActivities, demoDreamReport, demoEntries, demoTransactions, demoWeek } from "./demo";
import type { DataSource, Entry, Transaction } from "./types";

/** In-memory data, so the demo is interactive without touching Firebase. */
export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState(demoEntries);
  const [transactions, setTransactions] = useState(demoTransactions);
  // A short fake load, so the demo also shows the loading state.
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);

  const value = useMemo<DataSource>(
    () => ({
      loading,
      entries,
      dreamReport: demoDreamReport,
      transactions,
      activities: demoActivities,
      week: demoWeek,
      async addEntry(kind, text) {
        const entry: Entry = { id: crypto.randomUUID(), kind, text, tags: [], createdAt: new Date() };
        setEntries((list) => [entry, ...list]);
      },
      async addTransaction({ amountCents, label, necessity }) {
        const t: Transaction = { id: crypto.randomUUID(), amountCents, label, necessity, date: new Date(), merchant: null, source: "manual" };
        setTransactions((list) => [t, ...list]);
      },
      async tagTransaction(id, necessity) {
        setTransactions((list) => list.map((t) => (t.id === id ? { ...t, necessity } : t)));
      },
    }),
    [loading, entries, transactions],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
