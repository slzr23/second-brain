/** Where the money went. Kept in step with CATEGORIES in web/src/data/types.ts. */
export const CATEGORIES = ["courses", "sorties", "transport", "logement", "abonnements", "sante", "shopping", "loisirs", "voyages", "autres"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  courses: "Courses",
  sorties: "Sorties",
  transport: "Transport",
  logement: "Logement et factures",
  abonnements: "Abonnements",
  sante: "Santé",
  shopping: "Shopping",
  loisirs: "Loisirs et sport",
  voyages: "Voyages",
  autres: "Autres",
};

export const NECESSITIES = ["essentiel", "social", "superflu"] as const;
export type Necessity = (typeof NECESSITIES)[number];

/** "Lyovel Sas", "LYOVEL SAS" and "Lyovel  S.A.S" are the same merchant. */
export const merchantKey = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

/**
 * Obvious merchants, by keyword, first match wins (order matters: "UBER EATS"
 * is a meal before "UBER" is a ride). Anything else goes to memory or Claude.
 */
const RULES: [Category, RegExp][] = [
  ["sorties", /\b(UBER ?EATS|DELIVEROO|JUST ?EAT)\b/],
  ["abonnements", /\b(SPOTIFY|NETFLIX|DEEZER|DISNEY|CANAL ?\+?|PRIME VIDEO|APPLE COM BILL|ICLOUD|GOOGLE ONE|YOUTUBE|OPENAI|CHATGPT|ANTHROPIC|CLAUDE AI|STRAVA)\b/],
  ["transport", /\b(SNCF|RATP|ILEVIA|NAVIGO|TRANSILIEN|LIME|DOTT|TIER|VELIB|UBER|BOLT|HEETCH|BLABLACAR|TRAINLINE|FLIXBUS|OUIGO|INDIGO|SAEMES|PEAGE|ESSO|SHELL|TOTAL ?ENERGIES|CARBURANT)\b/],
  ["courses", /\b(CARREFOUR|AUCHAN|LECLERC|LIDL|ALDI|INTERMARCHE|MONOPRIX|FRANPRIX|CASINO|MATCH|SUPER U|U EXPRESS|PICARD|NETTO|BIOCOOP|NATURALIA|G20|SPAR|CITY MARKET|MARCHE|BOULANGERIE|FOURNEE|BOUCHERIE|PRIMEUR)\b/],
  ["sante", /\b(PHARMACIE|PHARMA|DOCTOLIB|MEDECIN|DOCTEUR|DR|DENTISTE|OPTIC\w*|LABO\w*|HOPITAL|CLINIQUE|KINE\w*|MUTUELLE|CPAM)\b/],
  ["logement", /\b(LOYER|EDF|ENGIE|EAU|FREE|FREE TELECOM|FREE MOBILE|SFR|ORANGE|BOUYGUES|SOSH|RED|ASSURANCE|MAIF|MACIF|MATMUT|AXA|COTISATIONS? BANCAIRES?|COMMISSION|FRAIS)\b/],
  ["sorties", /\b(BAR|PUB|BRASSERIE|BISTRO|RESTAURANT|RESTO|CAFE|MC ?DONALD S?|MCDO|KFC|BURGER\w*|SUBWAY|PIZZ\w*|SUSHI|KEBAB|CROUSTY|TACOS|NIGHT|CLUB)\b/],
  ["loisirs", /\b(DECATHLON|INTERSPORT|GO SPORT|URBANSOCCER|FIVE|BASIC ?FIT|FITNESS|SALLE|CINEMA|UGC|PATHE|MK2|MUSEE|CONCERT|TICKETMASTER|FNAC SPECTACLES|STEAM|PLAYSTATION|NINTENDO)\b/],
  ["shopping", /\b(ZARA|H M|HENNES|UNIQLO|KIABI|CELIO|ZALANDO|VINTED|SEPHORA|ACTION|AMAZON|FNAC|DARTY|BOULANGER|IKEA|LEROY MERLIN|PRIMARK|NIKE|ADIDAS)\b/],
  ["voyages", /\b(AIRBNB|BOOKING|HOTEL|IBIS|RYANAIR|EASYJET|AIR FRANCE|TRANSAVIA|VUELING|GETYOURGUIDE)\b/],
];

export function categoryByRule(label: string): Category | null {
  const key = merchantKey(label);
  return RULES.find(([, re]) => re.test(key))?.[0] ?? null;
}

/** A spending line as the classifier sees it. */
export interface SpendLine {
  id: string;
  label: string;
  amountCents: number;
  date: Date;
  category: Category | null;
  /** "me": set by hand in the app; anything else was guessed. */
  categorySource: string | null;
  necessity: Necessity | null;
  suggestedNecessity: Necessity | null;
}

export interface Memory {
  category?: Category;
  necessity?: Necessity;
}

/**
 * What you already decided for each merchant: the latest category you set by
 * hand (or, failing that, the latest one applied), and the latest necessity.
 */
export function buildMemory(lines: SpendLine[]): Map<string, Memory> {
  const memory = new Map<string, Memory & { byHand?: boolean }>();
  for (const l of [...lines].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const key = merchantKey(l.label);
    const m = memory.get(key) ?? {};
    if (l.category && (l.categorySource === "me" || !m.byHand)) {
      m.category = l.category;
      m.byHand = l.categorySource === "me" || m.byHand;
    }
    if (l.necessity) m.necessity = l.necessity;
    memory.set(key, m);
  }
  return memory;
}

/** Lines still missing a category, or a necessity and a proposal for it. */
export const needsWork = (l: SpendLine) => !l.category || (!l.necessity && !l.suggestedNecessity);

export interface Decision {
  id: string;
  category?: Category;
  categorySource?: "memory" | "rule" | "claude";
  suggestedNecessity?: Necessity;
}

/**
 * First pass, without Claude: your own past choices, then the keyword rules.
 * Returns what is decided, and the merchants still unknown (one entry per
 * merchant, so Claude sees each name once).
 */
export function firstPass(lines: SpendLine[]): { decided: Decision[]; unknown: Map<string, SpendLine[]> } {
  const memory = buildMemory(lines);
  const decided: Decision[] = [];
  const unknown = new Map<string, SpendLine[]>();
  for (const l of lines.filter(needsWork)) {
    const key = merchantKey(l.label);
    const m = memory.get(key);
    const d: Decision = { id: l.id };
    if (!l.category && m?.category) Object.assign(d, { category: m.category, categorySource: "memory" });
    if (!l.necessity && !l.suggestedNecessity && m?.necessity) d.suggestedNecessity = m.necessity;

    const hasCategory = !!(l.category || d.category);
    const hasNecessity = !!(l.necessity || l.suggestedNecessity || d.suggestedNecessity);
    if (hasCategory && hasNecessity) {
      decided.push(d);
      continue;
    }
    // Still something to guess: Claude sees the merchant; the rule is the fallback.
    if (!hasCategory) {
      const rule = categoryByRule(l.label);
      if (rule) Object.assign(d, { category: rule, categorySource: "rule" });
    }
    if (d.category || d.suggestedNecessity) decided.push(d);
    unknown.set(key, [...(unknown.get(key) ?? []), l]);
  }
  return { decided, unknown };
}
