import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatEuros } from "../lib/format";

interface Point {
  day: number;
  spent: number | null;
  usual: number;
}

function TooltipBox({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as Point;
  return (
    <div className="chart-tooltip">
      <span className="secondary">Au {point.day}</span>
      {point.spent !== null && <b>{formatEuros(point.spent)}</b>}
      <span className="tooltip-row">
        <i className="dash" /> D'habitude {formatEuros(point.usual)}
      </span>
    </div>
  );
}

/**
 * Running total of this month's spending (red) against the usual pace: the
 * average of the 3 previous months at the same day (dashed).
 */
export function SpendCompare({ spent, usual, today, height = 150 }: { spent: number[]; usual: number[]; today: number; height?: number }) {
  const data: Point[] = usual.map((u, i) => ({ day: i + 1, usual: u, spent: i < today ? spent[i] : null }));

  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="spend-red" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--red)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--red)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" axisLine={false} tickLine={false} ticks={[1, 15, data.length]} tick={{ fill: "var(--label-2)", fontSize: 12 }} />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip content={TooltipBox} cursor={{ stroke: "var(--label-3)", strokeDasharray: "3 3" }} />
          <Line type="monotone" dataKey="usual" stroke="var(--label-3)" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} animationDuration={600} />
          <Area
            type="monotone"
            dataKey="spent"
            stroke="var(--red)"
            strokeWidth={2.5}
            fill="url(#spend-red)"
            connectNulls={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
