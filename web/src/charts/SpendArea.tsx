import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatEuros } from "../lib/format";

interface Point {
  day: number;
  cents: number | null;
}

function TooltipBox({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  const point = payload[0].payload as Point;
  return (
    <div className="chart-tooltip">
      <span className="secondary">Le {point.day}</span>
      <b>{formatEuros(point.cents ?? 0)}</b>
    </div>
  );
}

/** Cumulative spending since the 1st of the month, Revolut-style. */
export function SpendArea({ dailyCents }: { dailyCents: number[] }) {
  const today = new Date().getDate();
  let running = 0;
  const data: Point[] = dailyCents.map((cents, i) => {
    running += cents;
    return { day: i + 1, cents: i < today ? running : null };
  });

  return (
    <div className="chart" style={{ height: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--finance)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--finance)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            ticks={[1, 15, data.length]}
            tick={{ fill: "var(--label-2)", fontSize: 12 }}
          />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip content={TooltipBox} cursor={{ stroke: "var(--label-3)", strokeDasharray: "3 3" }} />
          <Area
            type="monotone"
            dataKey="cents"
            stroke="var(--finance)"
            strokeWidth={2.5}
            fill="url(#spend-fill)"
            connectNulls={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
