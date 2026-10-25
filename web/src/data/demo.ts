import type { Activity, DreamReport, Entry, Holding, Transaction, WeekStats } from "./types";
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
});

export const demoTransactions: Transaction[] = [
  tx(0, -4.2, "Boulangerie", null, "apple_pay", 8),
  tx(1, -18.5, "Bières avec les potes", "social", "manual", 21),
  tx(2, -63.42, "Courses de la semaine", "essentiel", "manual", 19),
  tx(3, -13.99, "Livraison repas", "superflu", "apple_pay", 13),
  tx(4, -35, "Resto d'anniversaire", "social", "manual", 20),
  tx(5, -84.9, "Chaussures de trail", null, "apple_pay", 18),
  tx(6, 920, "Salaire", null, "manual", 9),
  tx(7, -9.99, "Forfait téléphone", "essentiel", "bank", 8),
  tx(9, -48.1, "Courses", "essentiel", "apple_pay", 18),
  tx(10, -11.5, "Cinéma", "social", "apple_pay", 20),
  tx(12, -10.99, "Abonnement musique", "superflu", "bank", 7),
  tx(14, -7.6, "Pharmacie", "essentiel", "apple_pay", 17),
  tx(15, -22, "Brunch", "social", "apple_pay", 12),
  tx(17, -51.3, "Courses", "essentiel", "apple_pay", 18),
  tx(19, -39.99, "Vêtements", "superflu", "apple_pay", 15),
  tx(21, -88.8, "Pass Navigo", "essentiel", "bank", 9),
  tx(22, -620, "Loyer", "essentiel", "bank", 9),
];

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

export const demoHoldings: Holding[] = [
  holding("h1", "Livret A", "Livret A", 1, 3_250, 2),
  holding("h2", "Épargne salariale", "Fonds actions", 12.31, 102.45, 3),
  holding("h3", "Épargne salariale", "Fonds monétaire", 2.1, 108.9, 3),
  holding("h4", "Crypto", "Bitcoin", 0.01245, 61_230, 0, "BTC-EUR"),
  holding("h5", "Crypto", "Ether", 0.21, 2_310, 0, "ETH-EUR"),
];
