import type { CSSProperties } from "react";

const Bar = ({ w, h = 14, style }: { w: string | number; h?: number; style?: CSSProperties }) => (
  <div className="skeleton" style={{ width: w, height: h, ...style }} />
);

/** Placeholder with the shape of the real page, shown until the first data arrives. */
export function SkeletonPage() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <section className="section">
        <div className="card">
          <Bar w={110} />
          <Bar w={160} h={44} style={{ marginTop: 10 }} />
          <Bar w="100%" h={110} style={{ marginTop: 18, borderRadius: 12 }} />
        </div>
      </section>
      <section className="section">
        <Bar w={140} h={22} style={{ margin: "0 4px 10px" }} />
        {[0, 1, 2].map((i) => (
          <div className="card" key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%" }} />
            <div style={{ flex: 1, display: "grid", gap: 8 }}>
              <Bar w="60%" />
              <Bar w="35%" h={12} />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
