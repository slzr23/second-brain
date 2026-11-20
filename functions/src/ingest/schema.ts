import { z } from "zod";
import { stravaActivity } from "../sport/activities";

/** Tags arrive either as a JSON array or as "rêve lucide, travail" from a Shortcut. */
const tags = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((value) => {
    const list = typeof value === "string" ? value.split(",") : (value ?? []);
    return [...new Set(list.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  });

const text = z.string().trim().min(1, "Le texte est vide").max(20_000);
const amount = z.union([z.number(), z.string().trim().min(1)]);
const label = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(200).optional();
/** Optional backdating, e.g. an expense entered the day after. */
const date = z.iso.date().optional();

export const NECESSITIES = ["essentiel", "social", "superflu"] as const;
/**
 * "Essentiel", "social"… from a Shortcut list. Anything else ("plus tard", empty)
 * leaves the expense unsorted: it then shows up in "À trier".
 */
const necessity = z
  .string()
  .optional()
  .transform((value) => {
    const v = value?.trim().toLowerCase();
    return NECESSITIES.find((n) => n === v);
  });

export const ingestPayload = z.discriminatedUnion("type", [
  z.object({ type: z.literal("dream"), text, tags }),
  z.object({ type: z.literal("note"), text, tags }),
  z.object({ type: z.literal("expense"), amount, label, necessity, merchant: optionalText, date }),
  z.object({ type: z.literal("income"), amount, label, date }),
  // Sent by the iOS Wallet "Transaction" automation after an Apple Pay payment.
  z.object({ type: z.literal("apple_pay"), amount, merchant: label, card: optionalText }),
  // A drink: "25 cl", "0,5 L", 250 (ml).
  z.object({ type: z.literal("water"), amount }),
  // Morning Apple Health shortcut: last night's sleep samples ("start|end|stage" lines) and resting heart rate.
  z.object({
    type: z.literal("health"),
    sleep: z.union([z.string().max(50_000), z.array(z.string().max(500)).max(500)]).optional(),
    restingHr: z.union([z.number(), z.string().max(40)]).optional(),
  }),
  // New Strava activities, sent by the morning routine (same format as the history import).
  z.object({ type: z.literal("activities"), activities: z.array(stravaActivity).max(200) }),
]);

export type IngestPayload = z.infer<typeof ingestPayload>;
/** What the Action Button and Apple Pay send: one document each. */
export type CapturePayload = Exclude<IngestPayload, { type: "health" | "activities" }>;
