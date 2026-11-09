import { randomBytes } from "node:crypto";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest, type CallableRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/scheduler";
import { APP_URL, BANK_ASPSP, ENABLE_BANKING_APP_ID, ENABLE_BANKING_KEY, OWNER_UID } from "../lib/params";
import { EnableBanking } from "./client";
import { accountName } from "./map";
import { connectionRef, syncBank, type Connection } from "./sync";

const COUNTRY = "FR";
const MAX_CONSENT_S = 180 * 86_400;
const STATE_TTL_MS = 30 * 60_000;

const client = () => {
  const appId = ENABLE_BANKING_APP_ID.value();
  if (!appId) throw new Error("ENABLE_BANKING_APP_ID n'est pas configuré");
  return new EnableBanking(appId, ENABLE_BANKING_KEY.value());
};

const pendingRef = (uid: string) => getFirestore().collection("users").doc(uid).collection("bank").doc("pending");

/** Only the owner, signed in to the app, may connect the bank or trigger a sync. */
function requireOwner(req: CallableRequest): string {
  const owner = OWNER_UID.value();
  if (!owner || req.auth?.uid !== owner) throw new HttpsError("permission-denied", "Réservé au propriétaire");
  return owner;
}

const page = (title: string, text: string, link: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
  `<body style="font:17px -apple-system,system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 16px">` +
  `<h1 style="font-size:1.4rem">${title}</h1><p>${text}</p><p><a href="${link}">Revenir à l'app</a></p></body>`;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Starts a consent with the bank (callable from the app): returns the bank's page,
 * where you sign in as usual. Valid as long as the bank allows, 180 days at most.
 */
export const bankConnect = onCall({ secrets: [ENABLE_BANKING_KEY] }, async (req) => {
  const uid = requireOwner(req);
  const name = BANK_ASPSP.value();
  if (!name) throw new HttpsError("failed-precondition", "BANK_ASPSP n'est pas configuré");

  const api = client();
  const { aspsps } = await api.aspsps(COUNTRY);
  const aspsp = aspsps.find((a) => a.name === name);
  if (!aspsp) {
    const close = aspsps.filter((a) => /epargne/i.test(a.name)).map((a) => a.name);
    throw new HttpsError("failed-precondition", `Banque « ${name} » introuvable. Proches : ${close.join(", ")}`);
  }

  const validity = Math.min(aspsp.maximum_consent_validity ?? MAX_CONSENT_S, MAX_CONSENT_S);
  // A few minutes of margin: the bank refuses a date past its maximum.
  const validUntil = new Date(Date.now() + (validity - 600) * 1000);
  const state = randomBytes(16).toString("hex");
  await pendingRef(uid).set({ state, createdAt: FieldValue.serverTimestamp() });

  const { url } = await api.startAuth({
    aspsp: { name: aspsp.name, country: aspsp.country },
    validUntil,
    redirectUrl: `${APP_URL.value()}/api/bank/callback`,
    state,
  });
  return { url };
});

/** Where the bank sends you back after the consent: opens the session, then a first sync. */
export const bankCallback = onRequest({ secrets: [ENABLE_BANKING_KEY], cors: false }, async (req, res) => {
  const back = `${APP_URL.value()}/#finance`;
  const uid = OWNER_UID.value();
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const refused = typeof req.query.error === "string" ? req.query.error : "";

  if (!uid || refused || !code) {
    res.status(400).send(page("Connexion annulée", escapeHtml(refused || "La banque n'a pas renvoyé d'autorisation."), back));
    return;
  }

  const pending = await pendingRef(uid).get();
  const createdAt = (pending.get("createdAt") as Timestamp | undefined)?.toMillis() ?? 0;
  if (!pending.exists || pending.get("state") !== state || Date.now() - createdAt > STATE_TTL_MS) {
    res.status(400).send(page("Lien expiré", "Relance la connexion depuis l'app.", back));
    return;
  }
  await pending.ref.delete();

  try {
    const api = client();
    const session = await api.createSession(code);
    const connection: Connection = {
      sessionId: session.session_id,
      aspsp: BANK_ASPSP.value(),
      validUntil: Timestamp.fromDate(new Date(session.access.valid_until)),
      accounts: session.accounts.map((a) => ({ uid: a.uid, iban: a.account_id?.iban ?? null, account: accountName(a) })),
      lastSyncedAt: null,
      lastResult: null,
      lastError: null,
      status: "active",
    };
    await connectionRef(uid).set(connection);
    logger.info("bankCallback", { accounts: connection.accounts.map((a) => a.account), validUntil: session.access.valid_until });

    try {
      await syncBank(uid, api);
    } catch (error) {
      logger.error("bankCallback: first sync failed", { error: (error as Error).message });
    }
    res.redirect(302, back);
  } catch (error) {
    logger.error("bankCallback", { error: (error as Error).message });
    res.status(502).send(page("La banque a refusé", escapeHtml((error as Error).message.slice(0, 300)), back));
  }
});

/** Every morning: yesterday's lines and the balances, before you open the app. */
export const bankSync = onSchedule(
  { schedule: "15 6 * * *", timeZone: "Europe/Paris", retryCount: 1, secrets: [ENABLE_BANKING_KEY] },
  async () => {
    const uid = OWNER_UID.value();
    if (!uid || !ENABLE_BANKING_APP_ID.value()) {
      logger.warn("bankSync: not configured, skipping");
      return;
    }
    if (!(await connectionRef(uid).get()).exists) {
      logger.info("bankSync: no bank connected yet");
      return;
    }
    await syncBank(uid, client());
  },
);

/** "Synchroniser" in the app. Banks allow only a few unattended reads a day: use sparingly. */
export const bankSyncNow = onCall({ secrets: [ENABLE_BANKING_KEY], timeoutSeconds: 120 }, async (req) => {
  const uid = requireOwner(req);
  try {
    return await syncBank(uid, client());
  } catch (error) {
    throw new HttpsError("internal", (error as Error).message.slice(0, 300));
  }
});
