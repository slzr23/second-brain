import type { Activity, Entry, Transaction, WeekStats } from "./types";

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
        "Allure stable et FC bien contenue en Z2 : la récupération après le fractionné de mardi est bonne. Rien à changer pour la sortie longue de dimanche.",
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
        "Les 4 premières répétitions sont régulières, les 2 dernières perdent 8 s : la FC monte en Z5 dès la 5e. Propose de passer à 5 × 1000 la semaine prochaine.",
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

export const demoWeek: WeekStats = {
  volumeKm: 46.8,
  runs: 4,
  avgRestHr: 49,
  timeInZones: [1_900, 8_100, 3_400, 1_700, 560],
};

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
    text: "Idée : grouper les dépenses « social » par personne pour voir avec qui je sors le plus.",
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

export const demoTransactions: Transaction[] = [
  { id: "t1", amountCents: -420, date: daysAgo(0, 8, 5), label: "Boulangerie", merchant: "Boulangerie", necessity: null, source: "apple_pay" },
  { id: "t2", amountCents: -1850, date: daysAgo(1, 21, 30), label: "Bières avec les potes", merchant: null, necessity: "social", source: "manual" },
  { id: "t3", amountCents: -6342, date: daysAgo(2, 19, 0), label: "Courses de la semaine", merchant: "Supermarché", necessity: "essentiel", source: "manual" },
  { id: "t4", amountCents: -1399, date: daysAgo(3, 13, 12), label: "Livraison repas", merchant: "Livraison", necessity: "superflu", source: "apple_pay" },
  { id: "t5", amountCents: -3500, date: daysAgo(4, 12, 0), label: "Resto d'anniversaire", merchant: null, necessity: "social", source: "manual" },
  { id: "t6", amountCents: -8490, date: daysAgo(5, 18, 45), label: "Chaussures de trail", merchant: "Magasin de sport", necessity: null, source: "apple_pay" },
  { id: "t7", amountCents: 92_000, date: daysAgo(6, 9, 0), label: "Salaire", merchant: null, necessity: null, source: "manual" },
];
