import { defineSecret, defineString } from "firebase-functions/params";

/** Long random string pasted into the iOS Shortcut (Authorization: Bearer …). */
export const INGEST_TOKEN = defineSecret("INGEST_TOKEN");

/**
 * Firebase Auth uid of the owner: everything lands under users/{OWNER_UID}.
 * Empty on the very first deploy (nobody has signed in yet): set it in
 * functions/.env.<project-id> after the first sign-in, then redeploy.
 */
export const OWNER_UID = defineString("OWNER_UID", { default: "" });
