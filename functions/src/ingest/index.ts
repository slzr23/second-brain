import { createHash, timingSafeEqual } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { z } from "zod";
import { formatMinutes, parseSleepLines, summarizeNight } from "../health/sleep";
import { INGEST_TOKEN, OWNER_UID, SPORT_TOKEN } from "../lib/params";
import { toActivityDoc } from "../sport/activities";
import { formatVolume } from "../lib/volume";
import { localDateKey } from "../lib/week";
import { buildRecord } from "./build";
import { ingestPayload, type CapturePayload } from "./schema";

/**
 * Constant-time comparison; hashing first makes both buffers the same length.
 * Both sides are trimmed: a secret set with `openssl rand … | firebase functions:secrets:set
 * --data-file=-` keeps openssl's trailing newline, which a header never carries.
 */
export function tokenMatches(received: string, expected: string): boolean {
  const a = createHash("sha256").update(received.trim()).digest();
  const b = createHash("sha256").update(expected.trim()).digest();
  return timingSafeEqual(a, b);
}

export const readToken = (header: string | undefined) => (header ?? "").trim().replace(/^bearer\s*:?\s*/i, "").trim();

/**
 * Single entry point for everything captured on the phone:
 * Action Button (dream, note, expense, income), the Wallet automation (apple_pay),
 * the morning Apple Health shortcut (health) and the Strava routine (activities).
 * Replies with a short French message the Shortcut can show as a notification.
 */
export const ingest = onRequest({ secrets: [INGEST_TOKEN, SPORT_TOKEN], cors: false }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Utilise POST" });
    return;
  }

  // "Bearer <token>", tolerant of what is easy to get wrong when typing it in a
  // Shortcut: the case of "Bearer", extra spaces, or the token alone.
  const token = readToken(req.get("authorization"));
  // The phone's token can send anything; the routine's only activities.
  const scope = !token ? null : tokenMatches(token, INGEST_TOKEN.value()) ? "all" : tokenMatches(token, SPORT_TOKEN.value()) ? "sport" : null;
  if (!scope || (scope === "sport" && req.body?.type !== "activities")) {
    // Enough to tell which Shortcut is wrong and how, never the token itself.
    logger.warn("ingest: token refused", {
      type: typeof req.body?.type === "string" ? req.body.type.slice(0, 20) : null,
      header: req.get("authorization") === undefined ? "missing" : "present",
      length: token.length,
      expectedLength: INGEST_TOKEN.value().trim().length,
    });
    res.status(401).json({ ok: false, error: "Jeton manquant ou invalide" });
    return;
  }

  const owner = OWNER_UID.value();
  if (!owner) {
    res.status(503).json({ ok: false, error: "OWNER_UID n'est pas encore configuré" });
    return;
  }

  const parsed = ingestPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: z.prettifyError(parsed.error) });
    return;
  }

  const user = getFirestore().collection("users").doc(owner);
  const payload = parsed.data;

  if (payload.type === "activities") {
    let docs;
    try {
      docs = payload.activities.map(toActivityDoc);
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
      return;
    }
    const batch = getFirestore().batch();
    // merge: a report Claude already wrote for an activity stays.
    for (const { id, data } of docs) batch.set(user.collection("activities").doc(id), { ...data, importedAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
    logger.info("ingest", { type: "activities", count: docs.length });
    res.status(201).json({ ok: true, count: docs.length, message: docs.length ? `${docs.length} activité${docs.length > 1 ? "s" : ""} enregistrée${docs.length > 1 ? "s" : ""}` : "Aucune nouvelle activité" });
    return;
  }

  if (payload.type === "health") {
    const night = payload.sleep ? summarizeNight(parseSleepLines(payload.sleep)) : null;
    const hr = payload.restingHr === undefined ? null : Number(String(payload.restingHr).replace(",", ".").match(/\d+(\.\d+)?/)?.[0]);
    const restingHr = hr && hr > 25 && hr < 150 ? Math.round(hr) : null;
    if (!night && !restingHr) {
      res.status(400).json({ ok: false, error: "Ni sommeil ni FC au repos lisibles" });
      return;
    }
    const day = night?.day ?? localDateKey(new Date());
    await user.collection("health").doc(day).set(
      { day, ...(night ? { sleep: night } : {}), ...(restingHr ? { restingHr } : {}), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    logger.info("ingest", { type: "health", day, sleep: !!night, restingHr: !!restingHr });
    const parts = [night ? `Nuit de ${formatMinutes(night.asleepMin)}` : null, restingHr ? `FC repos ${restingHr}` : null].filter(Boolean);
    res.status(201).json({ ok: true, id: day, message: parts.join(" · ") });
    return;
  }

  let record;
  try {
    record = buildRecord(payload as CapturePayload, new Date());
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
    return;
  }

  if (record.collection === "hydration") {
    // One document per day holding the total and each drink, so the app reads a day in one go.
    const { day, drink } = record;
    const ref = user.collection("hydration").doc(day);
    const total = await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const ml = (snap.get("ml") ?? 0) + drink.ml;
      tx.set(ref, { day, ml, drinks: FieldValue.arrayUnion(drink), updatedAt: drink.at }, { merge: true });
      return ml;
    });
    logger.info("ingest", { type: "water", day });
    res.status(201).json({ ok: true, id: day, message: `${record.message} · ${formatVolume(total)} aujourd'hui` });
    return;
  }

  const ref = await user.collection(record.collection).add(record.data);
  logger.info("ingest", { type: parsed.data.type, id: ref.id });
  res.status(201).json({ ok: true, id: ref.id, message: record.message });
});
