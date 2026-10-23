/** Client-side shapes of the Firestore documents (see README > Modèle de données). */

export type EntryKind = "dream" | "note";

export interface Entry {
  id: string;
  kind: EntryKind;
  text: string;
  tags: string[];
  createdAt: Date;
}

export interface DreamReport {
  weekId: string;
  summary: string;
  themes: { name: string; count: number }[];
}

export const NECESSITIES = ["essentiel", "social", "superflu"] as const;
export type Necessity = (typeof NECESSITIES)[number];
export const NECESSITY_LABEL: Record<Necessity, string> = {
  essentiel: "Essentiel",
  social: "Social",
  superflu: "Superflu",
};

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

export interface NewTransaction {
  amountCents: number;
  label: string;
  necessity: Necessity | null;
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
  goalKm: number;
  runs: number;
  durationS: number;
  avgRestHr: number | null;
  /** Kilometres run each day, Monday first. */
  byDayKm: number[];
  /** Seconds spent in Z1…Z5. */
  timeInZones: number[];
}

export interface DataSource {
  loading: boolean;
  entries: Entry[];
  dreamReport: DreamReport | null;
  transactions: Transaction[];
  activities: Activity[];
  week: WeekStats | null;
  addEntry(kind: EntryKind, text: string): Promise<void>;
  addTransaction(transaction: NewTransaction): Promise<void>;
  tagTransaction(id: string, necessity: Necessity): Promise<void>;
}
