import type { CryptoTrade } from "./crypto";
import { parseCsv } from "./csv";

const REQUIRED = ["Montant reçu", "Monnaie ou jeton reçu", "Montant envoyé", "Monnaie ou jeton envoyé", "ID Externe"];
const FIAT = new Set(["EUR"]);

/**
 * Bitstack's transaction export (Profil > Documents > Historique, one CSV per year).
 * Columns: Type, Date, Fuseau horaire, Montant reçu, Monnaie ou jeton reçu, Montant envoyé,
 * Monnaie ou jeton envoyé, Frais, Monnaie ou jeton des frais, Description, Prix du jeton du
 * montant envoyé, Prix du jeton du montant recu, Prix du jeton des frais, Adresse,
 * Transaction hash, ID Externe
 */
export const bitstack = {
  name: "Bitstack",

  detect(headerLine: string) {
    return REQUIRED.every((column) => headerLine.includes(column));
  },

  parse(text: string): CryptoTrade[] {
    const [header, ...rows] = parseCsv(text, ",");
    const at = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
    const col = {
      date: at("Date"),
      received: at("Montant reçu"),
      receivedAsset: at("Monnaie ou jeton reçu"),
      sent: at("Montant envoyé"),
      sentAsset: at("Monnaie ou jeton envoyé"),
      description: at("Description"),
      sentPrice: at("Prix du jeton du montant envoyé"),
      receivedPrice: at("Prix du jeton du montant recu"),
      id: at("ID Externe"),
    };
    const get = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const num = (value: string) => (value ? Number(value) : 0);

    const trades: CryptoTrade[] = [];
    for (const row of rows) {
      const id = get(row, col.id);
      if (!id) continue;
      const received = num(get(row, col.received));
      const receivedAsset = get(row, col.receivedAsset);
      const sent = num(get(row, col.sent));
      const sentAsset = get(row, col.sentAsset);
      const description = get(row, col.description).toLowerCase();
      const wallet = description.includes("(crypto)");
      const base = { id: `bitstack_${id}`, date: new Date(get(row, col.date)), wallet };

      if (receivedAsset && !FIAT.has(receivedAsset)) {
        // Bought with euros, a gift, or coins coming back from your wallet.
        trades.push({
          ...base,
          asset: receivedAsset,
          units: received,
          euroCents: FIAT.has(sentAsset) ? Math.round(sent * 100) : 0,
          price: num(get(row, col.receivedPrice)) || null,
        });
      } else if (sentAsset && !FIAT.has(sentAsset)) {
        // Sold for euros, or sent to your wallet.
        trades.push({
          ...base,
          asset: sentAsset,
          units: -sent,
          euroCents: FIAT.has(receivedAsset) ? -Math.round(received * 100) : 0,
          price: num(get(row, col.sentPrice)) || null,
        });
      }
    }
    return trades;
  },
};
