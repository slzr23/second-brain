import { describe, expect, it } from "vitest";
import { buildRecord } from "../src/ingest/build";
import { ingestPayload } from "../src/ingest/schema";
import { formatVolume, parseVolumeMl } from "../src/lib/volume";

describe("water", () => {
  it("reads what a Shortcut list or number field sends", () => {
    expect(parseVolumeMl("25 cl")).toBe(250);
    expect(parseVolumeMl("0,5 L")).toBe(500);
    expect(parseVolumeMl("1L")).toBe(1000);
    expect(parseVolumeMl("330 ml")).toBe(330);
    expect(parseVolumeMl(250)).toBe(250);
    expect(parseVolumeMl("0.75")).toBe(750);
    expect(() => parseVolumeMl("beaucoup")).toThrow();
    expect(() => parseVolumeMl(5000)).toThrow();
  });

  it("adds a drink to the day, in Paris time", () => {
    const record = buildRecord(ingestPayload.parse({ type: "water", amount: "25 cl" }), new Date("2026-10-31T23:30:00Z"));
    expect(record).toMatchObject({ collection: "hydration", day: "2026-11-01", drink: { ml: 250 }, message: "+250 ml" });
    expect(formatVolume(1250)).toBe("1,25 L");
  });
});
