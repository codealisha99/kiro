import { linearScale, niceDomain } from "./scale";

// Inline trend line. Pass values in time order; null marks a missing period.
export function Sparkline({
  values,
  label,
  width = 96,
  height = 28,
}: {
  values: readonly (number | null)[];
  label: string;
  width?: number;
  height?: number;
}) {
  const points = values
    .map((value, index) => ({ index, value }))
    .filter((point): point is { index: number; value: number } => point.value !== null && Number.isFinite(point.value));
  if (points.length === 0) {
    return <span className="sparkline is-empty" role="img" aria-label={`${label}: no data`} style={{ width, height }} />;
  }
  const domain = niceDomain(points.map((point) => point.value), { count: 2 });
  const last = values.length - 1 || 1;
  const x = linearScale([0, last], [3, width - 3]);
  const y = linearScale(domain, [height - 4, 4]);
  const path = points.map((point, i) => `${i === 0 ? "M" : "L"}${x(point.index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ");
  const end = points[points.length - 1];
  const start = points[0];
  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}: ${start.value} at start, ${end.value} latest`}
    >
      <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(end.index)} cy={y(end.value)} r={3} fill="var(--chart-1)" stroke="var(--chart-surface)" strokeWidth={2} />
    </svg>
  );
}
