import type { Category, HealthDay, HydrationDay, Necessity, Activity, DreamReport, Entry, Holding, Transaction, WeekStats } from "./types";
import { isoWeekId } from "../lib/week";

/** Fake but plausible data, so the app can be shown without any personal data. */

const daysAgo = (days: number, hour = 12, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
};

export const demoActivities: Activity[] = [
  {
    id: "a1",
    name: "Footing récup",
    date: daysAgo(0, 7, 10),
    distanceM: 8_120,
    durationS: 2_870,
    avgHr: 138,
    sport: "Run",
    elevationM: null,
    maxHr: null,
    relativeEffort: null,
    paceSecKm: 353,
    report: {
      summary:
        "Allure stable et FC bien contenue en Z2 : tu as bien récupéré du fractionné. Rien à changer pour la sortie longue de dimanche.",
    },
  },
  {
    id: "a2",
    name: "Fractionné 6 × 1000",
    date: daysAgo(2, 18, 30),
    distanceM: 11_400,
    durationS: 3_310,
    avgHr: 162,
    sport: "Run",
    elevationM: null,
    maxHr: null,
    relativeEffort: null,
    paceSecKm: 290,
    report: {
      summary:
        "Les 4 premières répétitions sont régulières, les 2 dernières perdent 8 s et la FC passe en Z5. Je propose 5 × 1000 la semaine prochaine.",
    },
  },
  {
    id: "a3",
    name: "Footing",
    date: daysAgo(4, 7, 0),
    distanceM: 9_000,
    durationS: 3_060,
    avgHr: 141,
    sport: "Run",
    elevationM: null,
    maxHr: null,
    relativeEffort: null,
    paceSecKm: 340,
    report: null,
  },
  {
    id: "a4",
    name: "Sortie longue",
    date: daysAgo(6, 9, 30),
    distanceM: 18_300,
    durationS: 6_420,
    avgHr: 146,
    sport: "Run",
    elevationM: null,
    maxHr: null,
    relativeEffort: null,
    paceSecKm: 351,
    report: null,
  },
];

/** Same aggregate the backend will store in weeklyStats, computed from the demo runs. */
function weekOf(activities: Activity[]): WeekStats {
  const current = isoWeekId();
  const runs = activities.filter((a) => isoWeekId(a.date) === current);
  const byDayKm = [0, 0, 0, 0, 0, 0, 0];
  for (const run of runs) byDayKm[(run.date.getDay() + 6) % 7] += run.distanceM / 1000;
  return {
    volumeKm: byDayKm.reduce((a, b) => a + b, 0),
    goalKm: 40,
    runs: runs.length,
    durationS: runs.reduce((sum, r) => sum + r.durationS, 0),
    avgRestHr: 49,
    byDayKm,
    timeInZones: [1_100, 4_900, 1_900, 1_050, 290],
  };
}

export const demoWeek = weekOf(demoActivities);

export const demoEntries: Entry[] = [
  {
    id: "e1",
    kind: "dream",
    text: "Je devais rendre un rapport mais toutes les pages étaient blanches. Le train partait sans moi.",
    tags: ["travail", "retard"],
    createdAt: daysAgo(0, 6, 52),
  },
  {
    id: "e2",
    kind: "note",
    text: "Idée : regrouper les dépenses « social » par personne pour voir avec qui je sors le plus.",
    tags: ["idée"],
    createdAt: daysAgo(1, 22, 14),
  },
  {
    id: "e3",
    kind: "dream",
    text: "Je courais sur une plage en Normandie, sans jamais être essoufflé. Le sable devenait de la piste.",
    tags: ["course", "mer"],
    createdAt: daysAgo(3, 7, 3),
  },
  {
    id: "e4",
    kind: "dream",
    text: "Une réunion où personne ne parlait la même langue, mais tout le monde se comprenait.",
    tags: ["travail"],
    createdAt: daysAgo(5, 6, 40),
  },
];

