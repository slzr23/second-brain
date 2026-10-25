import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, XAxis } from "recharts";
import type { SpendUnit } from "../lib/finance";

const LABELS: Record<SpendUnit, Intl.DateTimeFormat> = {
  week: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "numeric" }),
  month: new Intl.DateTimeFormat("fr-FR", { month: "short" }),
  year: new Intl.DateTimeFormat("fr-FR", { year: "numeric" }),
};
/** "1 455" or "1,5 k" when bars are many and narrow. */
const compact = (cents: number, many: boolean) => {
  const euros = Math.round(cents / 100);
  return many && euros >= 1000 ? `${(euros / 1000).toFixed(1).replace(".", ",")}k` : String(euros);
};

/** Spending per week, month or year; the current one solid, the average of the others dashed. */
export function MonthBars({ buckets, unit, height = 160 }: { buckets: { key: string; date: Date; cents: number }[]; unit: SpendUnit; height?: number }) {
  const past = buckets.slice(0, -1);
  const average = past.length ? past.reduce((sum, m) => sum + m.cents, 0) / past.length : 0;
  const many = buckets.length > 7;
  const data = buckets.map((b, i) => ({
    ...b,
    label: LABELS[unit].format(b.date).replace(".", ""),
    last: i === buckets.length - 1,
  }));

  return (
    <div className="chart" style={{ height }} role="img" aria-label={data.map((d) => `${d.label} ${Math.round(d.cents / 100)} €`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: 4 }} barCategoryGap={many ? "18%" : "24%"}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} interval={many ? 1 : 0} tick={{ fill: "var(--label-2)", fontSize: many ? 11 : 13 }} />
          {average > 0 && <ReferenceLine y={average} stroke="var(--label-3)" strokeDasharray="4 4" />}
          <Bar dataKey="cents" radius={[5, 5, 5, 5]} maxBarSize={44} animationDuration={600}>
            {data.map((d) => (
              <Cell key={d.key} fill="var(--red)" fillOpacity={d.last ? 1 : 0.35} />
            ))}
            <LabelList dataKey="cents" position="top" formatter={(v) => compact(Number(v), many)} style={{ fill: "var(--label-2)", fontSize: many ? 9 : 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
