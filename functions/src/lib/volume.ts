/**
 * Turns what a Shortcut sends for a drink into millilitres:
 *   250 · "250 ml" · "25 cl" · "0,5 L" · "1L" · "0.33"
 * Without a unit, a small number (≤ 5) is read as litres, anything else as millilitres.
 */
export function parseVolumeMl(input: string | number): number {
  let value: number;
  let unit = "";
  if (typeof input === "number") value = input;
  else {
    const match = input.trim().toLowerCase().replace(",", ".").match(/^(\d+(?:\.\d+)?)\s*(ml|cl|l)?\b/);
    if (!match) throw new Error(`Quantité illisible : "${input}"`);
    value = Number(match[1]);
    unit = match[2] ?? "";
  }
  if (!Number.isFinite(value) || value <= 0) throw new Error("Quantité invalide");
  const ml = unit === "l" ? value * 1000 : unit === "cl" ? value * 10 : unit === "ml" ? value : value <= 5 ? value * 1000 : value;
  if (ml < 10 || ml > 3000) throw new Error("Quantité invalide : entre 1 cl et 3 L par prise");
  return Math.round(ml);
}

/** "250 ml", "1,25 L". */
export const formatVolume = (ml: number) =>
  ml < 1000 ? `${ml} ml` : `${(ml / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} L`;
