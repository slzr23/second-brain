import { motion } from "motion/react";

/** Apple Fitness-style progress ring. `progress` may exceed 1; the ring then stays full. */
export function Ring({ progress, label, size = 88, stroke = 12 }: { progress: number; label: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const clamped = Math.max(0, Math.min(progress, 1));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} style={{ flex: "none" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sport)" strokeOpacity={0.2} strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--sport)"
        strokeWidth={stroke}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: clamped }}
        transition={{ duration: 1.1, ease: [0.32, 0.72, 0, 1], delay: 0.15 }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="var(--label)"
        style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
      >
        {Math.round(progress * 100)} %
      </text>
    </svg>
  );
}
