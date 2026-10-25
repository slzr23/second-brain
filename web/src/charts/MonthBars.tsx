import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, XAxis } from "recharts";

const monthShort = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const compact = (cents: number) => `${Math.round(cents / 100)}`;

/** Spending per month, current month solid, with the average as a dashed line. */
export function MonthBars({ months, height = 150 }: { months: { month: string; date: Date; cents: number }[]; height?: number }) {
  const past = months.slice(0, -1);
  const average = past.length ? past.reduce((sum, m) => sum + m.cents, 0) / past.length : 0;
  const data = months.map((m, i) => ({ ...m, label: monthShort.format(m.date).replace(".", ""), last: i === months.length - 1 }));

  return (
    <div className="chart" style={{ height }} role="img" aria-label={data.map((d) => `${d.label} ${compact(d.cents)} €`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: 4 }} barCategoryGap="24%">
          <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={{ fill: "var(--label-2)", fontSize: 13 }} />
          {average > 0 && <ReferenceLine y={average} stroke="var(--label-3)" strokeDasharray="4 4" />}
          <Bar dataKey="cents" radius={[6, 6, 6, 6]} animationDuration={700}>
            {data.map((d) => (
              <Cell key={d.month} fill="var(--red)" fillOpacity={d.last ? 1 : 0.35} />
            ))}
            <LabelList dataKey="cents" position="top" formatter={(v) => compact(Number(v))} style={{ fill: "var(--label-2)", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
