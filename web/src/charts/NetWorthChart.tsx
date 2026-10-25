import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatEuros } from "../lib/format";
import type { NetWorthPoint } from "../lib/finance";

const monthShort = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });
const monthLong = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const toDate = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1);

export interface Series {
  key: string;
  label: string;
  color: string;
}

function TooltipBox({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + Number(p.value ?? 0), 0);
  return (
    <div className="chart-tooltip">
      <span className="secondary">{monthLong.format(toDate(String(label)))}</span>
      <b>{formatEuros(total)}</b>
      {payload.length > 1 &&
        [...payload].reverse().map((p) => (
          <span key={String(p.dataKey)} className="tooltip-row">
            <i style={{ background: p.color }} /> {p.name} {formatEuros(Number(p.value ?? 0))}
          </span>
        ))}
    </div>
  );
}

/**
 * Value over time, one stacked layer per account, so both the total and what
 * each account brings to it read at a glance.
 */
export function NetWorthChart({ points, series, height = 170 }: { points: NetWorthPoint[]; series: Series[]; height?: number }) {
  const data = points.map((p) => ({ month: p.month, ...p.byGroup }));
  const ticks = data.length > 2 ? [data[0].month, data[Math.floor(data.length / 2)].month, data[data.length - 1].month] : data.map((d) => d.month);

  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`nw-${s.key.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.55} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.15} />
              </linearGradient>
            ))}
          </defs>
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            ticks={ticks}
            interval={0}
            padding={{ left: 14, right: 14 }}
            tickFormatter={(m: string) => monthShort.format(toDate(m))}
            tick={{ fill: "var(--label-2)", fontSize: 12 }}
          />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip content={TooltipBox} cursor={{ stroke: "var(--label-3)", strokeDasharray: "3 3" }} />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stackId="1"
              stroke={s.color}
              strokeWidth={series.length > 1 ? 1.5 : 2.5}
              fill={`url(#nw-${s.key.replace(/\W/g, "")})`}
              animationDuration={700}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
