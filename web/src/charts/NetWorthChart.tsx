import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ValuePoint } from "../lib/finance";
import { formatEuros } from "../lib/format";

const tickDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const tickMonth = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });
const fullDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fullMonth = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

export interface Series {
  key: string;
  label: string;
  color: string;
}

/**
 * Value over time, one stacked layer per account, so both the total and what each
 * account brings to it read at a glance. Points are days or months.
 */
export function NetWorthChart({ points, series, daily, height = 170 }: { points: ValuePoint[]; series: Series[]; daily: boolean; height?: number }) {
  const data = points.map((p) => ({ key: p.key, time: p.date.getTime(), ...p.byGroup }));
  const ticks = data.length > 2 ? [data[0].time, data[Math.floor(data.length / 2)].time, data[data.length - 1].time] : data.map((d) => d.time);
  const id = (key: string) => `nw-${key.replace(/\W/g, "")}`;

  function TooltipBox({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((sum, p) => sum + Number(p.value ?? 0), 0);
    const date = new Date(Number(label));
    return (
      <div className="chart-tooltip">
        <span className="secondary">{daily ? fullDay.format(date) : fullMonth.format(date)}</span>
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

  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={id(s.key)} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.55} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.15} />
              </linearGradient>
            ))}
          </defs>
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            axisLine={false}
            tickLine={false}
            ticks={ticks}
            interval={0}
            padding={{ left: 14, right: 14 }}
            tickFormatter={(t: number) => (daily ? tickDay : tickMonth).format(new Date(t))}
            tick={{ fill: "var(--label-2)", fontSize: 12 }}
          />
          <YAxis hide domain={series.length > 1 ? [0, "dataMax"] : ["auto", "auto"]} />
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
              fill={`url(#${id(s.key)})`}
              animationDuration={600}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
