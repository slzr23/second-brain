import { createHash, timingSafeEqual } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { z } from "zod";
import { INGEST_TOKEN, OWNER_UID } from "../lib/params";
import { formatVolume } from "../lib/volume";
import { buildRecord } from "./build";
import { ingestPayload } from "./schema";

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

/**
 * Single entry point for everything captured on the phone:
 * Action Button (dream, note, expense, income) and the Wallet automation (apple_pay).
 * Replies with a short French message the Shortcut can show as a notification.
 */
export const ingest = onRequest({ secrets: [INGEST_TOKEN], cors: false }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Utilise POST" });
    return;
  }

  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !tokenMatches(token, INGEST_TOKEN.value())) {
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

  let record;
  try {
    record = buildRecord(parsed.data, new Date());
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
    return;
  }

  const user = getFirestore().collection("users").doc(owner);

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
