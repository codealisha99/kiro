import type { ChartTone } from "./chart-format";

// Progress with an optional "expected by today" marker. Values are ratios in [0, 1].
export function ProgressBar({
  value,
  expected,
  label,
  valueText,
  tone = "accent",
}: {
  value: number | null;
  expected?: number | null;
  label: string;
  valueText?: string;
  tone?: Extract<ChartTone, "accent" | "good" | "warning" | "danger">;
}) {
  const clamped = value === null ? 0 : Math.min(1, Math.max(0, value));
  const expectedClamped = expected === null || expected === undefined ? null : Math.min(1, Math.max(0, expected));
  const percent = Math.round(clamped * 100);
  const fillColor = tone === "accent" ? "var(--color-accent)" : tone === "good" ? "var(--color-success)" : tone === "warning" ? "var(--color-warning)" : "var(--color-danger)";
  return (
    <span className="progress-bar">
      <span
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : percent}
        aria-valuetext={valueText ?? (value === null ? "No data yet" : `${percent}% complete`)}
      >
        <span className="progress-fill" style={{ width: `${clamped * 100}%`, background: fillColor }} />
        {expectedClamped !== null && <span className="progress-expected" style={{ left: `${expectedClamped * 100}%` }} aria-hidden="true" />}
      </span>
    </span>
  );
}
