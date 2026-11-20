import type Anthropic from "@anthropic-ai/sdk";
import { FieldValue, getFirestore, type Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { firstPass, merchantKey, type Category, type Decision, type Necessity, type SpendLine } from "./categories";
import { BATCH, classifyMerchants, type Example } from "./claude";

/** Enough for the whole history in one run (~250 merchants), bounded if something loops. */
const MAX_MERCHANTS = 400;
const MAX_EXAMPLES = 40;

export interface ClassifyResult {
  lines: number;
  fromMemory: number;
  fromRules: number;
  fromClaude: number;
  merchantsAsked: number;
  left: number;
}

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

/** Merchants you sorted yourself, most frequent first: Claude follows your way of judging. */
function pickExamples(lines: SpendLine[]): Example[] {
  const byMerchant = new Map<string, { label: string; count: number; category: Category | null; necessity: Necessity | null }>();
  for (const l of lines) {
    if (!l.necessity && l.categorySource !== "me") continue;
    const key = merchantKey(l.label);
    const e = byMerchant.get(key) ?? { label: l.label, count: 0, category: null, necessity: null };
    e.count += 1;
    if (l.categorySource === "me" || !e.category) e.category = l.category;
    e.necessity = l.necessity ?? e.necessity;
    byMerchant.set(key, e);
  }
  return [...byMerchant.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_EXAMPLES)
    .map(({ label, category, necessity }) => ({ label, category, necessity }));
}

/**
 * Gives every expense a category, and a proposed necessity to confirm with a
 * swipe: your own past choices first, then keyword rules, then Claude for the
 * merchants still unknown. Never overwrites what you set yourself.
 */
export async function classifyTransactions(uid: string, client: Anthropic | null): Promise<ClassifyResult> {
  const col = getFirestore().collection("users").doc(uid).collection("transactions");
  const snap = await col.where("amountCents", "<", 0).get();
  const lines: SpendLine[] = snap.docs
    .filter((d) => !d.get("transfer"))
    .map((d) => ({
      id: d.id,
      label: d.get("label") ?? "",
      amountCents: d.get("amountCents"),
      date: (d.get("date") as Timestamp).toDate(),
      category: d.get("category") ?? null,
      categorySource: d.get("categorySource") ?? null,
      necessity: d.get("necessity") ?? null,
      suggestedNecessity: d.get("suggestedNecessity") ?? null,
    }));

  const { decided, unknown } = firstPass(lines);
  const decisions = new Map<string, Decision>(decided.map((d) => [d.id, d]));
  const result: ClassifyResult = { lines: 0, fromMemory: 0, fromRules: 0, fromClaude: 0, merchantsAsked: 0, left: 0 };

  if (client && unknown.size) {
    const merchants = [...unknown.values()].slice(0, MAX_MERCHANTS);
    const examples = pickExamples(lines);
    for (let i = 0; i < merchants.length; i += BATCH) {
      const chunk = merchants.slice(i, i + BATCH);
      let answers;
      try {
        answers = await classifyMerchants(
          client,
          chunk.map((ls) => ({ label: ls[0].label, euros: median(ls.map((l) => -l.amountCents)) / 100, count: ls.length })),
          examples,
        );
      } catch (error) {
        // One failed batch (rate limit, network) must not lose the others.
        logger.error("classify: batch failed", { error: (error as Error).message });
        continue;
      }
      result.merchantsAsked += chunk.length;
      chunk.forEach((ls, j) => {
        const a = answers.get(j);
        if (!a) return;
        for (const l of ls) {
          const d = decisions.get(l.id) ?? { id: l.id };
          if (!l.category && !d.category) Object.assign(d, { category: a.category, categorySource: "claude" });
          if (!l.necessity && !l.suggestedNecessity && !d.suggestedNecessity) d.suggestedNecessity = a.necessity;
          decisions.set(l.id, d);
        }
      });
    }
  }

  // Firestore batches hold 500 writes.
  const writes = [...decisions.values()].filter((d) => d.category || d.suggestedNecessity);
  for (let i = 0; i < writes.length; i += 450) {
    const batch = getFirestore().batch();
    for (const { id, ...fields } of writes.slice(i, i + 450)) batch.update(col.doc(id), { ...fields, classifiedAt: FieldValue.serverTimestamp() });
    await batch.commit();
  }

  for (const d of writes) {
    if (d.categorySource === "memory") result.fromMemory += 1;
    else if (d.categorySource === "rule") result.fromRules += 1;
    else if (d.categorySource === "claude") result.fromClaude += 1;
  }
  result.lines = writes.length;
  const done = new Set(writes.filter((d) => d.category).map((d) => d.id));
  result.left = lines.filter((l) => !l.category && !done.has(l.id)).length;
  logger.info("classify", result);
  return result;
}
