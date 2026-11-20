import Anthropic from "@anthropic-ai/sdk";
import { HttpsError, onCall } from "firebase-functions/https";
import { ANTHROPIC_API_KEY, OWNER_UID } from "../lib/params";
import { classifyTransactions } from "./classify";

export const claudeClient = () => {
  const apiKey = ANTHROPIC_API_KEY.value().trim();
  return apiKey ? new Anthropic({ apiKey }) : null;
};

/** "Trier avec Claude" in the app: the whole history at once (a few minutes the first time). */
export const classifyNow = onCall({ secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 540, memory: "512MiB" }, async (req) => {
  const owner = OWNER_UID.value();
  if (!owner || req.auth?.uid !== owner) throw new HttpsError("permission-denied", "Réservé au propriétaire");
  try {
    return await classifyTransactions(owner, claudeClient());
  } catch (error) {
    throw new HttpsError("internal", (error as Error).message.slice(0, 300));
  }
});
