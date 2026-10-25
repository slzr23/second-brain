/** Splits a CSV text into rows of cells. Handles quoted cells, doubled quotes and CRLF. */
export function parseCsv(text: string, separator = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === separator) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

/** Bank exports are often Windows-1252, not UTF-8. Picks the one that decodes cleanly. */
export function decodeBankFile(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const text = utf8.includes("�") ? new TextDecoder("windows-1252").decode(buffer) : utf8;
  return text.replace(/^﻿/, "");
}

/** "-1 234,56" → -123456 */
export function frenchAmountToCents(value: string): number {
  const cleaned = value.replace(/[\s  €]/g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!cleaned || !Number.isFinite(n)) throw new Error(`Montant illisible : "${value}"`);
  return Math.round(n * 100);
}

/** "24/10/2026" → that day at noon local time (safe from time-zone shifts). */
export function frenchDate(value: string): Date {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) throw new Error(`Date illisible : "${value}"`);
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
}

/** Uppercase without accents, for matching labels: "Épargne" → "EPARGNE". */
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

/** Short stable id from any string (SHA-1, hex). */
export async function stableId(prefix: string, key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(key));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex.slice(0, 24)}`;
}
