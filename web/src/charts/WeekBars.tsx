import { Bar, BarChart, Cell, ResponsiveContainer, XAxis } from "recharts";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

/** Kilometres per day, Monday first. Today's bar is solid, past days are softer, days to come are empty. */
export function WeekBars({ km }: { km: number[] }) {
  const today = (new Date().getDay() + 6) % 7;
  // Days without a run still get a short stub, as in Apple Fitness.
  const max = Math.max(...km, 1);
  const data = km.map((value, i) => ({ day: DAYS[i], value, shown: Math.max(value, max * 0.04), i }));

  return (
    <div className="chart" role="img" aria-label={`Kilomètres par jour : ${km.map((k, i) => `${DAYS[i]} ${k.toFixed(1)}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="22%">
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={{ fill: "var(--label-2)", fontSize: 13, fontWeight: 500 }}
          />
          <Bar dataKey="shown" radius={[6, 6, 6, 6]} isAnimationActive animationDuration={700} animationEasing="ease-out">
            {data.map((d) => (
              <Cell
                key={d.i}
                fill={d.i > today || d.value === 0 ? "var(--fill)" : "var(--sport)"}
                fillOpacity={d.i === today || d.value === 0 ? 1 : 0.55}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
