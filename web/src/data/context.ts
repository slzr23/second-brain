import { createContext, useContext } from "react";
import type { DataSource } from "./types";

export const DataContext = createContext<DataSource | null>(null);

export function useData(): DataSource {
  const value = useContext(DataContext);
  if (!value) throw new Error("useData must be used inside a data provider");
  return value;
}
