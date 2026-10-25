import { describe, expect, it } from "vitest";
import { bitstack } from "../src/import/bitstack";
import { cryptoPositions } from "../src/import/crypto";

// Synthetic export in Bitstack's exact format (amounts, ids and addresses are made up).
const HEADER =
  "Type,Date,Fuseau horaire,Montant reçu,Monnaie ou jeton reçu,Montant envoyé,Monnaie ou jeton envoyé,Frais,Monnaie ou jeton des frais,Description,Prix du jeton du montant envoyé,Prix du jeton du montant recu,Prix du jeton des frais,Adresse,Transaction hash,ID Externe";
const Y2025 = [
  HEADER,
  "Échange,2025-12-28T21:00:20Z,GMT,0.0001,BTC,7,EUR,0.29,EUR,Achat par carte,,70000,,,,id-4",
  'Retrait,2025-07-15T06:55:32Z,GMT,,,0.0002,BTC,,,Retrait (Crypto),100000,,,"bc1qexample,bc1qexample",hash1,id-3',
  "Échange,2025-05-24T13:34:52Z,GMT,90,EUR,0.001,BTC,0.84,EUR,Retrait (Fiat),90000,,,,,id-2",
].join("\n");
const Y2024 = [
  HEADER,
  "Échange,2024-12-29T21:00:12Z,GMT,0.002,BTC,100,EUR,0.29,EUR,Achat par carte,,50000,,,,id-1",
  "Dépôt,2024-12-25T09:16:34Z,GMT,0.000001,BTC,,,,,Cadeau,,94236,,,,id-0",
  "Échange,2024-12-29T21:00:12Z,GMT,0.002,BTC,100,EUR,0.29,EUR,Achat par carte,,50000,,,,id-1",
].join("\n");

describe("Bitstack export", () => {
  it("is recognised from its header", () => {
    expect(bitstack.detect(HEADER)).toBe(true);
    expect(bitstack.detect("Date de comptabilisation;Libelle simplifie")).toBe(false);
  });

  it("reads buys, sells, gifts and wallet withdrawals", () => {
    const trades = bitstack.parse(Y2025);
    expect(trades).toEqual([
      { id: "bitstack_id-4", date: new Date("2025-12-28T21:00:20Z"), wallet: false, asset: "BTC", units: 0.0001, euroCents: 700, price: 70000 },
      { id: "bitstack_id-3", date: new Date("2025-07-15T06:55:32Z"), wallet: true, asset: "BTC", units: -0.0002, euroCents: 0, price: 100000 },
      { id: "bitstack_id-2", date: new Date("2025-05-24T13:34:52Z"), wallet: false, asset: "BTC", units: -0.001, euroCents: -9000, price: 90000 },
    ]);
  });

  it("merges yearly files, drops duplicates and sums up the position", () => {
    const [btc] = cryptoPositions([...bitstack.parse(Y2024), ...bitstack.parse(Y2025)], new Date(2026, 0, 15));
    // 0.000001 gift + 0.002 bought − 0.001 sold − 0.0002 to wallet + 0.0001 bought
    expect(btc.units).toBe(0.000901);
    expect(btc.walletUnits).toBe(0.0002);
    expect(btc.investedCents).toBe(100_00 - 90_00 + 7_00);
    expect(btc.trades).toBe(5);
    expect(btc.lastPrice).toBe(70000);
    expect(btc.history[0]).toEqual({ month: "2024-12", cents: Math.round(0.002001 * 50000 * 100) });
    expect(btc.history.at(-1)).toEqual({ month: "2026-01", cents: Math.round(0.000901 * 70000 * 100) });
    expect(btc.history).toHaveLength(14);
  });
});