export const demoDreamReport: DreamReport = {
  weekId: isoWeekId(),
  summary:
    "Le travail revient dans 2 rêves sur 3, souvent sous forme de retard ou de pages blanches : une échéance te pèse sans doute. Les rêves de course, eux, sont fluides et sans effort.",
  themes: [
    { name: "Travail", count: 2 },
    { name: "Retard", count: 1 },
    { name: "Course", count: 1 },
    { name: "Mer", count: 1 },
  ],
};

/** What the morning sorting would give the demo lines. */
const DEMO_CATEGORY: [RegExp, Category][] = [
  [/courses|boulangerie|march|carrefour|monoprix/i, "courses"],
  [/bière|bar|resto|livraison|pizza|apéro|café/i, "sorties"],
  [/navigo|sncf|uber|essence|train/i, "transport"],
  [/loyer|électricité|edf|free|assurance|box/i, "logement"],
  [/spotify|netflix|abonnement|icloud|forfait|téléphone/i, "abonnements"],
  [/pharmacie|médecin/i, "sante"],
  [/chaussures|trail|piscine|salle|cinéma|décathlon/i, "loisirs"],
  [/vêtement|zara|amazon|livre/i, "shopping"],
];
const demoCategory = (label: string): Category => DEMO_CATEGORY.find(([re]) => re.test(label))?.[1] ?? "autres";
const demoSuggestion = (category: Category): Necessity => (category === "sorties" ? "social" : ["shopping", "loisirs", "abonnements"].includes(category) ? "superflu" : "essentiel");

let n = 0;
const tx = (days: number, euros: number, label: string, necessity: Transaction["necessity"], source: Transaction["source"] = "manual", hour = 12): Transaction => ({
  id: `t${++n}`,
  amountCents: Math.round(euros * 100),
  date: daysAgo(days, hour),
  label,
  merchant: null,
  necessity,
  source,
  account: source === "bank" ? "Compte courant" : null,
  transfer: null,
  bankCategory: null,
  category: euros < 0 ? demoCategory(label) : null,
  categorySource: euros < 0 ? "claude" : null,
  suggestedNecessity: euros < 0 && !necessity ? demoSuggestion(demoCategory(label)) : null,
});

/** Deterministic pseudo-random numbers, so the demo looks the same on every load. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/**
 * Seven months of a plausible current account, on a real rhythm: salary on the
 * 27th, rent right after, an allowance on the 5th, subscriptions on fixed days
 * (one of them going up), groceries and outings in between. The last week is
 * left to sort, and the month in progress holds one double charge to spot.
 */
function demoMonths(): Transaction[] {
  const rand = seeded(42);
  const list: Transaction[] = [];
  const now = new Date();
  const at = (month: Date, day: number, euros: number, label: string, necessity: Transaction["necessity"], extra: Partial<Transaction> = {}) => {
    const date = new Date(month.getFullYear(), month.getMonth(), day, 9 + Math.floor(rand() * 11));
    if (date > now || day > new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) return;
    const fresh = now.getTime() - date.getTime() < 7 * 86_400_000;
    const t = { ...tx(0, euros, label, fresh && euros < 0 ? null : necessity, extra.source ?? "bank"), date, ...extra };
    if (t.source !== "bank") t.account = null;
    list.push(t);
  };

  for (let m = 6; m >= 0; m--) {
    const month = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    at(month, 1, -88.8, "Pass Navigo", "essentiel");
    at(month, 5, 182, "CAF aide au logement", null);
    at(month, 8, -9.99, "Forfait téléphone", "essentiel");
    at(month, 12, m <= 1 ? -11.99 : -10.99, "Abonnement musique", "superflu");
    at(month, 15, -29.9, "Salle de sport", "superflu");
    at(month, 16, -4.2, "Cotisation compte bancaire", "essentiel", { category: "autres" });
    at(month, 20, -100, "Virement vers Livret A", null, { transfer: "savings", category: null, suggestedNecessity: null });
    at(month, 27, 1180, "Salaire", null);
    at(month, 28, -620, "Loyer", "essentiel");
    for (let d = 2; d <= days; d += 4) at(month, d, -(15 + rand() * 32), rand() > 0.3 ? "Courses" : "Boulangerie", "essentiel", { source: rand() > 0.5 ? "apple_pay" : "bank" });
    for (let d = 4; d <= days; d += 6) at(month, d, -(8 + rand() * 24), ["Bar avec les potes", "Resto", "Cinéma", "Livraison repas"][Math.floor(rand() * 4)], "social", { source: "apple_pay" });
    for (let d = 9; d <= days; d += 12) at(month, d, -(12 + rand() * 35), rand() > 0.5 ? "Vêtements" : "Livre", "superflu");
    if (m === 3) at(month, 22, -8, "Commission d'intervention", null, { category: "autres", necessity: "superflu" });
    if (m === 3) at(month, 23, -8, "Commission d'intervention", null, { category: "autres", necessity: "superflu" });
    if (m % 2 === 0) at(month, 18, 15, "Virement de Tom (resto)", null);
  }
  // Charged twice in the month in progress?
  const d1 = new Date(now.getTime() - 3 * 86_400_000);
  list.push({ ...tx(3, -42, "Décathlon", null, "bank"), date: d1 }, { ...tx(2, -42, "Décathlon", null, "bank"), date: new Date(d1.getTime() + 86_400_000) });
  return list;
}

