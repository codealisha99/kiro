import { Sparkline } from "./Sparkline";

export type DeltaDirection = "up" | "down" | "neither";

// `good` says which direction is favorable, so color follows meaning rather than sign alone.
export function StatTile({
  label,
  value,
  delta,
  trend,
  note,
}: {
  label: string;
  value: string;
  delta?: { change: number; text: string; good?: DeltaDirection };
  trend?: readonly (number | null)[];
  note?: string;
}) {
  const direction = !delta || delta.change === 0 ? "flat" : delta.change > 0 ? "up" : "down";
  const tone =
    !delta || direction === "flat" || !delta.good || delta.good === "neither"
      ? "neutral"
      : direction === delta.good
        ? "good"
        : "bad";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "–";
  return (
    <div className="stat-tile">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {delta && (
        <p className={`stat-delta tone-${tone}`}>
          <span aria-hidden="true">{arrow}</span>
          <span>{delta.text}</span>
        </p>
      )}
      {trend && trend.length > 1 && <Sparkline values={trend} label={`${label} trend`} />}
      {note && <p className="stat-note">{note}</p>}
    </div>
  );
}
