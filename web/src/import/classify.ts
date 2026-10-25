import type { Necessity } from "../data/types";
import { normalize } from "./csv";
import type { TransferKind } from "./types";

export interface LineToClassify {
  label: string;
  amountCents: number;
  bankCategory: string | null;
  bankSubcategory: string | null;
  operationType: string | null;
}

/** Savings and investment products: money sent there is put aside, not spent. */
const SAVINGS = /\bLIVRET\b|CPT DEPOT PART|\bLDDS?\b|\bPEL\b|BITSTACK|BOURSORAMA|AMUNDI|TRADE REPUBLIC|\bPEA\b/;
/** Other current accounts of yours: topping them up is not spending either. */
const OWN_ACCOUNTS = /\bREVOLUT\b/;
/** Paying friends back. */
const FRIENDS = /\bWERO\b|\bLYDIA\b|\bPAYLIB\b/;

/**
 * Spots money moving between your own accounts, which must not count as spending
 * or income: lines the bank already excludes, savings products, other accounts
 * of yours, and transfers to someone with your own name.
 */
export function detectTransfer(line: LineToClassify, ownerName: string | null): TransferKind | null {
  const label = normalize(line.label);
  const category = normalize(line.bankCategory ?? "");
  const type = normalize(line.operationType ?? "");

  if (SAVINGS.test(label)) return "savings";
  if (category === "TRANSACTION EXCLUE") return "internal";
  if (OWN_ACCOUNTS.test(label) && !type.startsWith("FRAIS")) return "internal";
  if (ownerName && type.startsWith("VIREMENT") && hasAllWords(label, ownerName)) return "internal";
  return null;
}

/** True when every word of the name (3+ letters) appears in the label, in any order. */
function hasAllWords(label: string, name: string): boolean {
  const words = normalize(name)
    .split(/[^A-Z]+/)
    .filter((w) => w.length >= 3);
  return words.length > 0 && words.every((w) => new RegExp(`\\b${w}\\b`).test(label));
}

/**
 * First guess of how much an expense mattered, from the bank's own sub-category.
 * Only the obvious cases are filled in; the rest is left for you (or Claude) to sort.
 */
const BY_SUBCATEGORY: Record<string, Necessity> = {
  "HYPER/SUPERMARCHE": "essentiel",
  "ALIMENTATION - AUTRE": "essentiel",
  "PETIT COMMERCANT": "essentiel",
  "TRANSPORTS EN COMMUN": "essentiel",
  "PEAGE ET STATIONNEMENT": "essentiel",
  CARBURANT: "essentiel",
  "FRAIS BANCAIRES": "essentiel",
  "BANQUE ET ASSURANCE - AUTRE": "essentiel",
  "LOYERS ET TRAITES": "essentiel",
  "INTERNET ET TELEPHONIE": "essentiel",
  "EAU, GAZ, ELECTRICITE": "essentiel",
  "SCOLARITE ET ETUDES": "essentiel",
  "SOUTIEN SCOLAIRE": "essentiel",
  PHARMACIE: "essentiel",
  OPTICIEN: "essentiel",
  "CONSULTATION MEDICALE": "essentiel",
  "IMPOTS ET TAXES - AUTRE": "essentiel",
  "JURIDIQUE ET ADMINISTRATIF - AUTRE": "essentiel",
  "POSTE ET COLIS": "essentiel",
  "TRAVAUX - ENTRETIEN": "essentiel",
  "COIFFEURS ET SOINS DU CORPS": "essentiel",
  RESTAURANT: "social",
  BAR: "social",
  "CADEAUX ET DONS": "social",
  "EXPO, MUSEE, CINEMA": "social",
  "VIDEO, MUSIQUE ET JEUX": "superflu",
  "TAXIS ET VTC": "superflu",
};

export function guessNecessity(line: LineToClassify): Necessity | null {
  if (line.amountCents >= 0) return null;
  if (FRIENDS.test(normalize(line.label))) return "social";
  return BY_SUBCATEGORY[normalize(line.bankSubcategory ?? "")] ?? null;
}
