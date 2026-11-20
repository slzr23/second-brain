import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as logger from "firebase-functions/logger";
import { z } from "zod";
import { CATEGORIES, CATEGORY_LABEL, NECESSITIES, type Category, type Necessity } from "./categories";

/** Cheap and quick: this is plain labelling, a few dozen merchants a month. */
const MODEL = "claude-haiku-5-5";
export const BATCH = 50;

export interface MerchantToClassify {
  label: string;
  /** Typical amount, in euros, and how many times it appears. */
  euros: number;
  count: number;
}

export interface Example {
  label: string;
  category: Category | null;
  necessity: Necessity | null;
}

export interface Classified {
  category: Category;
  necessity: Necessity;
}

const answer = z.object({
  merchants: z.array(
    z.object({
      n: z.number().int().describe("Numéro du commerçant dans la liste"),
      category: z.enum(CATEGORIES),
      necessity: z.enum(NECESSITIES),
    }),
  ),
});

const SYSTEM = `Tu classes les dépenses bancaires d'une personne : alternant ingénieur chez Airbus en région parisienne, coureur à pied (entraînements et courses), qui sort avec ses amis.

Pour chaque commerçant, donne :
- une catégorie : ${CATEGORIES.map((c) => `${c} (${CATEGORY_LABEL[c]})`).join(", ")} ;
- une nécessité :
  - essentiel : nécessaire pour vivre, travailler ou s'entraîner (courses alimentaires, loyer, factures, transport du quotidien, santé, frais bancaires) ;
  - social : dépensé avec ou pour d'autres (bar, restaurant ou soirée entre amis, cadeau, remboursement à un ami) ;
  - superflu : un plaisir personnel évitable (vêtements non nécessaires, gadgets, VTC par confort, abonnements de confort, fast-food seul).

Les libellés viennent du relevé bancaire : souvent tronqués ou en majuscules (« H M Hennes Ma » est H&M). Un montant très faible chez un commerçant de transport est un trajet ; un « Sumup » est un petit commerçant, souvent un bar ou un stand. Si un nom ne dit rien, choisis « autres » et la nécessité la plus probable pour le montant.

Réponds pour chaque numéro de la liste, une seule fois.`;

function examplesText(examples: Example[]): string {
  if (examples.length === 0) return "";
  const lines = examples.map((e) => `- ${e.label} : ${[e.category, e.necessity].filter(Boolean).join(", ")}`);
  return `\n\nVoici comment cette personne a déjà classé certains commerçants ; suis sa façon de juger :\n${lines.join("\n")}`;
}

/**
 * Category and necessity for up to BATCH merchants, keyed by their index in
 * `merchants`. A refusal or an unreadable answer returns an empty map: the
 * lines then keep what the rules gave them, and are tried again next time.
 */
export async function classifyMerchants(client: Anthropic, merchants: MerchantToClassify[], examples: Example[]): Promise<Map<number, Classified>> {
  const list = merchants.map((m, i) => `${i + 1}. ${m.label} — ${m.euros.toFixed(2).replace(".", ",")} €${m.count > 1 ? ` (${m.count} fois)` : ""}`).join("\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    // Labelling, not reasoning: low effort keeps it fast and cheap.
    output_config: { effort: "low", format: zodOutputFormat(answer) },
    // The instructions and your examples change rarely: cached between batches of one run.
    system: [{ type: "text", text: SYSTEM + examplesText(examples), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Commerçants à classer :\n${list}` }],
  });

  const out = new Map<number, Classified>();
  if (response.stop_reason === "refusal") {
    logger.warn("classify: refused", { category: response.stop_details?.category ?? null, merchants: merchants.length });
    return out;
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    logger.warn("classify: unreadable answer", { stop: response.stop_reason, merchants: merchants.length });
    return out;
  }
  for (const m of response.parsed_output.merchants) {
    if (m.n >= 1 && m.n <= merchants.length) out.set(m.n - 1, { category: m.category, necessity: m.necessity });
  }
  logger.info("classify: batch", {
    merchants: merchants.length,
    answered: out.size,
    input: response.usage.input_tokens,
    cached: response.usage.cache_read_input_tokens ?? 0,
    output: response.usage.output_tokens,
  });
  return out;
}