export const demoTransactions: Transaction[] = demoMonths().sort((a, b) => b.date.getTime() - a.date.getTime());

const holding = (id: string, group: string, name: string, units: number, unitPrice: number, days: number, symbol: string | null = null): Holding => ({
  id,
  group,
  name,
  units,
  unitPrice,
  priceDate: daysAgo(days, 18, 30),
  priceSource: symbol ? "auto" : "manual",
  tracker: symbol ? { symbol, baseUnitPrice: unitPrice, baseQuote: unitPrice } : null,
  history: [],
  investedCents: null,
});

/** Month-by-month values ending at `end`, drifting by `step` per month (for the charts). */
function history(months: number, end: number, step: number, wobble = 0) {
  const rand = seeded(end);
  const today = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1);
    const back = months - 1 - i;
    return {
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      cents: Math.max(0, Math.round((end - step * back + (rand() - 0.5) * wobble) * 100)),
    };
  });
}

export const demoHoldings: Holding[] = [
  { ...holding("h1", "Livret A", "Livret A", 1, 3_250, 2), history: history(18, 3_250, 90, 300) },
  holding("h2", "Épargne salariale", "Fonds actions", 12.31, 102.45, 3),
  holding("h3", "Épargne salariale", "Fonds monétaire", 2.1, 108.9, 3),
  { ...holding("h4", "Crypto", "Bitcoin", 0.01245, 61_230, 0, "BTC-EUR"), history: history(18, 762, 30, 260), investedCents: 520_00 },
  { ...holding("h5", "Crypto", "Ether", 0.21, 2_310, 0, "ETH-EUR"), history: history(10, 485, 20, 140), investedCents: 410_00 },
  { ...holding("h6", "Compte courant", "Compte courant", 1, 412.3, 1), history: history(18, 412, 0, 500) },
];

const dayKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const demoHealth: HealthDay[] = [430, 395, 462, 371, 448, 410, 502].map((asleepMin, i) => {
  const end = daysAgo(i);
  end.setHours(7, 10, 0, 0);
  return {
    day: dayKeyOf(end),
    sleep: { start: new Date(end.getTime() - (asleepMin + 25) * 60_000), end, asleepMin, deepMin: Math.round(asleepMin * 0.16), remMin: Math.round(asleepMin * 0.22), coreMin: Math.round(asleepMin * 0.62), awakeMin: 15 },
    restingHr: [52, 54, 51, 55, 53, 52, 50][i],
  };
});

export const demoHydration: HydrationDay[] = [1250, 1900, 2200, 1500, 2050, 1700, 2400, 1600].map((ml, i) => ({ day: dayKeyOf(daysAgo(i)), ml }));
