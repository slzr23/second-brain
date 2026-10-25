import { useState } from "react";
import { NetWorthChart, type Series } from "../charts/NetWorthChart";
import { useData } from "../data/context";
import type { Holding } from "../data/types";
import { availableRanges, isDaily, RANGES, valueSeries, type Range } from "../lib/finance";
import { Segmented } from "./Segmented";

/**
 * Range picker (1S → Tout, only the ranges the data supports) and the stacked
 * value chart of the given holdings.
 */
export function ValueChart({ id, holdings, series }: { id: string; holdings: Holding[]; series: Series[] }) {
  const { transactions, netWorthDays } = useData();
  const ranges = availableRanges(holdings);
  const [range, setRange] = useState<Range>("1A");
  const current = ranges.includes(range) ? range : ranges[ranges.length - 1];
  const points = valueSeries(holdings, transactions, netWorthDays, current);

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
      <NetWorthChart points={points} series={series} daily={isDaily(current)} />
    </>
  );
}
