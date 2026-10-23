import { z } from "zod";

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
const necessity = z.enum(NECESSITIES).optional();

export const ingestPayload = z.discriminatedUnion("type", [
  z.object({ type: z.literal("dream"), text, tags }),
  z.object({ type: z.literal("note"), text, tags }),
  z.object({ type: z.literal("expense"), amount, label, necessity, merchant: optionalText, date }),
  z.object({ type: z.literal("income"), amount, label, date }),
  // Sent by the iOS Wallet "Transaction" automation after an Apple Pay payment.
  z.object({ type: z.literal("apple_pay"), amount, merchant: label, card: optionalText }),
]);

export type IngestPayload = z.infer<typeof ingestPayload>;
