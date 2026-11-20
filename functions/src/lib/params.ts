import { defineSecret, defineString } from "firebase-functions/params";

/** Long random string pasted into the iOS Shortcut (Authorization: Bearer …). */
export const INGEST_TOKEN = defineSecret("INGEST_TOKEN");

/**
 * Second token, for the morning Strava routine only: it can send activities and
 * nothing else, so a leak never lets anyone write expenses or notes.
 */
export const SPORT_TOKEN = defineSecret("SPORT_TOKEN");

/**
 * Firebase Auth uid of the owner: everything lands under users/{OWNER_UID}.
 * Empty on the very first deploy (nobody has signed in yet): set it in
 * functions/.env.<project-id> after the first sign-in, then redeploy.
 */
export const OWNER_UID = defineString("OWNER_UID", { default: "" });

/** Enable Banking application id (Control Panel), also the `kid` of every JWT. */
export const ENABLE_BANKING_APP_ID = defineString("ENABLE_BANKING_APP_ID", { default: "" });
/** Private key downloaded when the application was registered (<app-id>.pem). */
export const ENABLE_BANKING_KEY = defineSecret("ENABLE_BANKING_KEY");
/** Bank name exactly as GET /aspsps lists it, e.g. "Caisse d'Epargne Ile-de-France". */
export const BANK_ASPSP = defineString("BANK_ASPSP", { default: "" });
/** Where the app is served: the bank sends you back to {APP_URL}/api/bank/callback. */
export const APP_URL = defineString("APP_URL", { default: "https://slzr-4701d.web.app" });

/** Claude API key (console.anthropic.com), for sorting expenses. */
export const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
