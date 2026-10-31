import { describe, expect, it } from "vitest";
import { tokenMatches } from "../src/ingest/index";

describe("ingest token", () => {
  it("accepts the token even when the stored secret ends with a newline", () => {
    expect(tokenMatches("abc123", "abc123\n")).toBe(true);
  });
  it("rejects another token", () => {
    expect(tokenMatches("abc124", "abc123\n")).toBe(false);
    expect(tokenMatches("", "abc123")).toBe(false);
  });
});
