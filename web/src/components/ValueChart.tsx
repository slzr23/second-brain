import { useState } from "react";
import { NetWorthChart, type Series } from "../charts/NetWorthChart";
import { useData } from "../data/context";
import type { Holding } from "../data/types";
import { availableRanges, isDaily, RANGES, valueSeries, type Range } from "../lib/finance";
import { formatEuros } from "../lib/format";
import { Segmented } from "./Segmented";

const SINCE: Record<Range, string> = {
  "1S": "en 1 semaine",
  "1M": "en 1 mois",
  "3M": "en 3 mois",
  "6M": "en 6 mois",
  "1A": "en 1 an",
  "5A": "en 5 ans",
  "10A": "en 10 ans",
  Tout: "depuis le début",
};

/**
 * Range picker (1S → Tout, only the ranges the data supports), the change over
 * that range, and the value chart of the given holdings.
 */
export function ValueChart({ id, holdings, series }: { id: string; holdings: Holding[]; series: Series[] }) {
  const { transactions, netWorthDays } = useData();
  const ranges = availableRanges(holdings);
  const [range, setRange] = useState<Range>("1A");
  const current = ranges.includes(range) ? range : ranges[ranges.length - 1];
  const points = valueSeries(holdings, transactions, netWorthDays, current);
  const first = points[0]?.total ?? 0;
  const last = points.at(-1)?.total ?? 0;
  const change = last - first;
  const pct = first > 0 ? Math.round((change / first) * 1000) / 10 : null;

  return (
    <>
      <Segmented
        id={`${id}-range`}
        label="Période"
        compact
        options={RANGES.filter((r) => ranges.includes(r.id)).map((r) => ({ id: r.id, label: r.label }))}
        value={current}
        onChange={setRange}
      />
      {points.length > 1 && (
        <p className={`range-change ${change >= 0 ? "up" : "down"}`}>
          {change >= 0 ? "+" : "−"}
          {formatEuros(Math.abs(change))}
          {pct !== null && ` (${change >= 0 ? "+" : "−"}${Math.abs(pct).toLocaleString("fr-FR")} %)`} <span className="secondary">{SINCE[current]}</span>
        </p>
      )}
      <NetWorthChart points={points} series={series} daily={isDaily(current)} />
    </>
  );
}
