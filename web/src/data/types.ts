/** Client-side shapes of the Firestore documents (see README > Modèle de données). */

export type EntryKind = "dream" | "note";

export interface Entry {
  id: string;
  kind: EntryKind;
  text: string;
  tags: string[];
  createdAt: Date;
}

export const NECESSITIES = ["essentiel", "social", "superflu"] as const;
export type Necessity = (typeof NECESSITIES)[number];

export interface Transaction {
  id: string;
  /** Signed: negative for money going out. */
  amountCents: number;
  date: Date;
  label: string;
  merchant: string | null;
  necessity: Necessity | null;
  source: "manual" | "apple_pay" | "bank";
}

export interface Activity {
  id: string;
  name: string;
  date: Date;
  distanceM: number;
  durationS: number;
  avgHr: number | null;
  /** Seconds per km. */
  paceSecKm: number;
  report: { summary: string } | null;
}

export interface WeekStats {
  volumeKm: number;
  runs: number;
  avgRestHr: number | null;
  /** Seconds spent in Z1…Z5. */
  timeInZones: number[];
}

export interface DataSource {
  entries: Entry[];
  transactions: Transaction[];
  activities: Activity[];
  week: WeekStats | null;
  addEntry(kind: EntryKind, text: string): Promise<void>;
  tagTransaction(id: string, necessity: Necessity): Promise<void>;
}
