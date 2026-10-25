/**
 * Latest market price of a Yahoo Finance symbol ("AIR.PA" for Airbus on Euronext
 * Paris, "BTC-EUR" for bitcoin in euros). Unofficial but key-less endpoint, enough
 * for one call per symbol per day.
 */
export interface Quote {
  symbol: string;
  price: number;
  currency: string;
  /** Time of the price, as reported by the market. */
  at: Date;
}

export function parseYahooChart(symbol: string, body: unknown): Quote {
  const meta = (body as { chart?: { result?: { meta?: Record<string, unknown> }[] } })?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== "number" || !(price > 0)) throw new Error(`Pas de cours pour ${symbol}`);
  const time = typeof meta?.regularMarketTime === "number" ? meta.regularMarketTime * 1000 : Date.now();
  return { symbol, price, currency: String(meta?.currency ?? "EUR"), at: new Date(time) };
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (second-brain price refresh)" } });
  if (!response.ok) throw new Error(`Yahoo Finance a répondu ${response.status} pour ${symbol}`);
  return parseYahooChart(symbol, await response.json());
}
