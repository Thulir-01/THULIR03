import type { QcSeries } from "../../lib/alerts-store";

// ─── Levey-Jennings control chart ─────────────────────────────────────────

export function QcPlot({ qc, flagLabel = "1:3s" }: { qc: QcSeries; flagLabel?: string }) {
  const W = 560;
  const H = 210;
  const PAD = 12;
  const n = qc.points.length;
  const { mean, sd } = qc;
  const maxV = mean + 3.6 * sd;
  const minV = mean - 3.6 * sd;
  const x = (i: number) => PAD + (i / Math.max(n - 1, 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - minV) / (maxV - minV)) * (H - 2 * PAD);

  const line = (level: number) =>
    qc.points.map((_, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(mean + level * sd).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Levey-Jennings control chart">
      {/* ±3s band */}
      <rect x={PAD} y={y(mean + 3 * sd)} width={W - 2 * PAD} height={y(mean - 3 * sd) - y(mean + 3 * sd)} fill="#fef2f2" />
      {/* ±2s band */}
      <rect x={PAD} y={y(mean + 2 * sd)} width={W - 2 * PAD} height={y(mean - 2 * sd) - y(mean + 2 * sd)} fill="#fffbeb" />
      {/* ±1s band */}
      <rect x={PAD} y={y(mean + 1 * sd)} width={W - 2 * PAD} height={y(mean - 1 * sd) - y(mean + 1 * sd)} fill="#f8fafc" />
      {/* lines */}
      <line x1={PAD} x2={W - PAD} y1={y(mean)} y2={y(mean)} stroke="#334155" strokeWidth={1.5} />
      <line x1={PAD} x2={W - PAD} y1={y(mean + sd)} y2={y(mean + sd)} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2 3" />
      <line x1={PAD} x2={W - PAD} y1={y(mean - sd)} y2={y(mean - sd)} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2 3" />
      <line x1={PAD} x2={W - PAD} y1={y(mean + 2 * sd)} y2={y(mean + 2 * sd)} stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 4" />
      <line x1={PAD} x2={W - PAD} y1={y(mean - 2 * sd)} y2={y(mean - 2 * sd)} stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 4" />
      <line x1={PAD} x2={W - PAD} y1={y(mean + 3 * sd)} y2={y(mean + 3 * sd)} stroke="#dc2626" strokeWidth={1.2} strokeDasharray="6 4" />
      <line x1={PAD} x2={W - PAD} y1={y(mean - 3 * sd)} y2={y(mean - 3 * sd)} stroke="#dc2626" strokeWidth={1.2} strokeDasharray="6 4" />
      {/* labels */}
      {[
        { lvl: 3, label: `+3 SD (${(mean + 3 * sd).toFixed(1)})`, color: "#dc2626" },
        { lvl: 2, label: `+2 SD (${(mean + 2 * sd).toFixed(1)})`, color: "#b45309" },
        { lvl: 0, label: `Mean (${mean.toFixed(1)})`, color: "#334155" },
        { lvl: -2, label: `−2 SD (${(mean - 2 * sd).toFixed(1)})`, color: "#b45309" },
        { lvl: -3, label: `−3 SD (${(mean - 3 * sd).toFixed(1)})`, color: "#dc2626" },
      ].map((l) => (
        <text key={l.lvl} x={W - PAD - 2} y={y(mean + l.lvl * sd) - 3} textAnchor="end" fontSize={10} fill={l.color} fontWeight={l.lvl === 0 ? 700 : 500}>
          {l.label}
        </text>
      ))}
      {/* control line */}
      <path d={line(0)} fill="none" stroke="#0f766e" strokeWidth={1.6} />
      {/* points */}
      {qc.points.map((p, i) =>
        i === qc.flaggedIndex ? (
          <g key={i}>
            <circle cx={x(i)} cy={y(p)} r={5.5} fill="#dc2626" opacity={0.25} />
            <circle cx={x(i)} cy={y(p)} r={3.5} fill="#dc2626" stroke="#fff" strokeWidth={1.2} />
          </g>
        ) : (
          <circle key={i} cx={x(i)} cy={y(p)} r={2.4} fill="#0f766e" opacity={0.8} />
        ),
      )}
      {qc.flaggedIndex >= 0 && (
        <text x={x(qc.flaggedIndex)} y={y(qc.points[qc.flaggedIndex]) - 9} textAnchor="middle" fontSize={11} fontWeight={800} fill="#dc2626">
          {flagLabel}
        </text>
      )}
    </svg>
  );
}

// ─── Previous-run trend sparkline ─────────────────────────────────────────

export function TrendSpark({ values }: { values: number[] }) {
  const W = 560;
  const H = 56;
  const PAD = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / Math.max(values.length - 1, 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Previous run trend">
      <path d={d} fill="none" stroke="#0f766e" strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={x(last)} cy={y(values[last])} r={3} fill="#0f766e" />
    </svg>
  );
}
