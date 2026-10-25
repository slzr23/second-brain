import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/scheduler";
import { OWNER_UID } from "../lib/params";
import { localDateKey } from "../lib/week";
import { fetchQuote, type Quote } from "./quotes";
import { revalue, snapshot, type Tracker } from "./revalue";

/**
 * Every evening, after Euronext closes: refresh the quotes, move the
 * tracked holdings, and store the day's net worth.
 */
export const refreshPrices = onSchedule({ schedule: "30 18 * * *", timeZone: "Europe/Paris", retryCount: 2 }, async () => {
  const uid = OWNER_UID.value();
  if (!uid) {
    logger.warn("refreshPrices: OWNER_UID is not set, skipping");
    return;
  }

  const db = getFirestore();
  const user = db.collection("users").doc(uid);
  const holdings = await user.collection("holdings").get();

  const symbols = [...new Set(holdings.docs.map((d) => (d.get("tracker") as Tracker | null)?.symbol).filter((s): s is string => !!s))];
  const quotes = new Map<string, Quote>();
  for (const symbol of symbols) {
    try {
      const quote = await fetchQuote(symbol);
      quotes.set(symbol, quote);
      await user.collection("quotes").doc(symbol).set({ ...quote, at: Timestamp.fromDate(quote.at), fetchedAt: FieldValue.serverTimestamp() });
    } catch (error) {
      // One failing symbol must not block the others; the holding keeps its last price.
      logger.error("refreshPrices: quote failed", { symbol, error: (error as Error).message });
    }
  }

  const batch = db.batch();
  const values = holdings.docs.map((d) => {
    const tracker = d.get("tracker") as Tracker | null;
    const quote = tracker ? quotes.get(tracker.symbol) : undefined;
    let unitPrice = d.get("unitPrice") as number;
    if (tracker && quote) {
      const next = revalue(tracker, quote.price);
      unitPrice = next.unitPrice;
      batch.update(d.ref, { unitPrice, tracker: next.tracker, priceDate: Timestamp.fromDate(quote.at), priceSource: "auto" });
    }
    return { group: d.get("group") as string, units: d.get("units") as number, unitPrice };
  });

  const day = localDateKey(new Date());
  batch.set(user.collection("netWorth").doc(day), { day, ...snapshot(values), createdAt: FieldValue.serverTimestamp() });
  await batch.commit();
  logger.info("refreshPrices", { holdings: holdings.size, quotes: quotes.size });
});
