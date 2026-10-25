import { motion } from "motion/react";

interface Props<T extends string> {
  /** Unique per control on screen, so the sliding thumbs don't fly between controls. */
  id: string;
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Smaller text, for many short options (1S 1M 3M…). */
  compact?: boolean;
}

/** iOS segmented control with a sliding thumb. */
export function Segmented<T extends string>({ id, label, options, value, onChange, compact = false }: Props<T>) {
  return (
    <div className={compact ? "segmented compact" : "segmented"} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === value} onClick={() => onChange(o.id)}>
          {o.id === value && (
            <motion.span
              layoutId={`thumb-${id}`}
              className="segmented-thumb"
              transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
            />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}
