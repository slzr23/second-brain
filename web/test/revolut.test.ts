import { describe, expect, it } from "vitest";
import { bitstack } from "../src/import/bitstack";
import { cryptoPositions } from "../src/import/crypto";
import { revolut, revolutDate, revolutMoney } from "../src/import/revolut";

// Synthetic statement in Revolut's exact format (made-up amounts).
const CSV = [
  "Symbol,Type,Quantity,Price,Value,Fees,Date",
  'ABC,Vente,"8,5","0,16€","1,36€","0,02€","29 janv. 2025, 14:52:24"',
  'ETH,Achat,"0,002","1 500,00€","3,00€","0,98€","9 avr. 2025, 20:54:57"',
  'BTC,Réception,"0,0009","100 000,00€","90,00€","0,00€","15 juil. 2025, 20:07:16"',
  'BTC,Vente,"0,0009","100 000,00€","90,00€","1,98€","15 juil. 2025, 20:11:06"',
  'USDT,Achat,100,"0,86€","86,00€","1,98€","15 juil. 2025, 20:11:06"',
  'USD,Autre,,,"12,00$","0,00€","18 nov. 2025, 16:56:04"',
  'ETH,Acheter - Revolut X,"0,004","3 000,00$","12,00$","0,02$","18 nov. 2025, 16:57:26"',
  'SOL,Achat,"0,1","150,00€","15,00€","1,50€","3 nov. 2025, 10:55:30"',
  'SOL,Mise en staking,"0,1","150,00€","15,00€","0,00€","3 nov. 2025, 10:56:08"',
  'ABC,Récompense Apprendre,"8,5",,,,"28 janv. 2025, 19:03:22"',
  'SOL,Récompense de staking,"0,000023",,,,"7 nov. 2025, 09:53:48"',
].join("\n");

describe("Revolut crypto statement", () => {
  it("reads French dates and money", () => {
    expect(revolutDate("29 janv. 2025, 14:52:24")).toEqual(new Date(2025, 0, 29, 14, 52, 24));
    expect(revolutDate("2 déc. 2025, 17:52:17")).toEqual(new Date(2025, 11, 2, 17, 52, 17));
    expect(revolutDate("1 mai 2026, 18:34:30")).toEqual(new Date(2026, 4, 1, 18, 34, 30));
    expect(revolutMoney("1 516,19€")).toEqual({ amount: 1516.19, currency: "EUR" });
    expect(revolutMoney("92 929,61$")).toEqual({ amount: 92929.61, currency: "USD" });
  });

  it("is recognised from its header", () => {
    expect(revolut.detect("Symbol,Type,Quantity,Price,Value,Fees,Date")).toBe(true);
    expect(bitstack.detect("Symbol,Type,Quantity,Price,Value,Fees,Date")).toBe(false);
  });

  it("sums up each asset; staking moves and fiat lines change nothing", async () => {
    const positions = cryptoPositions(await revolut.parse(CSV), new Date(2025, 11, 31));
    const units = Object.fromEntries(positions.map((p) => [p.asset, p.platforms[0].units]));
    expect(units).toEqual({ ABC: 0, ETH: 0.006, BTC: 0, USDT: 100, SOL: 0.100023 });

    const eth = positions.find((p) => p.asset === "ETH")!;
    // 3.00 + 0.98 €, then 12.02 $ converted at the last USDT price (0.86 €).
    expect(eth.platforms[0].investedCents).toBe(398 + Math.round(12.02 * 0.86 * 100));
    expect(eth.lastPrice).toBeCloseTo(3000 * 0.86);
  });

  it("cancels coins sent from Bitstack to a wallet then received on Revolut", async () => {
    const bitstackCsv = [
      "Type,Date,Fuseau horaire,Montant reçu,Monnaie ou jeton reçu,Montant envoyé,Monnaie ou jeton envoyé,Frais,Monnaie ou jeton des frais,Description,Prix du jeton du montant envoyé,Prix du jeton du montant recu,Prix du jeton des frais,Adresse,Transaction hash,ID Externe",
      "Échange,2025-06-01T21:00:00Z,GMT,0.002,BTC,150,EUR,0.29,EUR,Achat par carte,,75000,,,,b1",
      "Retrait,2025-07-15T06:55:32Z,GMT,,,0.001,BTC,,,Retrait (Crypto),100000,,,bc1qexample,hash,b2",
    ].join("\n");
    const trades = [...bitstack.parse(bitstackCsv), ...(await revolut.parse(CSV))];
    const btc = cryptoPositions(trades, new Date(2025, 11, 31)).find((p) => p.asset === "BTC")!;
    // 0.001 left Bitstack for the wallet, 0.0009 of it arrived on Revolut (the rest: network fee).
    expect(btc.walletUnits).toBe(0.0001);
    expect(btc.platforms.map((p) => [p.platform, p.units])).toEqual([
      ["Bitstack", 0.001],
      ["Revolut", 0],
    ]);
  });
});
