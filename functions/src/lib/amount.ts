/**
 * Turns a user- or iOS-provided amount into integer cents (always positive).
 *
 * Accepts what an iPhone Shortcut typically sends:
 *   12.5 · "12,50 €" · "1 234,56 €" · "€12.50" · "1.234,56" · "-8,90"
 * The sign is decided by the record type (expense vs income), not by the input.
 */
export function parseAmountToCents(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("Montant invalide");
    return Math.round(Math.abs(input) * 100);
  }

  // Keep digits and separators only (drops €, spaces, no-break spaces, letters, signs).
  const cleaned = input.replace(/[^\d.,]/g, "");
  if (!/\d/.test(cleaned)) throw new Error(`Montant invalide : "${input}"`);

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);

  let normalized: string;
  if (decimalIndex === -1) {
    normalized = cleaned;
  } else {
    const intPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, "");
    const decPart = cleaned.slice(decimalIndex + 1);
    normalized = `${intPart || "0"}.${decPart}`;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error(`Montant invalide : "${input}"`);
  return Math.round(value * 100);
}
