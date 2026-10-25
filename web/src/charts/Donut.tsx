import { Cell, Pie, PieChart } from "recharts";

export interface Slice {
  key: string;
  label: string;
  cents: number;
  color: string;
}

/** Share of each account in the total, Apple-Wallet style ring. */
export function Donut({ slices, size = 140 }: { slices: Slice[]; size?: number }) {
  const total = slices.reduce((sum, s) => sum + s.cents, 0) || 1;
  return (
    <div style={{ width: size, height: size, flex: "none" }} role="img" aria-label={slices.map((s) => `${s.label} ${Math.round((s.cents / total) * 100)} %`).join(", ")}>
      <PieChart width={size} height={size}>
        <Pie
          data={slices}
          dataKey="cents"
          nameKey="label"
          innerRadius={size / 2 - 22}
          outerRadius={size / 2}
          paddingAngle={slices.length > 1 ? 2 : 0}
          cornerRadius={4}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          isAnimationActive
          animationDuration={700}
        >
          {slices.map((s) => (
            <Cell key={s.key} fill={s.color} />
          ))}
        </Pie>
      </PieChart>
    </div>
  );
}
