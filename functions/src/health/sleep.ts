import { localDateKey } from "../lib/week";
import { parisTime } from "../sport/activities";

/** Sleep stages as Apple Health names them, whatever the language of the iPhone. */
export type Stage = "inBed" | "awake" | "core" | "deep" | "rem" | "asleep";

export interface SleepSegment {
  start: Date;
  end: Date;
  stage: Stage;
}

export interface SleepSummary {
  /** Paris date of the morning you woke up: the night of the 19th to the 20th is "2026-11-20". */
  day: string;
  start: Date;
  end: Date;
  /** Time actually asleep (every stage but awake and "in bed"). */
  asleepMin: number;
  deepMin: number;
  remMin: number;
  coreMin: number;
  awakeMin: number;
}

/** "Profond", "Sommeil paradoxal", "Essentiel", "Éveillé(e)", "Au lit", "Endormi(e)", or the English names. */
export function parseStage(value: string): Stage | null {
  const v = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (/\b(au lit|in ?bed|inbed)\b/.test(v)) return "inBed";
  if (/eveill|awake/.test(v)) return "awake";
  if (/profond|deep/.test(v)) return "deep";
  if (/paradox|\brem\b/.test(v)) return "rem";
  if (/essentiel|leger|core|light/.test(v)) return "core";
  if (/endormi|asleep|sommeil|unspecified/.test(v)) return "asleep";
  return null;
}

const MONTHS = ["janv", "fevr", "mars", "avr", "mai", "juin", "juil", "aout", "sept", "oct", "nov", "dec"];
const pad = (n: string | number) => String(n).padStart(2, "0");

/**
 * A date as the Shortcut may send it: ISO 8601 ("2026-11-20T01:00:00+01:00"), or the
 * iPhone's French display when the date was not formatted ("19/11/2026 07:24",
 * "20 nov. 2026 à 01:00"), read as Paris time.
 */
export function parseShortcutDate(raw: string): Date {
  const text = raw.trim();
  const numeric = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2})[:h](\d{2})(?::(\d{2}))?/.exec(text);
  if (numeric) {
    const [, d, m, y, hh, mm, ss = "00"] = numeric;
    return parisTime(`${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${mm}:${ss}`);
  }
  const named = /^(\d{1,2})\s+([a-zéû]+)\.?\s+(\d{4})\D+(\d{1,2})[:h](\d{2})(?::(\d{2}))?/i.exec(text);
  if (named) {
    const [, d, monthName, y, hh, mm, ss = "00"] = named;
    const key = monthName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    // "nov", "novembre", "juil.", "fév." all point to one month.
    const m = key.length >= 3 ? MONTHS.findIndex((name) => key.startsWith(name) || name.startsWith(key)) : -1;
    if (m >= 0) return parisTime(`${y}-${pad(m + 1)}-${pad(d)}T${pad(hh)}:${mm}:${ss}`);
  }
  return new Date(text);
}

/**
 * One sample per line, "start|end|stage", dates in ISO 8601 as the Shortcut's
 * "Format Date" gives them, or as the iPhone displays them. Unreadable lines
 * are skipped, not fatal: one odd sample must not lose the whole night.
 */
export function parseSleepLines(input: string | string[]): SleepSegment[] {
  const lines = (Array.isArray(input) ? input : input.split(/\r?\n/)).flatMap((l) => l.split(/\r?\n/));
  const out: SleepSegment[] = [];
  for (const line of lines) {
    const [a, b, c] = line.split(/\s*[|;\t]\s*/);
    if (!a || !b || !c) continue;
    const start = parseShortcutDate(a);
    const end = parseShortcutDate(b);
    const stage = parseStage(c);
    if (!stage || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) continue;
    out.push({ start, end, stage });
  }
  return out;
}

/** Total minutes covered by the intervals, overlaps counted once (iPhone and watch can both write a night). */
function unionMinutes(segments: SleepSegment[]): number {
  const sorted = [...segments].sort((x, y) => x.start.getTime() - y.start.getTime());
  let total = 0;
  let curStart = 0;
  let curEnd = 0;
  for (const s of sorted) {
    const a = s.start.getTime();
    const b = s.end.getTime();
    if (a > curEnd) {
      total += curEnd - curStart;
      curStart = a;
      curEnd = b;
    } else if (b > curEnd) curEnd = b;
  }
  total += curEnd - curStart;
  return Math.round(total / 60_000);
}

/**
 * The last night in the samples. Samples more than 4 hours apart belong to
 * different sleeps: only the latest block is kept (a nap the day before is not the night).
 */
export function summarizeNight(segments: SleepSegment[]): SleepSummary | null {
  if (segments.length === 0) return null;
  const sorted = [...segments].sort((x, y) => x.start.getTime() - y.start.getTime());
  let block: SleepSegment[] = [];
  let blockEnd = 0;
  for (const s of sorted) {
    if (block.length && s.start.getTime() - blockEnd > 4 * 3_600_000) block = [];
    block.push(s);
    blockEnd = Math.max(blockEnd, s.end.getTime());
  }

  const of = (...stages: Stage[]) => unionMinutes(block.filter((s) => stages.includes(s.stage)));
  const staged = block.filter((s) => s.stage !== "inBed");
  const asleepMin = of("core", "deep", "rem", "asleep");
  const start = new Date(Math.min(...(staged.length ? staged : block).map((s) => s.start.getTime())));
  const end = new Date(Math.max(...(staged.length ? staged : block).map((s) => s.end.getTime())));
  return {
    day: localDateKey(end),
    start,
    end,
    // Only "in bed" known (no watch): that is the best guess of the night.
    asleepMin: asleepMin || of("inBed"),
    deepMin: of("deep"),
    remMin: of("rem"),
    coreMin: of("core"),
    awakeMin: of("awake"),
  };
}

export const formatMinutes = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
