import type { CryptoTrade } from "./crypto";
import { parseCsv, stableId } from "./csv";

const HEADER = ["Symbol", "Type", "Quantity", "Price", "Value", "Fees", "Date"];
const MONTHS: Record<string, number> = {
  janv: 0, févr: 1, fevr: 1, mars: 2, avr: 3, mai: 4, juin: 5, juil: 6, août: 7, aout: 7, sept: 8, oct: 9, nov: 10, déc: 11, dec: 11,
};

/** "29 janv. 2025, 14:52:24" → Date (Paris local time, as Revolut shows it). */
export function revolutDate(value: string): Date {
  const m = /^(\d{1,2}) ([^\s.]+)\.? (\d{4}), (\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  const month = m ? MONTHS[m[2].toLowerCase()] : undefined;
  if (!m || month === undefined) throw new Error(`Date Revolut illisible : "${value}"`);
  return new Date(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6]));
}

/** "1 516,19€" → { amount: 1516.19, currency: "EUR" } ; "92 929,61$" → USD */
export function revolutMoney(value: string): { amount: number; currency: "EUR" | "USD" } | null {
  const v = value.trim();
  if (!v) return null;
  const currency = v.endsWith("$") ? "USD" : "EUR";
  const amount = Number(v.replace(/[\s  €$]/g, "").replace(",", "."));
  return Number.isFinite(amount) ? { amount, currency } : null;
}

const quantity = (value: string) => (value.trim() ? Number(value.replace(/[\s  ]/g, "").replace(",", ".")) : 0);

/**
 * Revolut crypto statement (Crypto > … > Relevé > Excel). Columns:
 * Symbol, Type, Quantity, Price, Value, Fees, Date — French numbers, "€" or "$".
 * Purchases on Revolut X are priced in dollars; they are converted with the last
 * USDT price in euros seen in the file, a close stand-in for the dollar.
 */
export const revolut = {
  name: "Revolut",

  detect(headerLine: string) {
    return HEADER.every((column) => headerLine.split(",").map((c) => c.trim()).includes(column));
  },

  async parse(text: string): Promise<CryptoTrade[]> {
    const [header, ...rows] = parseCsv(text, ",");
    const col = Object.fromEntries(HEADER.map((h) => [h, header.findIndex((c) => c.trim() === h)])) as Record<string, number>;
    const get = (row: string[], name: string) => (row[col[name]] ?? "").trim();

    // Oldest first, so the dollar rate known at each moment is the one used.
    const lines = rows
      .filter((r) => get(r, "Symbol") && get(r, "Date"))
      .map((r) => ({ row: r, date: revolutDate(get(r, "Date")) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    let usdToEur = 0.9;
    const seen = new Map<string, number>();
    const trades: CryptoTrade[] = [];

    for (const { row, date } of lines) {
      const asset = get(row, "Symbol");
      const type = get(row, "Type").replace(/\s+/g, " ").toLowerCase();
      const units = quantity(get(row, "Quantity"));
      const price = revolutMoney(get(row, "Price"));
      const value = revolutMoney(get(row, "Value"));
      const fees = revolutMoney(get(row, "Fees"));
      const toEur = (m: { amount: number; currency: string } | null) => (m ? (m.currency === "USD" ? m.amount * usdToEur : m.amount) : 0);
      if (asset === "USDT" && price?.currency === "EUR" && price.amount > 0) usdToEur = price.amount;

      let delta = 0;
      let euros = 0;
      let wallet = false;
      if (type.startsWith("achat") || type.startsWith("acheter")) {
        delta = units;
        euros = toEur(value) + toEur(fees);
      } else if (type.startsWith("vente")) {
        delta = -units;
        euros = -(toEur(value) - toEur(fees));
      } else if (type.startsWith("réception") || type.startsWith("reception")) {
        // Coins coming in from outside: from your own wallet.
        delta = units;
        wallet = true;
      } else if (type.startsWith("envoi") || type.startsWith("retrait")) {
        delta = -units;
        wallet = true;
      } else if (type.startsWith("récompense") || type.startsWith("recompense")) {
        delta = units;
      } else {
        // Staking moves, fiat lines ("Autre"): the amount held does not change.
        continue;
      }
      if (!delta) continue;

      const key = [asset, type, units, date.toISOString()].join("|");
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      trades.push({
        id: await stableId("revolut", `${key}|${n}`),
        platform: "Revolut",
        date,
        asset,
        units: delta,
        euroCents: Math.round(euros * 100),
        price: price ? toEur(price) || null : null,
        wallet,
      });
    }
    return trades;
  },
};
