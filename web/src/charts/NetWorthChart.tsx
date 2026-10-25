import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ValuePoint } from "../lib/finance";
import { formatEuros } from "../lib/format";

const tickDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const tickMonth = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });
const fullDay = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

export interface Series {
  /** A group name, or "total" for the sum of everything shown. */
  key: string;
  label: string;
  color: string;
}

/** Axis labels: "850 €", "2,5 k€", "12 k€". */
export function compactEuros(cents: number) {
  const euros = cents / 100;
  if (Math.abs(euros) < 1000) return `${Math.round(euros)} €`;
  const k = euros / 1000;
  return `${(Math.abs(k) < 10 ? k.toFixed(1) : Math.round(k).toString()).replace(".", ",").replace(",0", "")} k€`;
}

/** A round step (1, 2, 2,5 or 5 × 10ⁿ) giving about three intervals. */
const niceStep = (span: number) => {
  const raw = span / 3 || 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((step) => step >= raw)!;
};

/** Axis bounds and round ticks; from zero (or below) when accounts are compared. */
export function valueScale(values: number[], fromZero: boolean) {
  let low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 0;
  if (fromZero) low = Math.min(0, low);
  const step = niceStep(high - low);
  const min = Math.floor(low / step) * step;
  const max = Math.max(Math.ceil(high / step) * step, min + step);
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(t);
  return { min, max, ticks };
}

/**
 * Value over time, Revolut-style: one line with a soft fill for a single series,
 * zoomed on its range; several lines on a shared scale from zero (or below, for an overdraft) when
 * accounts are compared, each at its own value (nothing stacked).
 */
export function NetWorthChart({ points, series, daily, height = 190 }: { points: ValuePoint[]; series: Series[]; daily: boolean; height?: number }) {
  const data = points.map((p) => ({ key: p.key, time: p.date.getTime(), total: p.total, ...p.byGroup }));
  const ticks = data.length > 2 ? [data[0].time, data[Math.floor(data.length / 2)].time, data[data.length - 1].time] : data.map((d) => d.time);
  const single = series.length === 1;
  const scale = valueScale(
    data.flatMap((d) => series.map((s) => Number((d as Record<string, unknown>)[s.key] ?? 0))),
    !single,
  );
  const id = (key: string) => `nw-${key.replace(/\W/g, "")}`;

  function TooltipBox({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
    if (!active || !payload?.length) return null;
    const rows = payload.filter((p) => p.type !== "none").sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
    const date = new Date(Number(label));
    return (
      <div className="chart-tooltip">
        <span className="secondary">{fullDay.format(date)}</span>
        {single ? (
          <b>{formatEuros(Number(rows[0]?.value ?? 0))}</b>
        ) : (
          <>
            <b>{formatEuros(rows.reduce((sum, p) => sum + Number(p.value ?? 0), 0))}</b>
            {rows.map((p) => (
              <span key={String(p.dataKey)} className="tooltip-row">
                <i style={{ background: p.color }} /> {p.name} {formatEuros(Number(p.value ?? 0))}
              </span>
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 0, bottom: 0, left: 4 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={id(s.key)} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
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
          <YAxis
            orientation="right"
            axisLine={false}
            tickLine={false}
            width={50}
            ticks={scale.ticks}
            domain={[scale.min, scale.max]}
            tickFormatter={compactEuros}
            tick={{ fill: "var(--label-2)", fontSize: 11 }}
          />
          <Tooltip content={TooltipBox} cursor={{ stroke: "var(--label-3)", strokeDasharray: "3 3" }} />
          {single
            ? series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2.5}
                  fill={`url(#${id(s.key)})`}
                  baseValue="dataMin"
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  animationDuration={500}
                />
              ))
            : series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3.5, strokeWidth: 0 }}
                  animationDuration={500}
                />
              ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
