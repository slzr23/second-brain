import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DataContext } from "./context";
import { demoActivities, demoDreamReport, demoEntries, demoHoldings, demoTransactions, demoWeek } from "./demo";
import { mergeHistory } from "../import/history";
import { accountHoldingId, trackerFor, type DataSource, type Entry, type Holding, type Transaction } from "./types";

/** In-memory data, so the demo is interactive without touching Firebase. */
export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState(demoEntries);
  const [transactions, setTransactions] = useState(demoTransactions);
  const [holdings, setHoldings] = useState(demoHoldings);
  const [activities, setActivities] = useState(demoActivities);
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
      activities,
      week: demoWeek,
      holdings,
      netWorthDays: [],
      async addEntry(kind, text) {
        const entry: Entry = { id: crypto.randomUUID(), kind, text, tags: [], createdAt: new Date() };
        setEntries((list) => [entry, ...list]);
      },
      async addTransaction({ amountCents, label, necessity }) {
        const t: Transaction = { id: crypto.randomUUID(), amountCents, label, necessity, date: new Date(), merchant: null, source: "manual", account: null, transfer: null, bankCategory: null };
        setTransactions((list) => [t, ...list]);
      },
      async tagTransaction(id, necessity) {
        setTransactions((list) => list.map((t) => (t.id === id ? { ...t, necessity } : t)));
      },
      async saveHolding(id, { trackerSymbol, ...input }) {
        const next: Holding = {
          id: id ?? crypto.randomUUID(),
          ...input,
          priceDate: new Date(),
          priceSource: "manual",
          tracker: trackerFor(trackerSymbol, input.unitPrice),
          history: holdings.find((h) => h.id === id)?.history ?? [],
          investedCents: holdings.find((h) => h.id === id)?.investedCents ?? null,
        };
        setHoldings((list) => (id ? list.map((h) => (h.id === id ? next : h)) : [...list, next]));
      },
      async deleteHolding(id) {
        setHoldings((list) => list.filter((h) => h.id !== id));
      },
      ownerName: "Camille Martin",
      async accountMovements(account) {
        return transactions.filter((t) => t.account === account).map((t) => ({ date: t.date, amountCents: t.amountCents }));
      },
      async deleteAccount(name) {
        setHoldings((list) => list.filter((h) => h.group !== name));
        setTransactions((list) => list.filter((t) => t.account !== name));
      },
      async existingTransactionIds(account) {
        return new Set(transactions.filter((t) => t.account === account).map((t) => t.id));
      },
      async importTransactions(items, onProgress) {
        const added: Transaction[] = items.map((i) => ({ ...i, merchant: null, source: "bank" }));
        setTransactions((list) => [...list, ...added].sort((a, b) => b.date.getTime() - a.date.getTime()));
        onProgress?.(items.length);
      },
      async importActivities(items, onProgress) {
        setActivities((list) => {
          const byId = new Map(list.map((a) => [a.id, a]));
          for (const { id, ...a } of items) byId.set(id, { id, ...a, report: byId.get(id)?.report ?? null });
          return [...byId.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
        });
        onProgress?.(items.length);
      },
      async saveAccountBalance(account, balanceCents, history) {
        const id = accountHoldingId(account);
        setHoldings((list) => {
          const previous = list.find((h) => h.id === id);
          const next: Holding = {
            id,
            group: account,
            name: account,
            units: 1,
            unitPrice: balanceCents / 100,
            priceDate: new Date(),
            priceSource: "manual",
            tracker: null,
            history: mergeHistory(previous?.history ?? [], history),
            investedCents: null,
          };
          return previous ? list.map((h) => (h.id === id ? next : h)) : [...list, next];
        });
      },
      async saveComputedHolding(id, { trackerSymbol, ...h }) {
        const next: Holding = { id, ...h, priceDate: new Date(), priceSource: "manual", tracker: trackerFor(trackerSymbol, h.unitPrice) };
        setHoldings((list) => (list.some((x) => x.id === id) ? list.map((x) => (x.id === id ? next : x)) : [...list, next]));
      },
    }),
    [loading, entries, transactions, holdings, activities],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
