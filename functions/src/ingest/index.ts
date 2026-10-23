import { createHash, timingSafeEqual } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { defineSecret, defineString } from "firebase-functions/params";
import { z } from "zod";
import { buildRecord } from "./build";
import { ingestPayload } from "./schema";

/** Long random string pasted into the iOS Shortcut (Authorization: Bearer …). */
const INGEST_TOKEN = defineSecret("INGEST_TOKEN");
/** Firebase Auth uid of the owner: everything lands under users/{OWNER_UID}. */
const OWNER_UID = defineString("OWNER_UID");

/** Constant-time comparison; hashing first makes both buffers the same length. */
function tokenMatches(received: string, expected: string): boolean {
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
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

  const ref = await getFirestore()
    .collection("users")
    .doc(OWNER_UID.value())
    .collection(record.collection)
    .add(record.data);

  logger.info("ingest", { type: parsed.data.type, id: ref.id });
  res.status(201).json({ ok: true, id: ref.id, message: record.message });
});
