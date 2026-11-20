import { describe, expect, it } from "vitest";
import { buildMemory, categoryByRule, firstPass, merchantKey, type SpendLine } from "../src/finance/categories";

let n = 0;
const line = (over: Partial<SpendLine> = {}): SpendLine => ({
  id: `t${++n}`,
  label: "Lyovel Sas",
  amountCents: -140,
  date: new Date("2026-11-01T12:00:00Z"),
  category: null,
  categorySource: null,
  necessity: null,
  suggestedNecessity: null,
  ...over,
});

describe("keyword rules", () => {
  it("files obvious merchants", () => {
    expect(["SNCF-Voyageurs", "Ilevia Dat Metr", "Carrefour City", "Uber *trip Help", "Uber Eats", "Spotify P4859e8", "Free Telecom", "Selas Pharmacie", "H M Hennes Ma", "Decathlon 0063", "Getyourguide", "Kfc Lille Lezen", "Mc Donald'S"].map(categoryByRule)).toEqual([
      "transport", "transport", "courses", "transport", "sorties", "abonnements", "logement", "sante", "shopping", "loisirs", "voyages", "sorties", "sorties",
    ]);
  });

  it("leaves unknown names to Claude", () => {
    expect(categoryByRule("Lyovel Sas")).toBeNull();
    expect(categoryByRule("Sumup *codo Mf")).toBeNull();
  });

  it("compares merchants whatever the case and punctuation", () => {
    expect(merchantKey("Lyovel  S.A.S")).toBe(merchantKey("LYOVEL S A S"));
  });
});

describe("memory of my own choices", () => {
  it("keeps the category set by hand over a guessed one", () => {
    const memory = buildMemory([
      line({ category: "sorties", categorySource: "claude", date: new Date("2026-11-05") }),
      line({ category: "courses", categorySource: "me", date: new Date("2026-10-01") }),
      line({ necessity: "superflu" }),
    ]);
    expect(memory.get(merchantKey("Lyovel Sas"))).toMatchObject({ category: "courses", necessity: "superflu" });
  });
});

describe("first pass", () => {
  it("sorts a known merchant without Claude and proposes my usual necessity", () => {
    const old = line({ category: "courses", categorySource: "me", necessity: "superflu" });
    const fresh = line();
    const { decided, unknown } = firstPass([old, fresh]);
    expect(decided).toEqual([{ id: fresh.id, category: "courses", categorySource: "memory", suggestedNecessity: "superflu" }]);
    expect(unknown.size).toBe(0);
  });

  it("asks Claude once per unknown merchant, with the rule as a fallback category", () => {
    const a = line({ label: "SNCF-Voyageurs" });
    const b = line({ label: "SNCF VOYAGEURS" });
    const c = line({ label: "Sumup *codo Mf" });
    const { decided, unknown } = firstPass([a, b, c]);
    expect(decided.map((d) => d.category)).toEqual(["transport", "transport"]);
    expect([...unknown.values()].map((ls) => ls.length)).toEqual([2, 1]);
  });

  it("never touches a line already sorted", () => {
    const done = line({ category: "sorties", categorySource: "me", necessity: "social" });
    expect(firstPass([done])).toMatchObject({ decided: [], unknown: new Map() });
  });
});
